const fs = require("fs");
const path = require("path");
const moment = require("moment");
const { QueryTypes } = require("sequelize");
const { sequelize, EventRegisterModel } = require("../models");
const {
  getOrCreateSettings,
  DEFAULT_SETTINGS,
} = require("../controllers/event_invoice_settings/EventInvoiceSettings");
const { getEventOverride } = require("./eventInvoiceEventOverrides");

function requireOptionalPackage(name) {
  try {
    return require(name);
  } catch (error) {
    throw new Error(`Missing package "${name}". Run npm install ${name} in faaw_admin.`);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(amount) {
  const numericAmount = Number(amount || 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function normalizeTextToHtml(text) {
  return escapeHtml(text || "").replace(/\r?\n/g, "<br>");
}

function generateEntryPasscode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function ensureRegistrationEntryPasscode(registration) {
  if (!registration?.id) return registration;
  const existing = String(registration.entry_passcode || "").trim();
  if (existing) return registration;

  const generated = generateEntryPasscode();
  await EventRegisterModel.update(
    { entry_passcode: generated },
    { where: { id: registration.id } }
  ).catch(() => {});
  return { ...registration, entry_passcode: generated };
}

function toBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function normalizeUrlBase(url, fallback) {
  const value = String(url || "").trim();
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

function resolveQrBaseUrl(settings) {
  const liveFrontendQrBaseUrl = "https://faa-dubd.org/event/enter?id=";
  const legacyLiveQrBaseUrl = "https://faa-dubd.org/event/enter?id=";
  const legacyLocalFrontendQrBaseUrl = "http://localhost:3001/event/enter?id=";
  const siteBase = normalizeUrlBase(
    settings.site_url || process.env.FRONTEND_BASE_URL || "https://faa-dubd.org" || process.env.SITE_URL || "",
    "https://faa-dubd.org"
  );
  const fallbackQrBaseUrl = `${siteBase}/event/enter?id=`;
  const configuredQrBaseUrl = String(settings.qr_base_url || "").trim();

  if (
    !configuredQrBaseUrl ||
    configuredQrBaseUrl === legacyLiveQrBaseUrl ||
    configuredQrBaseUrl === legacyLocalFrontendQrBaseUrl
  ) {
    return fallbackQrBaseUrl || liveFrontendQrBaseUrl;
  }

  return configuredQrBaseUrl;
}

function buildLineItems(registration) {
  const membershipRenewFees = Number(registration.membership_renew_fees || 0);
  const deliveryCharge = Number(registration.delivery_charge || 0);
  const payAmount = Number(registration.pay_amount || 0);
  const eventFeeAmount = Math.max(payAmount - membershipRenewFees - deliveryCharge, 0);
  const lineItems = [];

  if (membershipRenewFees > 0) {
    lineItems.push({ label: "Annual Membership", amount: membershipRenewFees });
  }

  if (eventFeeAmount > 0) {
    lineItems.push({
      label: registration.participation_type || "Event Subscription Fee",
      amount: eventFeeAmount,
    });
  }

  if (deliveryCharge > 0) {
    lineItems.push({ label: "Delivery Charge", amount: deliveryCharge });
  }

  if (!lineItems.length) {
    lineItems.push({
      label: registration.participation_type || "Event Registration Fee",
      amount: payAmount,
    });
  }

  return lineItems;
}

function replaceTemplateTokens(template, registration) {
  const tokens = {
    full_name: registration.full_name,
    event_title: registration.event_title,
    event_date: registration.event_date ? moment(registration.event_date).format("lll") : "",
    member_type: registration.member_type,
    pay_amount: formatAmount(registration.pay_amount),
    tx_tran_id: registration.tx_tran_id,
  };

  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return tokens[key] ?? "";
  });
}

function resolveLogoPath(logoPath) {
  const cleanedPath = String(logoPath || "").trim();
  if (!cleanedPath) return null;
  if (path.isAbsolute(cleanedPath)) return cleanedPath;
  return path.join(__dirname, "..", cleanedPath);
}

function readLogoBase64(logoPath) {
  const absoluteLogoPath = resolveLogoPath(logoPath);
  if (!absoluteLogoPath || !fs.existsSync(absoluteLogoPath)) return "";
  const ext = path.extname(absoluteLogoPath).toLowerCase() === ".png" ? "png" : "jpeg";
  return `data:image/${ext};base64,${fs.readFileSync(absoluteLogoPath).toString("base64")}`;
}

function buildInvoiceHtml(registration, settings, qrCodeBase64, logoBase64) {
  const lineItems = buildLineItems(registration);
  const invoiceTitle = escapeHtml(settings.invoice_title || DEFAULT_SETTINGS.invoice_title);
  const contactDetails = escapeHtml(settings.contact_details || "");
  const paymentDate = registration.tx_tran_date ? escapeHtml(registration.tx_tran_date) : "-";
  const paymentType = registration.payment_type ? escapeHtml(registration.payment_type) : "-";
  const accountNumber = registration.card_no ? escapeHtml(registration.card_no) : "-";
  const entryPasscode = registration.entry_passcode ? escapeHtml(registration.entry_passcode) : "-";
  const eventDate = registration.event_date ? escapeHtml(moment(registration.event_date).format("lll")) : "-";
  const memberType = registration.member_type ? escapeHtml(registration.member_type) : "Guest";
  const lineItemsHtml = lineItems.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td class="cs-text-right">${formatAmount(item.amount)}</td>
      </tr>
    `).join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Event Registration Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1f2937; max-width: 800px; margin: auto; }
        h5 { font-size: 26px; margin: 0; }
        .cs-height20 { height: 20px; }
        .cs-height10 { height: 10px; }
        .cs-height-50 { height: 50px; }
        .cs-invoice-header { width: 100%; }
        .row { display: flex; justify-content: space-between; gap: 24px; }
        .cs-width130 { width: 150px; }
        .cs-width20 { width: 12px; text-align: center; }
        .cs-width265 { width: 300px; }
        .width100 { width: 100%; }
        table { border-collapse: collapse; width: 100%; }
        td { text-align: left; padding: 8px; font-size: 15px; border-bottom: 1px solid #ececec; vertical-align: top; }
        .the-qr td { border: 1px solid #ececec; text-align: center; }
        .cs-invo-bottom td { border: none; }
        .cs-border { border-top: 1px solid #252525; border-bottom: 1px solid #252525; }
        .cs-bordertop { border-top: 1px solid #252525; width: 100%; }
        .cs-borderbottom { border-bottom: 1px solid #252525; width: 100%; }
        .invo-banner-logo { display: block; width: 100%; height: auto; object-fit: cover; }
        .cs-text-right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="cs-height-50"></div>
      <header class="cs-invoice-header">
        ${logoBase64 ? `<img class="invo-banner-logo" src="${logoBase64}" alt="Logo">` : ""}
      </header>
      <div class="cs-height20"></div>
      <h5>${invoiceTitle}</h5>
      <div class="cs-height10"></div>
      <div class="cs-bordertop"></div>

      <div class="row width100">
        <div style="flex:1;">
          <table>
            <tr>
              <td class="cs-width130">Event Name</td>
              <td class="cs-width20">:</td>
              <td class="cs-width265">${escapeHtml(registration.event_title || "")}</td>
            </tr>
            <tr>
              <td class="cs-width130">Date</td>
              <td class="cs-width20">:</td>
              <td class="cs-width265">${eventDate}</td>
            </tr>
            <tr>
              <td class="cs-width130">Participant Name</td>
              <td class="cs-width20">:</td>
              <td class="cs-width265">${escapeHtml(registration.full_name || "")}</td>
            </tr>
            <tr>
              <td class="cs-width130">Membership Type</td>
              <td class="cs-width20">:</td>
              <td>${memberType}</td>
            </tr>
            <tr>
              <td class="cs-width130">Entry Password</td>
              <td class="cs-width20">:</td>
              <td>${entryPasscode}</td>
            </tr>
          </table>
        </div>
        <div style="width:260px;">
          <table class="the-qr width100">
            <tr>
              <td>
                <h3>Scan QR Code for Details</h3>
                <img src="${qrCodeBase64}" alt="QR Code">
              </td>
            </tr>
          </table>
        </div>
      </div>

      <table class="width100">
        <tr>
          <td class="cs-width130">Contact details</td>
          <td class="cs-width20">:</td>
          <td>${contactDetails}</td>
        </tr>
      </table>

      <table class="width100">
        <tr>
          <td class="cs-width130">Payment Date</td>
          <td class="cs-width20">:</td>
          <td class="cs-width265">${paymentDate}</td>
          <td>Payment type</td>
          <td class="cs-width20">:</td>
          <td class="cs-text-right">${paymentType}</td>
        </tr>
        <tr>
          <td class="cs-width130">Card/Account Number</td>
          <td class="cs-width20">:</td>
          <td>${accountNumber}</td>
          <td>Currency</td>
          <td class="cs-width20">:</td>
          <td class="cs-text-right">BDT</td>
        </tr>
      </table>
      <div class="cs-borderbottom"></div>

      <div class="cs-height-50"></div>

      <table class="width100 cs-invo-bottom">
        <tr class="cs-border">
          <td><b>Description</b></td>
          <td class="cs-text-right"><b>Amount</b></td>
        </tr>
        ${lineItemsHtml}
        <tr class="cs-border">
          <td class="cs-text-right"><b>Total amount paid</b></td>
          <td class="cs-text-right"><b>${formatAmount(registration.pay_amount)}</b></td>
        </tr>
      </table>
      <div class="cs-border"></div>
    </body>
    </html>
  `;
}

async function getRegistrationDetails(registrationId) {
  const rows = await sequelize.query(
    `
      SELECT er.*, e.event_title, e.event_date, e.event_venue
      FROM event_register er
      INNER JOIN event_list e ON er.event_id = e.id
      WHERE er.id = :registrationId
      LIMIT 1
    `,
    {
      replacements: { registrationId },
      type: QueryTypes.SELECT,
    }
  );

  return rows[0] || null;
}

async function resolveInvoiceSettings(settings) {
  if (settings && typeof settings === "object") {
    return {
      ...DEFAULT_SETTINGS,
      ...(settings.get ? settings.get({ plain: true }) : settings),
    };
  }

  const settingsRecord = await getOrCreateSettings();
  return {
    ...DEFAULT_SETTINGS,
    ...(settingsRecord?.get ? settingsRecord.get({ plain: true }) : settingsRecord),
  };
}

async function generateEventRegistrationInvoicePdf(registration, settings) {
  const puppeteer = requireOptionalPackage("puppeteer");
  const QRCode = requireOptionalPackage("qrcode");
  const resolvedSettings = await resolveInvoiceSettings(settings);
  const invoicesDir = path.join(__dirname, "..", "public", "invoices");

  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const preparedRegistration = await ensureRegistrationEntryPasscode(registration);
  const pdfPath = path.join(invoicesDir, `invoice_${preparedRegistration.id}.pdf`);
  const qrBaseUrl = resolveQrBaseUrl(resolvedSettings);
  const qrCodeBase64 = await QRCode.toDataURL(`${qrBaseUrl}${preparedRegistration.id}`);
  const eventOverride = getEventOverride(preparedRegistration.event_id) || {};
  const effectiveInvoiceSettings = {
    ...resolvedSettings,
    invoice_title: String(eventOverride.invoice_title || "").trim() || resolvedSettings.invoice_title,
    contact_details: String(eventOverride.contact_details || "").trim() || resolvedSettings.contact_details,
    logo_path: String(eventOverride.logo_path || "").trim() || resolvedSettings.logo_path,
  };

  const configuredLogoPath = effectiveInvoiceSettings.logo_path || DEFAULT_SETTINGS.logo_path;
  let logoBase64 = readLogoBase64(configuredLogoPath);
  if (!logoBase64) {
    logoBase64 = readLogoBase64(DEFAULT_SETTINGS.logo_path);
  }
  const htmlContent = buildInvoiceHtml(preparedRegistration, effectiveInvoiceSettings, qrCodeBase64, logoBase64);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, scale: 0.9 });
    return pdfPath;
  } finally {
    await browser.close();
  }
}

