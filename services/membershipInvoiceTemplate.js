const { getSettings, readLogoAsBase64 } = require("./membershipInvoiceSettings");

function escapeInvoiceHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInvoiceAmount(value) {
  const numericAmount = Number(String(value ?? "").replace(/,/g, ""));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}

function formatInvoiceDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function buildMembershipInvoiceRenderModel(payment = {}, viewerMember = {}) {
  const settings = await getSettings();

  return {
    settings,
    logoBase64: readLogoAsBase64(settings.logo_path),
    paymentId: escapeInvoiceHtml(payment.id || "Preview"),
    invoiceTitle: escapeInvoiceHtml(settings.invoice_title || "Membership Payment Invoice"),
    invoiceSubtitle: escapeInvoiceHtml(settings.invoice_subtitle || "Official payment receipt"),
    memberName: escapeInvoiceHtml(payment.name || viewerMember.name || "Sample Member"),
    membershipNumber: escapeInvoiceHtml(
      payment.membership_number || viewerMember.membership_number || "GM0000"
    ),
    memberType: escapeInvoiceHtml(
      payment.membership_category || viewerMember.category_name || "General Member"
    ),
    organizationName: escapeInvoiceHtml(
      payment.organization_name || viewerMember.organization_name || "-"
    ),
    emailAddress: escapeInvoiceHtml(
      payment.email_address || viewerMember.email || "member@example.com"
    ),
    phoneNumber: escapeInvoiceHtml(
      payment.phone_number || viewerMember.phone_number || "01700000000"
    ),
    transactionId: escapeInvoiceHtml(payment.tx_tran_id || "Preview TXN"),
    paymentDate: escapeInvoiceHtml(
      formatInvoiceDate(payment.tx_tran_date || payment.payment_date || new Date())
    ),
    paymentType: escapeInvoiceHtml(payment.payment_type || "ssl"),
    cardNumber: escapeInvoiceHtml(payment.card_no || "-"),
    paymentStatus: escapeInvoiceHtml(payment.tx_status || "VALID"),
    totalPaid: formatInvoiceAmount(payment.pay_amount || 1000),
    contactDetails: escapeInvoiceHtml(settings.contact_details || "-"),
  };
}

function buildMembershipInvoiceHtml(model) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${model.invoiceTitle}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 28px;
            background: #ffffff;
          }
          .invoice-shell {
            max-width: 820px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 28px;
            box-sizing: border-box;
          }
          .invoice-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 2px solid #ede9fe;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          .invoice-logo {
            flex: 1;
          }
          .invoice-logo img {
            max-width: 280px;
            width: 100%;
            height: auto;
            display: block;
          }
          .invoice-title {
            flex: 1;
            text-align: right;
          }
          .invoice-title h1 {
            margin: 0;
            font-size: 28px;
            color: #4c1d95;
          }
          .invoice-title p {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }
          .invoice-card {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 18px;
            background: #fafaff;
          }
          .invoice-card h3 {
            margin: 0 0 14px;
            font-size: 18px;
            color: #111827;
          }
          .invoice-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 7px 0;
            border-bottom: 1px solid #eef2ff;
          }
          .invoice-row:last-child {
            border-bottom: 0;
          }
          .invoice-row span:first-child {
            color: #64748b;
          }
          .amount-box {
            margin-top: 10px;
            padding-top: 14px;
            border-top: 2px solid #ddd6fe;
          }
          .amount-box .invoice-row strong {
            font-size: 20px;
            color: #4c1d95;
          }
          .invoice-contact {
            margin-top: 8px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 14px;
            color: #334155;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-shell">
          <div class="invoice-header">
            <div class="invoice-logo">
              ${model.logoBase64 ? `<img src="${model.logoBase64}" alt="FAA" />` : ""}
            </div>
            <div class="invoice-title">
              <h1>${model.invoiceTitle}</h1>
              <p>${model.invoiceSubtitle}</p>
              <p>Payment record #${model.paymentId}</p>
            </div>
          </div>

          <div class="invoice-grid">
            <div class="invoice-card">
              <h3>Member Details</h3>
              <div class="invoice-row"><span>Name</span><strong>${model.memberName}</strong></div>
              <div class="invoice-row"><span>Membership Number</span><strong>${model.membershipNumber}</strong></div>
              <div class="invoice-row"><span>Membership Type</span><strong>${model.memberType}</strong></div>
              <div class="invoice-row"><span>Organization</span><strong>${model.organizationName}</strong></div>
              <div class="invoice-row"><span>Email</span><strong>${model.emailAddress}</strong></div>
              <div class="invoice-row"><span>Phone</span><strong>${model.phoneNumber}</strong></div>
            </div>

            <div class="invoice-card">
              <h3>Payment Details</h3>
              <div class="invoice-row"><span>Transaction ID</span><strong>${model.transactionId}</strong></div>
              <div class="invoice-row"><span>Payment Date</span><strong>${model.paymentDate}</strong></div>
              <div class="invoice-row"><span>Payment Method</span><strong>${model.paymentType}</strong></div>
              <div class="invoice-row"><span>Card/Account</span><strong>${model.cardNumber}</strong></div>
              <div class="invoice-row"><span>Status</span><strong>${model.paymentStatus}</strong></div>
              <div class="amount-box">
                <div class="invoice-row"><span>Total Paid</span><strong>BDT ${model.totalPaid}</strong></div>
              </div>
            </div>
          </div>

          <div class="invoice-contact">
            <strong>Contact details:</strong> ${model.contactDetails}
          </div>
        </div>
      </body>
    </html>
  `;
}

async function buildMembershipInvoicePreviewHtml() {
  const model = await buildMembershipInvoiceRenderModel();
  return buildMembershipInvoiceHtml(model);
}

module.exports = {
  buildMembershipInvoiceHtml,
  buildMembershipInvoicePreviewHtml,
  buildMembershipInvoiceRenderModel,
  escapeInvoiceHtml,
  formatInvoiceAmount,
};
