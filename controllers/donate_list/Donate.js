const {sequelize} = require("../../models");
const {QueryTypes} = require("sequelize");

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

exports.list = (req, res, next) => {
  res.render('donate_list/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;

  const query_data = await sequelize.query(
    `
      SELECT 
        dl.*,
        p.title AS program_title
      FROM donation_list dl
      LEFT JOIN programs p ON p.id = dl.program_id
      ORDER BY dl.id DESC
      LIMIT ${offset}, ${limit};
    `,
    { type: QueryTypes.SELECT }
  );
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM donation_list;`, { type: QueryTypes.SELECT });
  let num_of_rows = query_data_count[0].num_of_row;

  query_data.forEach((item) => {
    item.select_checkbox = `<input type="checkbox" class="donation-checkbox" value="${item.id}">`;
    item.status_label = item.tx_status || "Pending";
    item.donation_type_label = String(item.donation_type || "normal").toLowerCase() === "program"
      ? "Program-wise"
      : "Normal";
    item.program_label = item.program_title || "-";
    const canReceiveCash = String(item.tx_status || "").toUpperCase() === "CASH_PENDING";
    const cashAction = canReceiveCash
      ? `<form action="/donate_list/receive-cash/${item.id}" method="post" class="d-inline-block mr-1" onsubmit="return confirm('Mark this cash payment as received?');"><button type="submit" class="btn btn-sm btn-success">Cash Received</button></form>`
      : ``;
    const deleteAction = `<form action="/donate_list/delete/${item.id}" method="post" class="d-inline-block" onsubmit="return confirm('Delete this donation permanently?');"><button type="submit" class="btn btn-sm btn-danger">Delete</button></form>`;
    item.action = `${cashAction}${deleteAction}`;
  });

  return res.status(200).json({
    success: true,
    recordsTotal: query_data.length,
    recordsFiltered: num_of_rows,
    data: query_data
  });
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
      req.flash("error", "Please select at least one donation.");
      return res.redirect("/donate_list");
    }

    const cleanIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!cleanIds.length) {
      req.flash("error", "Selected donations are invalid.");
      return res.redirect("/donate_list");
    }

    await sequelize.query(`DELETE FROM donation_list WHERE id IN (:ids)`, {
      replacements: { ids: cleanIds },
      type: QueryTypes.DELETE
    });

    req.flash("success", `${cleanIds.length} donation(s) deleted successfully.`);
    return res.redirect("/donate_list");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/donate_list");
  }
};

exports.receiveCash = async (req, res, next) => {
  try {
    await sequelize.query(
      `UPDATE donation_list SET payment_type = 'cash', tx_status = 'CASH_RECEIVED', tx_tran_date = NOW() WHERE id = :id`,
      {
        replacements: { id: req.params.id },
        type: QueryTypes.UPDATE
      }
    );

    req.flash("success", "Donation cash payment marked as received.");
    return res.redirect("/donate_list");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/donate_list");
  }
};

exports.delete = async (req, res, next) => {
  try {
    await sequelize.query(
      `DELETE FROM donation_list WHERE id = :id`,
      {
        replacements: { id: req.params.id },
        type: QueryTypes.DELETE
      }
    );

    req.flash("success", "Donation deleted successfully.");
    return res.redirect("/donate_list");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/donate_list");
  }
};

exports.downloadExcel = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         dl.id,
         dl.name,
         dl.organization_name,
         dl.email_address,
         dl.phone_number,
         dl.donation_type,
         p.title AS program_title,
         dl.pay_amount,
         dl.payment_type,
         dl.tx_status,
         dl.tx_tran_id,
         dl.tx_val_id,
         dl.tx_amount,
         dl.tx_bank_tran_id,
         dl.tx_tran_date,
         dl.created_at
       FROM donation_list dl
       LEFT JOIN programs p ON p.id = dl.program_id
       ORDER BY dl.id DESC;`,
      { type: QueryTypes.SELECT }
    );

    const exportRows = (rows || []).map((item) => ({
      "ID": item.id,
      "Name": item.name || "",
      "Organization Name": item.organization_name || "",
      "Email Address": item.email_address || "",
      "Phone Number": item.phone_number || "",
      "Donation Type": String(item.donation_type || "normal").toLowerCase() === "program" ? "Program-wise" : "Normal",
      "Program": item.program_title || "-",
      "Pay Amount": item.pay_amount || "",
      "Payment Type": item.payment_type || "",
      "Transaction Status": item.tx_status || "",
      "Transaction ID": item.tx_tran_id || "",
      "Validation ID": item.tx_val_id || "",
      "Transaction Amount": item.tx_amount || "",
      "Bank Transaction ID": item.tx_bank_tran_id || "",
      "Transaction Date": item.tx_tran_date || "",
      "Created At": item.created_at || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Donation List");

    const tempDir = path.join(__dirname, "../../public/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, "donation_list.xlsx");
    XLSX.writeFile(workbook, filePath);

    return res.download(filePath, "donation_list.xlsx", (err) => {
      if (!err && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => null);
      }
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/donate_list");
  }
};
