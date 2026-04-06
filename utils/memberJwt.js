// NEW
const crypto = require("crypto");

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getRequiredSecret(envKey) {
  const primary = String(process.env[envKey] || "").trim();
  if (primary) return primary;

  // Backward-compat fallback keys to keep old deployments working.
  const legacyMap = {
    MEMBER_ACCESS_TOKEN_SECRET: "JWT_SECRET",
    MEMBER_REFRESH_TOKEN_SECRET: "REFRESH_SECRET",
  };

  const legacyKey = legacyMap[envKey];
  const legacySecret = legacyKey ? String(process.env[legacyKey] || "").trim() : "";
  if (legacySecret) return legacySecret;

  // Keep local/dev server alive when env is not configured.
  if (String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    return "DEV_INSECURE_MEMBER_JWT_SECRET_CHANGE_ME";
  }

  throw new Error(`${envKey} is missing. Please configure it in environment.`);
}

function signJwt(payloadObject, secret) {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify(payloadObject));
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");
  return `${unsignedToken}.${signature}`;
}

function verifyJwt(token, secret) {
  const tokenValue = String(token || "").trim();
  if (!tokenValue) return null;

  const parts = tokenValue.split(".");
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const unsignedToken = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  if (expectedSignature !== signaturePart) return null;

  try {
    return JSON.parse(decodeBase64Url(payloadPart));
  } catch (_) {
    return null;
  }
}

function extractBearerToken(req) {
  const authHeader = String(req.get("authorization") || "").trim();
  if (!authHeader) return "";

  const bearerPrefix = "Bearer ";
  if (!authHeader.startsWith(bearerPrefix)) return "";
  return authHeader.slice(bearerPrefix.length).trim();
}

function generateAccessToken({ userId }) {
  const memberId = Number(userId);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payloadObject = {
    sub: memberId,
    userId: memberId,
    type: "access",
    iat: nowInSeconds,
    exp: nowInSeconds + ACCESS_TOKEN_TTL_SECONDS,
  };

  return {
    token: signJwt(payloadObject, getRequiredSecret("MEMBER_ACCESS_TOKEN_SECRET")),
    expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
  };
}

function generateRefreshToken({ userId }) {
  const memberId = Number(userId);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payloadObject = {
    sub: memberId,
    userId: memberId,
    type: "refresh",
    iat: nowInSeconds,
    exp: nowInSeconds + REFRESH_TOKEN_TTL_SECONDS,
  };

  return {
    token: signJwt(payloadObject, getRequiredSecret("MEMBER_REFRESH_TOKEN_SECRET")),
    expiresInSeconds: REFRESH_TOKEN_TTL_SECONDS,
  };
}

function verifyTokenByType(token, expectedType, secretEnvKey) {
  const payload = verifyJwt(token, getRequiredSecret(secretEnvKey));
  if (!payload) return null;

  const exp = Number(payload.exp || 0);
  if (!exp || Date.now() >= exp * 1000) return null;
  if (String(payload.type || "") !== expectedType) return null;

  const userId = Number(payload.userId || payload.sub || 0);
  if (!userId) return null;

  return {
    userId,
    exp,
    iat: Number(payload.iat || 0),
    type: payload.type,
  };
}

function verifyAccessToken(token) {
  return verifyTokenByType(token, "access", "MEMBER_ACCESS_TOKEN_SECRET");
}

function verifyRefreshToken(token) {
  return verifyTokenByType(token, "refresh", "MEMBER_REFRESH_TOKEN_SECRET");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  extractBearerToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
