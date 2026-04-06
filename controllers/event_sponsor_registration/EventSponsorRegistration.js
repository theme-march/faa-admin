const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

exports.list = (req, res, next) => {
  res.render("event_sponsor_registration/index", {});
};

exports.data_list = async (req, res, next) => {
  try {
    const offset = Number(req.body.start) || 0;
    const limit = Number(req.body.length) || 50;

    const query_data = await sequelize.query(
      `SELECT esr.*, el.event_title
       FROM event_sponsor_register esr
       LEFT JOIN event_list el ON el.id = esr.event_id
       ORDER BY esr.id DESC
       LIMIT ${offset}, ${limit};`,
      { type: QueryTypes.SELECT }
    );
    const query_data_count = await sequelize.query(
      `SELECT COUNT(*) AS num_of_row FROM event_sponsor_register;`,
      { type: QueryTypes.SELECT }
    );

    query_data.forEach((item) => {
      item.select_checkbox = `<input type="checkbox" class="sponsor-checkbox" value="${item.id}">`;
      item.status_label = item.tx_status || (Number(item.is_pay) === 1 ? "Paid" : "Pending");
      const canReceiveCash = Number(item.is_pay) !== 1 && String(item.tx_status || "").toUpperCase() === "CASH_PENDING";
      const cashAction = canReceiveCash
        ? `<form action="/event-sponsor-registration/receive-cash/${item.id}" method="post" class="d-inline-block mr-1" onsubmit="return confirm('Mark this cash payment as received?');"><button type="submit" class="btn btn-sm btn-success">Cash Received</button></form>`
        : ``;
      const deleteAction = `<form action="/event-sponsor-registration/delete/${item.id}" method="post" class="d-inline-block" onsubmit="return confirm('Delete this sponsor registration permanently?');"><button type="submit" class="btn btn-sm btn-danger">Delete</button></form>`;
      item.action = `${cashAction}${deleteAction}`;
    });

    return res.status(200).json({
      success: true,
      recordsTotal: query_data.length,
      recordsFiltered: query_data_count[0].num_of_row,
      data: query_data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.bulkDelete = async (req, res, next) => {
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
      req.flash("error", "Please select at least one sponsor registration.");
      return res.redirect("/event-sponsor-registration");
    }

    const cleanIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!cleanIds.length) {
      req.flash("error", "Selected sponsor registrations are invalid.");
      return res.redirect("/event-sponsor-registration");
    }

    await sequelize.query(`DELETE FROM event_sponsor_register WHERE id IN (:ids)`, {
      replacements: { ids: cleanIds },
      type: QueryTypes.DELETE
    });

    req.flash("success", `${cleanIds.length} sponsor registration(s) deleted successfully.`);
    return res.redirect("/event-sponsor-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-sponsor-registration");
  }
};

exports.receiveCash = async (req, res, next) => {
  try {
    await sequelize.query(
      `UPDATE event_sponsor_register
       SET is_pay = 1, payment_type = 'cash', tx_status = 'CASH_RECEIVED', tx_tran_date = NOW()
       WHERE id = :id`,
      {
        replacements: { id: req.params.id },
        type: QueryTypes.UPDATE
      }
    );

    req.flash("success", "Sponsor cash payment marked as received.");
    return res.redirect("/event-sponsor-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-sponsor-registration");
  }
};

exports.delete = async (req, res, next) => {
  try {
    await sequelize.query(
      `DELETE FROM event_sponsor_register WHERE id = :id`,
      {
        replacements: { id: req.params.id },
        type: QueryTypes.DELETE
      }
    );

    req.flash("success", "Sponsor registration deleted successfully.");
    return res.redirect("/event-sponsor-registration");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-sponsor-registration");
  }
};

exports.downloadExcel = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         esr.id,
         esr.event_id,
         el.event_title,
         esr.distributor_name,
         esr.organization_name,
         esr.email,
         esr.phone_number,
         esr.approximately_amount,
         esr.payment_type,
         esr.tx_status,
         esr.tx_tran_id,
         esr.tx_tran_date,
         esr.created_at
       FROM event_sponsor_register esr
       LEFT JOIN event_list el ON el.id = esr.event_id
       ORDER BY esr.id DESC;`,
      { type: QueryTypes.SELECT }
    );

    const exportRows = (rows || []).map((item) => ({
      "ID": item.id,
      "Event ID": item.event_id,
      "Event Title": item.event_title || "",
      "Name": item.distributor_name || "",
      "Organization": item.organization_name || "",
      "Email": item.email || "",
      "Phone": item.phone_number || "",
      "Amount": item.approximately_amount || "",
      "Payment Type": item.payment_type || "",
      "Transaction Status": item.tx_status || "",
      "Transaction ID": item.tx_tran_id || "",
      "Transaction Date": item.tx_tran_date || "",
      "Created At": item.created_at || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Event Sponsor Registrations");

    const tempDir = path.join(__dirname, "../../public/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, "event_sponsor_registrations.xlsx");
    XLSX.writeFile(workbook, filePath);

    return res.download(filePath, "event_sponsor_registrations.xlsx", (err) => {
      if (!err && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => null);
      }
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/event-sponsor-registration");
  }
};
