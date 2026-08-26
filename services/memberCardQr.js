const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, MemberCardTokenModel, MemberCardTokenAuditModel } = require("../models");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createTokenValue() {
  return crypto.randomBytes(32).toString("base64url");
}

function getMemberQrBaseUrl(req) {
  const configured = String(process.env.MEMBER_CARD_QR_BASE_URL || "").trim();
  if (configured) return configured.endsWith("/") ? configured : `${configured}/`;

  const siteUrl = String(process.env.FRONTEND_BASE_URL || "https://faa-dubd.org").replace(/\/+$/, "");
  return `${siteUrl}/member/verify/`;
}

async function getOrCreateActiveMemberToken(memberId, createdBy = null) {
  const existing = await MemberCardTokenModel.findOne({
    where: { member_id: memberId, is_active: 1 },
    order: [["id", "DESC"]],
  });
  if (existing) return existing;

  const tokenValue = createTokenValue();
  return MemberCardTokenModel.create({
    member_id: memberId,
    token_value: tokenValue,
    token_hash: hashToken(tokenValue),
    is_active: 1,
    created_by: createdBy || null,
  });
}

async function ensureActiveTokensForMembers(memberIds, createdBy = null) {
  const ids = [...new Set((memberIds || []).map(Number).filter(Boolean))];
  const tokenMap = new Map();
  if (!ids.length) return tokenMap;

  const existing = await MemberCardTokenModel.findAll({
    where: { member_id: { [Op.in]: ids }, is_active: 1 },
    order: [["id", "DESC"]],
    raw: true,
    logging: false,
  });
  for (const token of existing) {
    const key = String(token.member_id);
    if (!tokenMap.has(key)) tokenMap.set(key, token);
  }

  const missingRows = ids
    .filter((memberId) => !tokenMap.has(String(memberId)))
    .map((memberId) => {
      const tokenValue = createTokenValue();
      return {
        member_id: memberId,
        token_value: tokenValue,
        token_hash: hashToken(tokenValue),
        is_active: 1,
        created_by: createdBy || null,
      };
    });

  if (missingRows.length) {
    const created = await MemberCardTokenModel.bulkCreate(missingRows, { returning: true, logging: false });
    for (const tokenModel of created) {
      const token = tokenModel.get ? tokenModel.get({ plain: true }) : tokenModel;
      tokenMap.set(String(token.member_id), token);
    }
  }

  return tokenMap;
}

async function findActiveToken(tokenValue) {
  return MemberCardTokenModel.findOne({
    where: { token_hash: hashToken(tokenValue), is_active: 1 },
  });
}

async function writeAudit({ memberId, tokenId, action, actorId = null, note = null, transaction }) {
  return MemberCardTokenAuditModel.create({
    member_id: memberId,
    token_id: tokenId,
    action,
    actor_id: actorId || null,
    note: note || null,
  }, { transaction });
}

async function createToken(memberId, createdBy, isActive, transaction) {
  const tokenValue = createTokenValue();
  return MemberCardTokenModel.create({
    member_id: memberId,
    token_value: tokenValue,
    token_hash: hashToken(tokenValue),
    is_active: isActive ? 1 : 0,
    revoked_at: null,
    revoked_reason: null,
    created_by: createdBy || null,
  }, { transaction });
}

