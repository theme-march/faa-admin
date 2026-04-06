const fs = require("fs");
const path = require("path");
const { EventInvoiceSettingModel, EventModel } = require("../../models");
const {
  readOverrides,
  saveEventOverride,
} = require("../../services/eventInvoiceEventOverrides");

const LEGACY_LIVE_SITE_URL = "https://faa-dubd.org";
const LEGACY_LIVE_QR_BASE_URL = "https://faa-dubd.org/event/enter?id=";
const LEGACY_LOCAL_FRONTEND_QR_BASE_URL = "http://localhost:3001/event/enter?id=";

function normalizeBaseUrl(url, fallback) {
  const value = String(url || "").trim();
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

function buildQrBaseUrlFromSite(siteUrl) {
  return `${normalizeBaseUrl(siteUrl, "http://localhost:3000")}/event/enter?id=`;
}

function shouldRepairLegacyQrBaseUrl(settings) {
  const qrBaseUrl = String(settings.qr_base_url || "").trim();

  if (!qrBaseUrl) return true;
  if (qrBaseUrl === LEGACY_LIVE_QR_BASE_URL) return true;
  if (qrBaseUrl === LEGACY_LOCAL_FRONTEND_QR_BASE_URL) return true;

  return false;
}

const DEFAULT_SITE_URL = normalizeBaseUrl(
  process.env.BACKEND_BASE_URL || process.env.SITE_URL,
  "http://localhost:3000"
);
const DEFAULT_LOGO_PATH = "public/global_assets/images/banner-logo.jpg";

const DEFAULT_SETTINGS = {
  status: 1,
  auto_send_status: 1,
  smtp_host: "mail.privateemail.com",
  smtp_port: 465,
  smtp_secure: 1,
  smtp_user: "event.registration@faa-dubd.org",
  smtp_pass: 'uDTN"t6{K2hp',
  from_name: "Event Team",
  from_email: "event.registration@faa-dubd.org",
  reply_to_email: "event.registration@faa-dubd.org",
  email_subject: "Event Invoice",
  email_body: "Hello {{full_name}},\r\n\r\nThank you for registering for {{event_title}}. Your invoice is attached.\r\n\r\nBest regards,\r\nEvent Team",
  invoice_title: "Entry Pass | Welcome",
  contact_details: "Bangladesh | 01678141350 | Rahman.mushfique@gmail.com",
  qr_base_url: buildQrBaseUrlFromSite(DEFAULT_SITE_URL),
  logo_path: DEFAULT_LOGO_PATH,
  site_url: DEFAULT_SITE_URL,
};

function normalizeLogoPath(value, fallback = DEFAULT_LOGO_PATH) {
  const nextValue = String(value || "").trim();
  return nextValue || fallback;
}

function toPublicAssetUrl(filePath) {
  const normalized = String(filePath || "")
    .trim()
    .replace(/\\/g, "/");

  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;

  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return withLeadingSlash.replace(/^\/public\//, "/");
}

async function getOrCreateSettings() {
  let settings = await EventInvoiceSettingModel.findOne({ order: [["id", "ASC"]] });

  if (!settings) {
    settings = await EventInvoiceSettingModel.create(DEFAULT_SETTINGS);
    return settings;
  }

  const plain = settings.get({ plain: true });
  if (shouldRepairLegacyQrBaseUrl(plain)) {
    const nextSiteUrl = plain.site_url === LEGACY_LIVE_SITE_URL ? DEFAULT_SITE_URL : (plain.site_url || DEFAULT_SITE_URL);
    const nextQrBaseUrl = buildQrBaseUrlFromSite(nextSiteUrl);
    await settings.update({
      site_url: normalizeBaseUrl(nextSiteUrl, DEFAULT_SITE_URL),
      qr_base_url: nextQrBaseUrl,
    });
  }

  return settings;
}

exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
exports.getOrCreateSettings = getOrCreateSettings;
exports.edit_from = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const events = await EventModel.findAll({
      attributes: ["id", "event_title"],
      order: [["event_title", "ASC"]],
      raw: true,
    });
    const eventOverrides = readOverrides();
    const normalizedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings.get({ plain: true }),
    };
    normalizedSettings.logo_path = normalizeLogoPath(normalizedSettings.logo_path);
    normalizedSettings.logo_preview_url = toPublicAssetUrl(normalizedSettings.logo_path);

    res.render("event_invoice_settings/index", {
      ...normalizedSettings,
      events,
      event_overrides: eventOverrides,
    });
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    return res.redirect("/dashboard");
  }
};

