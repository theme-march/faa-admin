const fs = require("fs");
const path = require("path");
const { MembershipInvoiceSettingModel } = require("../models");

const LIVE_FRONTEND_URL = "https://faa-dubd.org";
const LEGACY_LOCAL_SITE_URLS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://localhost:3000",
  "https://localhost:3001",
]);

const DEFAULT_SITE_URL = String(
  process.env.FRONTEND_BASE_URL || LIVE_FRONTEND_URL || process.env.SITE_URL
)
  .trim()
  .replace(/\/+$/, "");

const DEFAULT_LOGO_PATH = "public/global_assets/images/banner-logo.jpg";

const DEFAULT_SETTINGS = {
  status: 1,
  auto_send_status: 1,
  smtp_host: "mail.privateemail.com",
  smtp_port: 465,
  smtp_secure: 1,
  smtp_user: "event.registration@faa-dubd.org",
  smtp_pass: 'uDTN"t6{K2hp',
  from_name: "Membership Team",
  from_email: "event.registration@faa-dubd.org",
  reply_to_email: "event.registration@faa-dubd.org",
  email_subject: "Membership Payment Invoice",
  email_body:
    "Hello {{full_name}},\r\n\r\nThank you for completing your membership payment. Your invoice is attached.\r\n\r\nBest regards,\r\nMembership Team",
  invoice_title: "Membership Payment Invoice",
  invoice_subtitle: "Official payment receipt",
  contact_details: "Bangladesh | 01678141350 | Rahman.mushfique@gmail.com",
  logo_path: DEFAULT_LOGO_PATH,
  site_url: DEFAULT_SITE_URL,
};

const COLUMN_PATCHES = [
  "ALTER TABLE membership_invoice_settings ADD COLUMN auto_send_status TINYINT(1) NULL DEFAULT 1 AFTER status",
  "ALTER TABLE membership_invoice_settings ADD COLUMN smtp_host VARCHAR(255) NULL DEFAULT 'mail.privateemail.com' AFTER auto_send_status",
  "ALTER TABLE membership_invoice_settings ADD COLUMN smtp_port INT NULL DEFAULT 465 AFTER smtp_host",
  "ALTER TABLE membership_invoice_settings ADD COLUMN smtp_secure TINYINT(1) NULL DEFAULT 1 AFTER smtp_port",
  "ALTER TABLE membership_invoice_settings ADD COLUMN smtp_user VARCHAR(255) NULL DEFAULT 'event.registration@faa-dubd.org' AFTER smtp_secure",
  "ALTER TABLE membership_invoice_settings ADD COLUMN smtp_pass VARCHAR(255) NULL DEFAULT 'uDTN\"t6{K2hp' AFTER smtp_user",
  "ALTER TABLE membership_invoice_settings ADD COLUMN from_name VARCHAR(255) NULL DEFAULT 'Membership Team' AFTER smtp_pass",
  "ALTER TABLE membership_invoice_settings ADD COLUMN from_email VARCHAR(255) NULL DEFAULT 'event.registration@faa-dubd.org' AFTER from_name",
  "ALTER TABLE membership_invoice_settings ADD COLUMN reply_to_email VARCHAR(255) NULL DEFAULT 'event.registration@faa-dubd.org' AFTER from_email",
  "ALTER TABLE membership_invoice_settings ADD COLUMN email_subject VARCHAR(255) NULL DEFAULT 'Membership Payment Invoice' AFTER reply_to_email",
  "ALTER TABLE membership_invoice_settings ADD COLUMN email_body LONGTEXT NULL AFTER email_subject",
];

function normalizeLogoPath(value, fallback = DEFAULT_LOGO_PATH) {
  const nextValue = String(value || "").trim();
  return nextValue || fallback;
}

function normalizeBaseUrl(url, fallback = DEFAULT_SITE_URL) {
  const value = String(url || "").trim();
  if (!value) return fallback;
  const normalized = value.replace(/\/+$/, "");
  if (LEGACY_LOCAL_SITE_URLS.has(normalized)) {
    return fallback;
  }
  return normalized;
}

function toPublicAssetUrl(filePath) {
  const normalized = String(filePath || "")
    .trim()
    .replace(/\\/g, "/");

  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return withLeadingSlash.replace(/^\/public\//, "/");
}

function resolveAbsoluteLogoPath(filePath) {
  const normalized = normalizeLogoPath(filePath);
  const appRoot = path.join(__dirname, "..");
  return path.resolve(appRoot, normalized);
}

function readLogoAsBase64(filePath) {
  const absoluteLogoPath = resolveAbsoluteLogoPath(filePath);
  if (!fs.existsSync(absoluteLogoPath)) return "";

  const extension = path.extname(absoluteLogoPath).toLowerCase();
  const mimeType = extension === ".png"
    ? "image/png"
    : extension === ".svg"
      ? "image/svg+xml"
      : "image/jpeg";

  return `data:${mimeType};base64,${fs.readFileSync(absoluteLogoPath).toString("base64")}`;
}

async function getOrCreateSettings() {
  await MembershipInvoiceSettingModel.sync();
  for (const sql of COLUMN_PATCHES) {
    try {
      await MembershipInvoiceSettingModel.sequelize.query(sql);
    } catch (error) {
      const message = String(error?.original?.sqlMessage || error?.message || "").toLowerCase();
      if (
        !message.includes("duplicate column") &&
        !message.includes("exists")
      ) {
        throw error;
      }
    }
  }

  let settings = await MembershipInvoiceSettingModel.findOne({
    order: [["id", "ASC"]],
  });

  if (!settings) {
    settings = await MembershipInvoiceSettingModel.create(DEFAULT_SETTINGS);
  } else {
    const plainSettings = settings.get({ plain: true });
    const normalizedSiteUrl = normalizeBaseUrl(plainSettings.site_url, DEFAULT_SITE_URL);
    if (normalizedSiteUrl !== String(plainSettings.site_url || "").trim()) {
      await settings.update({ site_url: normalizedSiteUrl });
    }
  }

  return settings;
}

async function getSettings() {
  const settings = await getOrCreateSettings();
  const normalizedSettings = {
    ...DEFAULT_SETTINGS,
    ...settings.get({ plain: true }),
  };

  normalizedSettings.logo_path = normalizeLogoPath(normalizedSettings.logo_path);
  normalizedSettings.site_url = normalizeBaseUrl(normalizedSettings.site_url);
  normalizedSettings.logo_preview_url = toPublicAssetUrl(normalizedSettings.logo_path);

  return normalizedSettings;
}

module.exports = {
  DEFAULT_LOGO_PATH,
  DEFAULT_SETTINGS,
  getOrCreateSettings,
  getSettings,
  normalizeBaseUrl,
  normalizeLogoPath,
  readLogoAsBase64,
  toPublicAssetUrl,
};
