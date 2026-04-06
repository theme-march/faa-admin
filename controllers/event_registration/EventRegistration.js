const { sequelize, MemberModel } = require("../../models");
const { QueryTypes } = require('sequelize');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { sendEventRegistrationInvoice, generateEventRegistrationInvoicePdf, getRegistrationDetails } = require("../../services/eventInvoiceMailer");

exports.list = async (req, res, next) => {
  try {
    const [eventOptions, memberTypeOptions, rawTxStatusOptions] = await Promise.all([
      sequelize.query(
        `
          SELECT id, event_title
          FROM event_list
          WHERE status = 1
          ORDER BY event_title ASC
        `,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          SELECT id, category_name
          FROM category_list
          WHERE status = 1
          ORDER BY category_name ASC
        `,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          SELECT DISTINCT UPPER(TRIM(COALESCE(tx_status, ''))) AS tx_status
          FROM event_register
          WHERE COALESCE(TRIM(tx_status), '') <> ''
          ORDER BY tx_status ASC
        `,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const txStatusOptions = Array.from(
      new Set(
        (rawTxStatusOptions || [])
          .map((item) => String(item?.tx_status || ""))
          .map((value) => value.replace(/\s+/g, " ").trim().toUpperCase())
          .filter(Boolean)
      )
    ).map((tx_status) => ({ tx_status }));

    return res.render("event_registration/index", {
      eventOptions,
      memberTypeOptions,
      txStatusOptions,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getEventRegistrations = async (req, res) => {
  try {
    const { start, length, search, order, event, member_type, tx_status } = req.query;
    const pageSize = Number.parseInt(length, 10) || 10;
    const pageOffset = Number.parseInt(start, 10) || 0;

    let query = `
      SELECT 
        er.id,
        er.event_id,
        er.full_name,
        er.email_address,
        er.member_type,
        er.participation_type,
        er.pay_amount,
        er.tx_status,
        er.payment_type,
        er.entry_passcode,
        er.enter_date_time,
        er.email_status,
        er.is_pay,
        e.event_title
      FROM event_register er
      INNER JOIN event_list e ON er.event_id = e.id
      WHERE 1=1
    `;
    let filteredCountQuery = `
      SELECT COUNT(*) AS total
      FROM event_register er
      INNER JOIN event_list e ON er.event_id = e.id
      WHERE 1=1
    `;
    const replacements = {};

    if (search && search.value) {
      const searchTerm = `%${String(search.value).trim()}%`;
      query += ` AND (
        er.full_name LIKE :searchTerm OR
        e.event_title LIKE :searchTerm OR
        er.member_type LIKE :searchTerm
      )`;
      filteredCountQuery += ` AND (
        er.full_name LIKE :searchTerm OR
        e.event_title LIKE :searchTerm OR
        er.member_type LIKE :searchTerm
      )`;
      replacements.searchTerm = searchTerm;
    }

    if (event) {
      query += ` AND er.event_id = :event`;
      filteredCountQuery += ` AND er.event_id = :event`;
      replacements.event = event;
    }
    if (member_type) {
      query += ` AND er.member_category_id = :member_type`;
      filteredCountQuery += ` AND er.member_category_id = :member_type`;
      replacements.member_type = member_type;
    }
    if (tx_status) {
      const normalizedStatus = String(tx_status).trim().toUpperCase();
      if (normalizedStatus === "__PAID__") {
        query += ` AND er.is_pay = 1`;
        filteredCountQuery += ` AND er.is_pay = 1`;
      } else if (normalizedStatus === "__UNPAID__") {
        query += ` AND er.is_pay = 0`;
        filteredCountQuery += ` AND er.is_pay = 0`;
      } else {
        query += ` AND UPPER(COALESCE(er.tx_status, '')) = :tx_status`;
        filteredCountQuery += ` AND UPPER(COALESCE(er.tx_status, '')) = :tx_status`;
        replacements.tx_status = normalizedStatus;
      }
    }

    const columnMap = {
      1: "er.id",
      2: "e.event_title",
      3: "er.full_name",
      4: "er.member_type",
      5: "er.participation_type",
      6: "er.pay_amount",
      7: "er.tx_status",
      8: "er.payment_type",
      9: "er.entry_passcode",
      10: "er.enter_date_time",
      11: "er.email_status",
    };
    const sortColumn = Number.parseInt(order?.[0]?.column, 10);
    const sortDir = String(order?.[0]?.dir || "").toLowerCase() === "asc" ? "ASC" : "DESC";
    if (order && order[0]) {
      const orderByColumn = columnMap[sortColumn] || "er.id";
      query += ` ORDER BY ${orderByColumn} ${sortDir}`;
    } else {
      query += ` ORDER BY er.id DESC`;
    }

    query += ` LIMIT :limit OFFSET :offset`;
    replacements.limit = pageSize;
    replacements.offset = pageOffset;

    const registrations = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    const [{ total: recordsFiltered }] = await sequelize.query(filteredCountQuery, {
      replacements,
      type: QueryTypes.SELECT
    });
    const [{ total: recordsTotal }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM event_register`,
      { type: QueryTypes.SELECT }
    );

    registrations.forEach((registration) => {
      registration.select_checkbox = `<input type="checkbox" class="registration-checkbox" value="${registration.id}">`;
      const canResend = Number(registration.is_pay) === 1 && registration.email_address;
      const canResetEntry = Number(registration.is_pay) === 1 && registration.enter_date_time;
      const canReceiveCash = Number(registration.is_pay) !== 1 && String(registration.tx_status || "").toUpperCase() === "CASH_PENDING";
      const canDelete = true;

      registration.action = `
        <div class="event-action-stack">
          ${canReceiveCash ? `
            <form action="/event-registration/receive-cash/${registration.id}" method="post" onsubmit="return confirm('Mark this cash payment as received?');">
              <button type="submit" class="btn btn-sm btn-success event-action-icon" data-tooltip="Cash Received" title="Cash Received" aria-label="Cash Received">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7h18v10H3z"></path>
                  <path d="M3 11h18"></path>
                  <circle cx="12" cy="16" r="2"></circle>
                </svg>
              </button>
            </form>
          ` : ``}
          ${canResend ? `
            <a href="/event-registration/invoice/${registration.id}" class="btn btn-sm btn-primary event-action-icon" data-tooltip="Download Invoice" title="Download Invoice" aria-label="Download Invoice">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v12"></path>
                <path d="M7 10l5 5 5-5"></path>
                <path d="M4 20h16"></path>
              </svg>
            </a>
          ` : ``}
          ${canResend ? `
            <form action="/event-registration/resend/${registration.id}" method="post" onsubmit="return confirm('Resend invoice email for this registration?');">
              <button type="submit" class="btn btn-sm btn-outline-primary event-action-icon" data-tooltip="Resend Invoice" title="Resend Invoice" aria-label="Resend Invoice">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18v12H3z"></path>
                  <path d="M3 8l9 6 9-6"></path>
                </svg>
              </button>
            </form>
          ` : ``}
          ${canResetEntry ? `
            <form action="/event-registration/reset-entry/${registration.id}" method="post" onsubmit="return confirm('Reset this event entry?');">
              <button type="submit" class="btn btn-sm btn-warning event-action-icon" data-tooltip="Reset Entry" title="Reset Entry" aria-label="Reset Entry">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 3-6.7"></path>
                  <path d="M3 4v6h6"></path>
                </svg>
              </button>
            </form>
          ` : ``}
          ${canDelete ? `
            <form action="/event-registration/delete/${registration.id}" method="post" onsubmit="return confirm('Delete this event registration permanently?');">
              <button type="submit" class="btn btn-sm btn-danger event-action-icon" data-tooltip="Delete" title="Delete" aria-label="Delete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"></path>
                  <path d="M8 6V4h8v2"></path>
                  <path d="M6 6l1 14h10l1-14"></path>
                </svg>
              </button>
            </form>
          ` : ``}
        </div>
      `;
    });

    res.json({
      draw: req.query.draw,
      recordsTotal: Number(recordsTotal || 0),
      recordsFiltered: Number(recordsFiltered || 0),
      data: registrations
    });
  } catch (error) {
    console.error('Error fetching event registrations:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.downloadExcel = async (req, res) => {
  try {
    const { event, member_type, tx_status } = req.query;

    let query = `
      SELECT 
        er.id,
        er.event_id,
        er.full_name,
        er.member_id,
        er.student_id,
        er.session,
        er.organization_name,
        er.email_address,
        er.phone_number,
        er.t_shirt_size,
        er.delivery_option,
        er.delivery_address,
        er.is_pay,
        er.tx_tran_date,
        er.tx_tran_id,
        er.tx_val_id,
        er.tx_amount,
        er.tx_bank_tran_id,
        er.email_status,
        er.member_type,
        er.participation_type,
        er.pay_amount,
        er.tx_status,
        er.payment_type,
        er.enter_date_time,
        e.event_title
      FROM event_register er
      INNER JOIN event_list e ON er.event_id = e.id
      WHERE 1=1
    `;

    if (event) query += ` AND er.event_id = :event`;
    if (member_type) query += ` AND er.member_category_id = :member_type`;
    if (tx_status) {
      const normalizedStatus = String(tx_status).trim().toUpperCase();
      if (normalizedStatus === "__PAID__") {
        query += ` AND er.is_pay = 1`;
      } else if (normalizedStatus === "__UNPAID__") {
        query += ` AND er.is_pay = 0`;
      } else {
        query += ` AND UPPER(COALESCE(er.tx_status, '')) = :tx_status`;
      }
    }

    const replacements = {
      event,
      member_type,
      tx_status: tx_status ? String(tx_status).trim().toUpperCase() : tx_status,
    };
    const registrations = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });

    const formattedData = registrations.map(reg => ({
      'Event ID': reg.event_id,
      'Event Title': reg.event_title,
      'Full Name': reg.full_name,
      'Member ID': reg.member_id,
      'Student ID': reg.student_id,
      'Session': reg.session,
      'Organization Name': reg.organization_name,
      'Email Address': reg.email_address,
      'Phone Number': reg.phone_number,
      'T-Shirt Size': reg.t_shirt_size,
      'Delivery Option': reg.delivery_option,
      'Delivery Address': reg.delivery_address,
      'Is Paid': reg.is_pay === 1 ? 'Yes' : 'No',
      'Transaction Date': reg.tx_tran_date,
      'Transaction ID': reg.tx_tran_id,
      'Transaction Validation ID': reg.tx_val_id,
      'Transaction Amount': reg.tx_amount,
      'Bank Transaction ID': reg.tx_bank_tran_id,
      'Email Status': reg.email_status,
      'Member Type': reg.member_type,
      'Participation Type': reg.participation_type,
      'Pay Amount': reg.pay_amount,
      'Transaction Status': reg.tx_status,
      'Payment Type': reg.payment_type,
      'Enter Date Time': reg.enter_date_time
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Event Registrations");

    const filePath = path.join(__dirname, "../../public/temp/event_registrations.xlsx");
    XLSX.writeFile(wb, filePath);

    res.download(filePath, 'event_registrations.xlsx', (err) => {
      if (!err) {
        fs.unlink(filePath, () => null);
      }
    });
  } catch (error) {
    console.error('Error exporting Excel file:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.resendInvoice = async (req, res) => {
  try {
    await sendEventRegistrationInvoice(req.params.id, { force: true });
    req.flash("success", "Invoice email sent successfully.");
  } catch (error) {
    req.flash("error", error.message);
  }
  return res.redirect("/event-registration");
};

exports.downloadInvoice = async (req, res) => {
  try {
    const registration = await getRegistrationDetails(req.params.id);
    if (!registration) {
      req.flash("error", "Registration not found.");
      return res.redirect("/event-registration");
    }
    if (Number(registration.is_pay) !== 1) {
      req.flash("error", "Only paid registrations can download invoice.");
      return res.redirect("/event-registration");
    }

    const invoiceFileName = `invoice_${registration.id}.pdf`;
    const savedInvoicePath = path.join(__dirname, "../../public/invoices", invoiceFileName);
    const legacyInvoicePath = path.join(__dirname, "../../public/invoice", invoiceFileName);
    try {
      const regeneratedPdfPath = await generateEventRegistrationInvoicePdf(registration);
      return res.download(regeneratedPdfPath, invoiceFileName);
    } catch (regenerateError) {
      if (fs.existsSync(savedInvoicePath)) return res.download(savedInvoicePath, invoiceFileName);
      if (fs.existsSync(legacyInvoicePath)) return res.download(legacyInvoicePath, invoiceFileName);
      throw regenerateError;
    }
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-registration");
  }
};

exports.resetEntry = async (req, res) => {
  try {
    await sequelize.query(`UPDATE event_register SET enter_date_time = NULL WHERE id = :id`, {
      replacements: { id: req.params.id },
      type: QueryTypes.UPDATE
    });
    req.flash("success", "Event entry reset successfully.");
    return res.redirect("/event-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-registration");
  }
};

exports.receiveCash = async (req, res) => {
  try {
    const registration = await sequelize.query(`SELECT * FROM event_register WHERE id = :id LIMIT 1`, {
      replacements: { id: req.params.id },
      type: QueryTypes.SELECT
    });

    if (!registration[0]) {
      req.flash("error", "Registration not found.");
      return res.redirect("/event-registration");
    }

    await sequelize.query(
      `UPDATE event_register SET is_pay = 1, payment_type = 'cash', tx_status = 'CASH_RECEIVED', tx_tran_date = NOW() WHERE id = :id`,
      {
        replacements: { id: req.params.id },
        type: QueryTypes.UPDATE
      }
    );

    if (registration[0].member_id && Number(registration[0].membership_renew_fees) !== 0) {
      await MemberModel.update(
        { is_pay: 1, amount: registration[0].membership_renew_fees },
        { where: { id: registration[0].member_id } }
      );
    }

    let invoiceSaved = false;

    try {
      const paidRegistration = await getRegistrationDetails(req.params.id);
      if (paidRegistration) {
        await generateEventRegistrationInvoicePdf(paidRegistration);
        invoiceSaved = true;
      }
    } catch (invoiceError) {
      console.error("Cash payment invoice generation failed:", invoiceError);
      req.flash("error", `Cash received, but invoice PDF could not be generated: ${invoiceError.message}`);
    }

    try {
      await sendEventRegistrationInvoice(req.params.id, { force: true });
    } catch (emailError) {
      console.error("Cash payment invoice email failed:", emailError);
      if (!invoiceSaved) {
        req.flash("error", `Cash received, but invoice/email could not be completed: ${emailError.message}`);
      } else {
        req.flash("info", `Cash received and invoice saved. Email could not be sent: ${emailError.message}`);
      }
    }

    req.flash("success", invoiceSaved ? "Cash payment marked as received and invoice saved." : "Cash payment marked as received.");
    return res.redirect("/event-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-registration");
  }
};





exports.delete = async (req, res) => {
  try {
    await sequelize.query(`DELETE FROM event_register WHERE id = :id`, {
      replacements: { id: req.params.id },
      type: QueryTypes.DELETE
    });

    req.flash("success", "Event registration deleted successfully.");
    return res.redirect("/event-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-registration");
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    let ids = req.body.selected_ids || req.body.selected_ids_json || [];

    if (typeof ids === "string") {
      try {
        ids = JSON.parse(ids);
      } catch (error) {
        ids = ids.split(",").map((id) => id.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(ids) || !ids.length) {
      req.flash("error", "Please select at least one event registration.");
      return res.redirect("/event-registration");
    }

    const cleanIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!cleanIds.length) {
      req.flash("error", "Selected event registrations are invalid.");
      return res.redirect("/event-registration");
    }

    await sequelize.query(`DELETE FROM event_register WHERE id IN (:ids)`, {
      replacements: { ids: cleanIds },
      type: QueryTypes.DELETE
    });

    req.flash("success", `${cleanIds.length} event registration(s) deleted successfully.`);
    return res.redirect("/event-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-registration");
  }
};

