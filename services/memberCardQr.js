const crypto = require("crypto");
const { Op } = require("sequelize");
const { MemberCardTokenModel } = require("../models");

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

async function reissueMemberToken(memberId, createdBy = null) {
  await MemberCardTokenModel.update(
    { is_active: 0, revoked_at: new Date() },
    { where: { member_id: memberId, is_active: 1 } }
  );
  return getOrCreateActiveMemberToken(memberId, createdBy);
}

module.exports = {
  ensureActiveTokensForMembers,
  findActiveToken,
  getMemberQrBaseUrl,
  getOrCreateActiveMemberToken,
  hashToken,
  reissueMemberToken,
};