exports.edit = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const saveMode = String(req.body.save_mode || "global").trim().toLowerCase();
    const normalizeFlag = (value, defaultValue = 0) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      const normalized = String(value).trim().toLowerCase();
      return ["1", "true", "yes", "on"].includes(normalized) ? 1 : 0;
    };

    const globalLogoFile = req.files?.invoiceLogoFile?.[0] || null;
    const eventLogoFile = req.files?.eventLogoFile?.[0] || null;

    if (saveMode === "event") {
      const eventId = String(req.body.event_override_event_id || "").trim();
      if (!eventId) {
        req.flash("error", "Please select an event for event-wise invoice design.");
        return res.redirect("/event-invoice-settings");
      }

      const allOverrides = readOverrides();
      const existingEventOverride = allOverrides[eventId] || {};

      let nextEventLogoPath = normalizeLogoPath(req.body.event_override_logo_path || "", "");
      if (!nextEventLogoPath && existingEventOverride.logo_path) {
        nextEventLogoPath = String(existingEventOverride.logo_path);
      }

      if (eventLogoFile && eventLogoFile.path) {
        const appRoot = path.join(__dirname, "..", "..");
        const absoluteUploadPath = path.resolve(eventLogoFile.path);
        if (fs.existsSync(absoluteUploadPath)) {
          nextEventLogoPath = path.relative(appRoot, absoluteUploadPath).replace(/\\/g, "/");
        }
      }

      saveEventOverride(eventId, {
        invoice_title: String(req.body.event_override_invoice_title || "").trim(),
        contact_details: String(req.body.event_override_contact_details || "").trim(),
        logo_path: nextEventLogoPath,
      });

      req.flash("success", "Event-wise invoice design updated successfully!");
      return res.redirect("/event-invoice-settings");
    }

    let nextLogoPath = normalizeLogoPath(req.body.logo_path, normalizeLogoPath(settings.logo_path));

    if (globalLogoFile && globalLogoFile.path) {
      const appRoot = path.join(__dirname, "..", "..");
      const absoluteUploadPath = path.resolve(globalLogoFile.path);
      if (fs.existsSync(absoluteUploadPath)) {
        nextLogoPath = path.relative(appRoot, absoluteUploadPath).replace(/\\/g, "/");
      }
    }

    await EventInvoiceSettingModel.update(
      {
        status: normalizeFlag(req.body.status, 1),
        auto_send_status: normalizeFlag(req.body.auto_send_status, 1),
        smtp_host: req.body.smtp_host,
        smtp_port: req.body.smtp_port,
        smtp_secure: normalizeFlag(req.body.smtp_secure, 1),
        smtp_user: req.body.smtp_user,
        smtp_pass: req.body.smtp_pass,
        from_name: req.body.from_name,
        from_email: req.body.from_email,
        reply_to_email: req.body.reply_to_email,
        email_subject: req.body.email_subject,
        email_body: req.body.email_body,
        invoice_title: req.body.invoice_title,
        contact_details: req.body.contact_details,
        qr_base_url: req.body.qr_base_url,
        logo_path: normalizeLogoPath(nextLogoPath),
        site_url: req.body.site_url,
      },
      { where: { id: settings.id } }
    );

    req.flash("success", "Event invoice email settings updated successfully!");
    return res.redirect("/event-invoice-settings");
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    return res.redirect("/event-invoice-settings");
  }
};
