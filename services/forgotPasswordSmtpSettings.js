const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "..", "storage");
const SETTINGS_FILE = path.join(STORAGE_DIR, "forgot-password-smtp-settings.json");

const DEFAULT_FORGOT_PASSWORD_SMTP_SETTINGS = {
  status: 1,
  smtp_host: "mail.privateemail.com",
  smtp_port: 465,
  smtp_secure: 1,
  smtp_user: "event.registration@faa-dubd.org",
  smtp_pass: 'uDTN"t6{K2hp',
  from_name: "FAA Team",
  from_email: "event.registration@faa-dubd.org",
  reply_to_email: "event.registration@faa-dubd.org",
  email_subject: "Password Reset Request",
  email_body:
    "Hello {{member_name}},\n\nWe received a request to reset your password.\n\nReset link:\n{{reset_url}}\n\nThis link will expire in 30 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nFAA Team",
};

function normalizeFlag(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized) ? 1 : 0;
}

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(DEFAULT_FORGOT_PASSWORD_SMTP_SETTINGS, null, 2),
      "utf8"
    );
  }
}

function getSettings() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      ...DEFAULT_FORGOT_PASSWORD_SMTP_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch (error) {
    return { ...DEFAULT_FORGOT_PASSWORD_SMTP_SETTINGS };
  }
}

function saveSettings(payload = {}) {
  ensureStorage();
  const current = getSettings();
  const nextValue = {
    ...current,
    status: normalizeFlag(payload.status, current.status),
    smtp_host: String(payload.smtp_host || "").trim(),
    smtp_port: Number(payload.smtp_port) || 465,
    smtp_secure: normalizeFlag(payload.smtp_secure, current.smtp_secure),
    smtp_user: String(payload.smtp_user || "").trim(),
    smtp_pass: String(payload.smtp_pass || "").trim(),
    from_name: String(payload.from_name || "").trim(),
    from_email: String(payload.from_email || "").trim(),
    reply_to_email: String(payload.reply_to_email || "").trim(),
    email_subject: String(payload.email_subject || "").trim(),
    email_body: String(payload.email_body || "").trim(),
    updated_at: new Date().toISOString(),
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nextValue, null, 2), "utf8");
  return nextValue;
}

module.exports = {
  DEFAULT_FORGOT_PASSWORD_SMTP_SETTINGS,
  getSettings,
  saveSettings,
};
