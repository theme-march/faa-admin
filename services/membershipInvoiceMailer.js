const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const { MemberShipPaymentModel, MemberModel, sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
const {
  DEFAULT_SETTINGS,
  getOrCreateSettings,
} = require("./membershipInvoiceSettings");
const {
  buildMembershipInvoiceHtml,
  buildMembershipInvoiceRenderModel,
} = require("./membershipInvoiceTemplate");

function formatMembershipAmount(value) {
  const numericAmount = Number(String(value || "").replace(/,/g, ""));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}

function normalizeTextToHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}

function toBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function replaceTemplateTokens(template, payment, member) {
  const tokens = {
    full_name: payment.name || member?.name || "",
    membership_number: member?.membership_number || payment.membership_number || "",
    member_type: payment.membership_category || member?.category_name || "",
    organization_name: payment.organization_name || member?.organization_name || "",
    pay_amount: formatMembershipAmount(payment.pay_amount),
    tx_tran_id: payment.tx_tran_id || payment.id || "",
    payment_date: payment.tx_tran_date || "",
  };

  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return tokens[key] ?? "";
  });
}

async function getMembershipPaymentDetails(paymentId) {
  const rows = await sequelize.query(
    `
      SELECT
        mp.*,
        ml.membership_number,
        ml.organization_name AS member_organization_name,
        cl.category_name AS membership_category
      FROM member_ship_payments mp
      LEFT JOIN member_list ml
        ON ml.id = mp.member_id
      LEFT JOIN category_list cl
        ON cl.id = ml.membership_category_id
      WHERE mp.id = :paymentId
      LIMIT 1
    `,
    {
      replacements: { paymentId },
      type: QueryTypes.SELECT,
    }
  );

  return rows[0] || null;
}

async function getMembershipOwner(memberId) {
  if (!memberId) return null;

  return MemberModel.findOne({
    where: { id: memberId },
    raw: true,
  });
}

async function generateMembershipPaymentInvoicePdf(payment, viewerMember) {
  const invoicesDir = path.join(__dirname, "..", "public", "membershippayment");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const renderModel = await buildMembershipInvoiceRenderModel(payment, viewerMember);
  const html = buildMembershipInvoiceHtml(renderModel);
  const pdfPath = path.join(invoicesDir, `membership_invoice_${payment.id}.pdf`);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      scale: 0.95,
    });
    return pdfPath;
  } finally {
    await browser.close();
  }
}

async function sendMembershipPaymentInvoice(paymentId, options = {}) {
  const settingsRecord = await getOrCreateSettings();
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(settingsRecord?.get ? settingsRecord.get({ plain: true }) : settingsRecord),
  };

  if (String(settings.status) !== "1") {
    throw new Error("Membership invoice email setup is inactive.");
  }

  if (!options.force && String(settings.auto_send_status) !== "1") {
    return { success: false, skipped: true, message: "Auto send is disabled." };
  }

  const payment = await getMembershipPaymentDetails(paymentId);
  if (!payment) throw new Error("Membership payment not found.");

  const paymentStatus = String(payment.tx_status || "").trim().toUpperCase();
  if (!["VALID", "VALIDATED", "SUCCESS", "CASH_RECEIVED"].includes(paymentStatus)) {
    throw new Error("Membership payment is not successful yet.");
  }
  if (!payment.email_address) throw new Error("Membership payment email address is empty.");

  const ownerMember = await getMembershipOwner(payment.member_id);
  const preparedPayment = {
    ...payment,
    membership_number: payment.membership_number || ownerMember?.membership_number || "",
    membership_category: payment.membership_category || "",
    organization_name:
      payment.organization_name || payment.member_organization_name || ownerMember?.organization_name || "",
  };

  const pdfPath = await generateMembershipPaymentInvoicePdf(preparedPayment, ownerMember || {});
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

  const subject = replaceTemplateTokens(settings.email_subject, preparedPayment, ownerMember || {});
  const bodyText = replaceTemplateTokens(settings.email_body, preparedPayment, ownerMember || {});

  try {
    await transporter.sendMail({
      from: settings.from_name
        ? `"${settings.from_name}" <${settings.from_email}>`
        : settings.from_email,
      replyTo: settings.reply_to_email || settings.from_email,
      to: preparedPayment.email_address,
      subject,
      text: bodyText,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.7;">${normalizeTextToHtml(bodyText)}</div>`,
      attachments: [
        {
          filename: `membership_invoice_${preparedPayment.id}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    await MemberShipPaymentModel.update(
      { email_status: "sent" },
      { where: { id: preparedPayment.id } }
    ).catch(() => {});

    return { success: true };
  } catch (error) {
    await MemberShipPaymentModel.update(
      { email_status: "failed" },
      { where: { id: preparedPayment.id } }
    ).catch(() => {});
    throw error;
  }
}

module.exports = {
  generateMembershipPaymentInvoicePdf,
  getMembershipPaymentDetails,
  sendMembershipPaymentInvoice,
};
