const fs = require("fs");
const path = require("path");
const {
  DEFAULT_LOGO_PATH,
  DEFAULT_SETTINGS,
  getOrCreateSettings,
  getSettings,
  normalizeBaseUrl,
  normalizeLogoPath,
} = require("../services/membershipInvoiceSettings");
const {
  buildMembershipInvoicePreviewHtml,
} = require("../services/membershipInvoiceTemplate");

exports.edit_from = async (req, res) => {
  try {
    const settings = await getSettings();
    const previewHtml = await buildMembershipInvoicePreviewHtml();

    res.render("membership_invoice_settings", {
      ...DEFAULT_SETTINGS,
      ...settings,
      preview_html: previewHtml,
      default_logo_path: DEFAULT_LOGO_PATH,
    });
  } catch (error) {
    req.flash("error", error.original?.sqlMessage || error.message);
    return res.redirect("/dashboard");
  }
};

exports.edit = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const normalizeFlag = (value, defaultValue = 0) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      const normalized = String(value).trim().toLowerCase();
      return ["1", "true", "yes", "on"].includes(normalized) ? 1 : 0;
    };

    let nextLogoPath = normalizeLogoPath(req.body.logo_path, settings.logo_path);
    const logoFile = req.file || null;

    if (logoFile && logoFile.path) {
      const appRoot = path.join(__dirname, "..");
      const absoluteUploadPath = path.resolve(logoFile.path);
      if (fs.existsSync(absoluteUploadPath)) {
        nextLogoPath = path.relative(appRoot, absoluteUploadPath).replace(/\\/g, "/");
      }
    }

    await settings.update({
      status: normalizeFlag(req.body.status, 1),
      auto_send_status: normalizeFlag(req.body.auto_send_status, 1),
      smtp_host: String(req.body.smtp_host || "").trim() || DEFAULT_SETTINGS.smtp_host,
      smtp_port: Number(req.body.smtp_port || DEFAULT_SETTINGS.smtp_port) || DEFAULT_SETTINGS.smtp_port,
      smtp_secure: normalizeFlag(req.body.smtp_secure, 1),
      smtp_user: String(req.body.smtp_user || "").trim() || DEFAULT_SETTINGS.smtp_user,
      smtp_pass: String(req.body.smtp_pass || "").trim() || DEFAULT_SETTINGS.smtp_pass,
      from_name: String(req.body.from_name || "").trim() || DEFAULT_SETTINGS.from_name,
      from_email: String(req.body.from_email || "").trim() || DEFAULT_SETTINGS.from_email,
      reply_to_email:
        String(req.body.reply_to_email || "").trim() || DEFAULT_SETTINGS.reply_to_email,
      email_subject:
        String(req.body.email_subject || "").trim() || DEFAULT_SETTINGS.email_subject,
      email_body: String(req.body.email_body || "").trim() || DEFAULT_SETTINGS.email_body,
      invoice_title: String(req.body.invoice_title || "").trim() || DEFAULT_SETTINGS.invoice_title,
      invoice_subtitle:
        String(req.body.invoice_subtitle || "").trim() || DEFAULT_SETTINGS.invoice_subtitle,
      contact_details:
        String(req.body.contact_details || "").trim() || DEFAULT_SETTINGS.contact_details,
      logo_path: normalizeLogoPath(nextLogoPath),
      site_url: normalizeBaseUrl(req.body.site_url, DEFAULT_SETTINGS.site_url),
    });

    req.flash("success", "Membership invoice settings updated successfully!");
    return res.redirect("/membership-invoice-settings");
  } catch (error) {
    req.flash("error", error.original?.sqlMessage || error.message);
    return res.redirect("/membership-invoice-settings");
  }
};
