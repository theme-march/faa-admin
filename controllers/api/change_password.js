// UPDATED
const bcrypt = require("bcryptjs");
const { MemberModel } = require("../../models");

const BCRYPT_ROUNDS = Math.max(10, Number(process.env.BCRYPT_ROUNDS || 10));

function isBcryptHash(value = "") {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);
}

async function verifyPasswordAndMigrate(member, inputPassword) {
  const storedPassword = String(member?.password || "");
  const candidate = String(inputPassword || "");
  if (!storedPassword || !candidate) return false;

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(candidate, storedPassword);
  }

  const matched = storedPassword === candidate;
  if (matched && member?.id) {
    const hashed = await hashPassword(candidate);
    await MemberModel.update({ password: hashed }, { where: { id: member.id } }).catch(() => {});
    member.password = hashed;
  }

  return matched;
}

exports.changePassword = async (req, res) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      message: err?.original?.sqlMessage || err?.message || "Database error",
    });
  };

  const currentPassword = String(req.body.current_password || "");
  const newPassword = String(req.body.new_password || "");
  const confirmPassword = String(req.body.confirm_password || "");
  const authMemberId = String(req.authMemberId || req.body.member_id || "").trim();

  if (!authMemberId) {
    return res.status(401).json({ success: false, message: "Unauthorized request." });
  }

  if (!currentPassword) {
    return res.status(200).json({ success: false, message: "Current password empty " });
  }

  if (!newPassword) {
    return res.status(200).json({ success: false, message: "New password empty " });
  }

  if (newPassword.length < 6) {
    return res.status(200).json({ success: false, message: "Password must be at least 6 characters." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(200).json({ success: false, message: "Confirm password not match " });
  }

  let result = await MemberModel.findOne({ where: { id: authMemberId } }).catch(errorHandler);

  if (!result) {
    return res.status(200).json({ success: false, message: "Member not found " });
  }

  const currentOk = await verifyPasswordAndMigrate(result, currentPassword);
  if (!currentOk) {
    return res.status(200).json({ success: false, message: "Current password not correct " });
  }

  const hashedPassword = await hashPassword(newPassword);
  await MemberModel.update(
    {
      password: hashedPassword,
      refresh_token_hash: null,
      refresh_token_expires_at: null,
    },
    { where: { id: authMemberId } }
  ).catch(errorHandler);

  return res.status(200).json({ success: true, message: "Password update successfully! " });
};
