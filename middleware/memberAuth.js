// NEW
const { extractBearerToken, verifyAccessToken } = require("../utils/memberJwt");

function requireMemberAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    const payload = verifyAccessToken(token);
    if (!payload?.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    req.authMemberId = String(payload.userId);
    return next();
  } catch (_) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}

module.exports = {
  requireMemberAuth,
};