async function prepareReplacementToken(memberId, createdBy = null) {
  return sequelize.transaction(async (transaction) => {
    const pending = await MemberCardTokenModel.findOne({
      where: { member_id: memberId, is_active: 0, revoked_at: null },
      order: [["id", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (pending) return { token: pending, created: false };

    const token = await createToken(memberId, createdBy, false, transaction);
    await writeAudit({
      memberId,
      tokenId: token.id,
      action: "replacement_prepared",
      actorId: createdBy,
      note: "Replacement QR prepared; the current physical-card QR remains active.",
      transaction,
    });
    return { token, created: true };
  });
}

async function activateReplacementToken(memberId, tokenId, createdBy = null) {
  return sequelize.transaction(async (transaction) => {
    const pending = await MemberCardTokenModel.findOne({
      where: { id: tokenId, member_id: memberId, is_active: 0, revoked_at: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!pending) throw new Error("Pending replacement QR not found or already processed.");

    const now = new Date();
    await MemberCardTokenModel.update({
      is_active: 0,
      revoked_at: now,
      revoked_reason: "replacement_activated",
    }, { where: { member_id: memberId, is_active: 1 }, transaction });
    await pending.update({ is_active: 1, revoked_at: null, revoked_reason: null }, { transaction });
    await writeAudit({
      memberId,
      tokenId: pending.id,
      action: "replacement_activated",
      actorId: createdBy,
      note: "Replacement QR activated; the previous physical-card QR was revoked.",
      transaction,
    });
    return pending;
  });
}

async function cancelReplacementToken(memberId, tokenId, createdBy = null) {
  return sequelize.transaction(async (transaction) => {
    const pending = await MemberCardTokenModel.findOne({
      where: { id: tokenId, member_id: memberId, is_active: 0, revoked_at: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!pending) throw new Error("Pending replacement QR not found or already processed.");

    await pending.update({ revoked_at: new Date(), revoked_reason: "replacement_cancelled" }, { transaction });
    await writeAudit({
      memberId,
      tokenId: pending.id,
      action: "replacement_cancelled",
      actorId: createdBy,
      note: "Pending replacement QR cancelled; the current physical-card QR remains active.",
      transaction,
    });
    return pending;
  });
}

async function restorePreviousToken(memberId, tokenId, createdBy = null) {
  return sequelize.transaction(async (transaction) => {
    const previous = await MemberCardTokenModel.findOne({
      where: { id: tokenId, member_id: memberId, is_active: 0, revoked_at: { [Op.ne]: null } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!previous) throw new Error("Previous QR token was not found.");
    if (previous.revoked_reason === "replacement_cancelled") {
      throw new Error("A cancelled, unissued replacement QR cannot be restored.");
    }

    const now = new Date();
    await MemberCardTokenModel.update({
      is_active: 0,
      revoked_at: now,
      revoked_reason: "previous_token_restored",
    }, { where: { member_id: memberId, is_active: 1 }, transaction });
    await previous.update({ is_active: 1, revoked_at: null, revoked_reason: null }, { transaction });
    await writeAudit({
      memberId,
      tokenId: previous.id,
      action: "previous_token_restored",
      actorId: createdBy,
      note: "Previous physical-card QR restored; the newer active QR was revoked.",
      transaction,
    });
    return previous;
  });
}

async function reissueMemberToken(memberId, createdBy = null) {
  return sequelize.transaction(async (transaction) => {
    const now = new Date();
    await MemberCardTokenModel.update({
      is_active: 0,
      revoked_at: now,
      revoked_reason: "lost_or_stolen_reissue",
    }, { where: { member_id: memberId, is_active: 1 }, transaction });

    const pendingTokens = await MemberCardTokenModel.findAll({
      where: { member_id: memberId, is_active: 0, revoked_at: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const token of pendingTokens) {
      await token.update({ revoked_at: now, revoked_reason: "replacement_cancelled" }, { transaction });
    }

    const token = await createToken(memberId, createdBy, true, transaction);
    await writeAudit({
      memberId,
      tokenId: token.id,
      action: "lost_or_stolen_reissue",
      actorId: createdBy,
      note: "Immediate replacement issued; every previous physical-card QR was revoked.",
      transaction,
    });
    return token;
  });
}

module.exports = {
  ensureActiveTokensForMembers,
  findActiveToken,
  getMemberQrBaseUrl,
  getOrCreateActiveMemberToken,
  hashToken,
  prepareReplacementToken,
  activateReplacementToken,
  cancelReplacementToken,
  restorePreviousToken,
  reissueMemberToken,
};