async function sendEventRegistrationInvoice(registrationId, options = {}) {
  const settingsRecord = await getOrCreateSettings();
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(settingsRecord?.get ? settingsRecord.get({ plain: true }) : settingsRecord),
  };

  if (String(settings.status) !== "1") {
    throw new Error("Event invoice email setup is inactive.");
  }

  if (!options.force && String(settings.auto_send_status) !== "1") {
    return { success: false, skipped: true, message: "Auto send is disabled." };
  }

  const registration = await getRegistrationDetails(registrationId);
  if (!registration) throw new Error("Registration not found.");
  if (Number(registration.is_pay) !== 1) throw new Error("Registration is not paid yet.");
  if (!registration.email_address) throw new Error("Registration email address is empty.");

  const nodemailer = requireOptionalPackage("nodemailer");
  const pdfPath = await generateEventRegistrationInvoicePdf(registration, settings);
  const secureTransport = toBooleanFlag(
    settings.smtp_secure,
    Number(settings.smtp_port || 465) === 465
  );
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port || 465),
    secure: secureTransport,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });

  const subject = replaceTemplateTokens(settings.email_subject, registration);
  const bodyText = replaceTemplateTokens(settings.email_body, registration);

  try {
    await transporter.sendMail({
      from: settings.from_name ? `"${settings.from_name}" <${settings.from_email}>` : settings.from_email,
      replyTo: settings.reply_to_email || settings.from_email,
      to: registration.email_address,
      subject,
      text: bodyText,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.7;">${normalizeTextToHtml(bodyText)}</div>`,
      attachments: [
        {
          filename: `invoice_${registration.id}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    await EventRegisterModel.update({ email_status: "sent" }, { where: { id: registration.id } });
    return { success: true };
  } catch (error) {
    await EventRegisterModel.update({ email_status: "failed" }, { where: { id: registration.id } });
    throw error;
  }
}

module.exports = {
  sendEventRegistrationInvoice,
  generateEventRegistrationInvoicePdf,
  getRegistrationDetails,
};




