const { sequelize, MemberModel, MenuModel } = require("../../models");
const { QueryTypes } = require("sequelize");
const CommonFunction = require("../common_function");
const validations = require("../validations");
const { check, validationResult } = require("express-validator");
const excel = require("exceljs");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function buildPrefixFromCategoryName(categoryName = "") {
  const normalizedName = normalizeText(categoryName);

  if (normalizedName.includes("life")) return "LM";
  if (normalizedName.includes("general")) return "GM";
  if (normalizedName.includes("student") || normalizedName.includes("guest")) return "SM";

  const words = String(categoryName || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !["member", "membership", "category"].includes(normalizeText(word)));

  const initials = words
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return initials || "MB";
}

function resolvePrefixFromCategoryMeta(categoryTitle, categoryName) {
  if (!categoryTitle) return buildPrefixFromCategoryName(categoryName);

  try {
    const parsed = typeof categoryTitle === "string" ? JSON.parse(categoryTitle) : categoryTitle;
    const prefix = String(parsed?.membership_number_prefix || "").trim().toUpperCase();
    if (prefix) return prefix;
  } catch (error) {
    const fallbackPrefix = String(categoryTitle || "").trim().toUpperCase();
    if (fallbackPrefix && fallbackPrefix.length <= 10) return fallbackPrefix;
  }

  return buildPrefixFromCategoryName(categoryName);
}

async function resolveMembershipPrefixByCategoryId(categoryId) {
  if (!categoryId) return "MB";

  try {
    const categoryRows = await sequelize.query(
      `SELECT category_name, category_title FROM category_list WHERE id = :id LIMIT 1`,
      {
        replacements: { id: categoryId },
        type: QueryTypes.SELECT,
      }
    );
    const categoryName = categoryRows?.[0]?.category_name || "";
    const categoryTitle = categoryRows?.[0]?.category_title || "";
    return resolvePrefixFromCategoryMeta(categoryTitle, categoryName);
  } catch (error) {
    return "MB";
  }
}

function resolveApprovedAtValue(nextApproval, existingApprovedAt = null) {
  const normalizedApproval = Number(nextApproval) === 1 ? 1 : 0;
  if (normalizedApproval !== 1) return null;
  return existingApprovedAt || new Date();
}

function resolveCategoryMembershipMeta(categoryTitle, categoryName = "") {
  const fallbackDuration = 365;
  const fallback = {
    membership_type: String(categoryName || "").toLowerCase().includes("lifetime")
      ? "lifetime"
      : "time_limited",
    membership_duration_days: fallbackDuration,
  };

  if (!categoryTitle) return fallback;

  try {
    const parsed = typeof categoryTitle === "string" ? JSON.parse(categoryTitle) : categoryTitle;
    const membershipType =
      String(parsed?.membership_type || "").toLowerCase() === "lifetime"
        ? "lifetime"
        : fallback.membership_type;
    const parsedDays = Number(parsed?.membership_duration_days);
    const durationDays =
      Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : fallbackDuration;
    return {
      membership_type: membershipType,
      membership_duration_days: durationDays,
    };
  } catch (error) {
    return fallback;
  }
}

function formatDateYmd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveEffectiveApprovedDate({
  adminApproval,
  approvedAt,
  lastPaymentRaw,
  createdAt,
}) {
  if (Number(adminApproval) !== 1) return null;
  const byApprovedAt = parseValidDate(approvedAt);
  if (byApprovedAt) return byApprovedAt;

  const byLastPayment = parseValidDate(lastPaymentRaw);
  if (byLastPayment) return byLastPayment;

  return parseValidDate(createdAt);
}

const fields = [
  { param: "membership_number" },
  { param: "name" },
  { param: "phone_number" },
  { param: "email" },
  { param: "session" },
  { param: "occupation" },
  { param: "organization_name" },
  { param: "designation_name" },
  { param: "password" },
  { param: "hsc_passing_year" },
  { param: "address" },
];

exports.list = (req, res, next) => {
  const categoryid = req.query.categoryid;
  sequelize
    .query(
      `SELECT id, category_name
       FROM category_list
       WHERE status = 1
       ORDER BY LOWER(TRIM(COALESCE(category_name, ''))) ASC`,
      { type: QueryTypes.SELECT }
    )
    .then((memberTypes) => {
      res.render("member/index", {
        data: {
          categoryid: categoryid,
          memberTypes: memberTypes || [],
        },
      });
    })
    .catch(() => {
      res.render("member/index", {
        data: {
          categoryid: categoryid,
          memberTypes: [],
        },
      });
    });
};
exports.expired_members = (req, res, next) => {
  res.render("member/expired_members", {});
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body["search"];
  let search_value = search.value;
  let categoryid = req.body.categoryid;
  let memberType = String(req.body.member_type || "all").trim();
  let transactionStatus = String(req.body.transaction_status || "all").trim().toLowerCase();
  let query_str = " WHERE ml.status = 1 ";
  if (categoryid) {
    query_str = query_str + ` AND ml.membership_category_id = ${categoryid} `;
  }
  if (search_value) {
    // query_str = query_str + " AND email like " + '%'+search+'%';
    query_str =
      query_str +
      " AND (ml.email LIKE '%" +
      search_value +
      "%' OR ml.name LIKE '%" +
      search_value +
      "%' OR ml.phone_number LIKE '%" +
      search_value +
      "%') ";
  }

  if (memberType && memberType !== "all") {
    const numericMemberType = Number.parseInt(memberType, 10);
    if (Number.isFinite(numericMemberType) && numericMemberType > 0) {
      query_str = query_str + ` AND ml.membership_category_id = ${numericMemberType} `;
    }
  }

  if (transactionStatus === "pay") {
    query_str = query_str + " AND ml.is_pay = 1 ";
  } else if (transactionStatus === "not_pay") {
    query_str = query_str + " AND ml.is_pay = 0 ";
  } else if (transactionStatus === "cash_pending") {
    query_str = query_str + " AND COALESCE(mcp.pending_cash_requests, 0) > 0 ";
  }

  const query_data = await sequelize.query(
    `SELECT 
      ml.*,
      c.category_name,
      COALESCE(mcp.pending_cash_requests, 0) AS pending_cash_requests,
      mcp.pending_cash_amount
    FROM member_list ml
    INNER JOIN category_list c ON ml.membership_category_id = c.id
    LEFT JOIN (
      SELECT 
        msp.member_id,
        COUNT(*) AS pending_cash_requests,
        SUBSTRING_INDEX(GROUP_CONCAT(msp.pay_amount ORDER BY msp.id DESC), ',', 1) AS pending_cash_amount
      FROM member_ship_payments msp
      WHERE msp.payment_type = 'cash'
        AND msp.tx_status = 'CASH_PENDING'
      GROUP BY msp.member_id
    ) mcp ON mcp.member_id = ml.id
    ${query_str}
    ORDER BY ml.id DESC
    LIMIT ${offset}, ${limit};`,
    { type: QueryTypes.SELECT }
  );
  const query_data_count = await sequelize.query(
    `SELECT COUNT(*) AS num_of_row
      FROM member_list ml
      INNER JOIN category_list c ON ml.membership_category_id = c.id
      LEFT JOIN (
        SELECT
          msp.member_id,
          COUNT(*) AS pending_cash_requests
        FROM member_ship_payments msp
        WHERE msp.payment_type = 'cash'
          AND msp.tx_status = 'CASH_PENDING'
        GROUP BY msp.member_id
      ) mcp ON mcp.member_id = ml.id
      ${query_str};`,
    { type: QueryTypes.SELECT }
  );

  query_data.forEach(function (e) {
    e.action =
      "<div class='list-icons'>" +
      "<div class='dropdown'>" +
      "<a href='#' class='list-icons-item' data-toggle='dropdown'><i class='icon-menu9'></i></a>" +
      "<div class='dropdown-menu dropdown-menu-right'>" +
      "<a href='/member/edit/" + e.id + "' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a>" +
      "<a data-delete-id='" + e.id + "' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a>" +
      "<a data-approve-id='" + e.id + "' href='javascript:void(0);' id='approve' class='dropdown-item'><i class='icon-user-check'></i> Approve</a>" +
      "<a data-approve-id='" + e.id + "' href='javascript:void(0);' id='not_approve' class='dropdown-item'><i class='icon-user-cancel'></i> Not Approve</a>" +
      (Number(e.pending_cash_requests || 0) > 0 ? "<a data-member-id='" + e.id + "' href='javascript:void(0);' id='mark_cash_received' class='dropdown-item'><i class='icon-cash3'></i> Mark Cash Received</a>" : "") +
      "<a data-member-id='" + e.id + "' href='javascript:void(0);' id='mark_paid' class='dropdown-item'><i class='icon-checkmark4'></i> Mark as Paid</a>" +
      "<a data-member-id='" + e.id + "' href='javascript:void(0);' id='mark_not_paid' class='dropdown-item'><i class='icon-cross2'></i> Mark as Not Paid</a>" +
      "</div>" +
      "</div>" +
      "</div>";
  });
  let num_of_rows = query_data_count[0].num_of_row;

  if (query_data.length !== 0) {
    return res.status(200).json({
      success: true,
      recordsTotal: query_data.length,
      recordsFiltered: num_of_rows,
      data: query_data,
    });
  } else {
    return res.status(200).json({
      success: true,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: query_data,
    });
  }
};

//Start tareq vai

// exports.expired_data_list = async (req, res, next) => {
//   let offset = req.body.start;
//   let limit = req.body.length;
//   let page_num = req.body.draw;
//   let search = req.body['search'];
//   let search_value = search.value;
//   let query_str = " WHERE status = 1 AND is_pay=0";
//   if(search_value){
//     // query_str = query_str + " AND email like " + '%'+search+'%';
//     query_str = query_str + " AND (email LIKE '%" + search_value + "%' OR name LIKE '%" + search_value + "%' OR phone_number LIKE '%" + search_value + "%') ";
//   }

//   const query_data = await sequelize.query(`SELECT * FROM member_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
//   const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM member_list ${query_str};`, { type: QueryTypes.SELECT });

//   query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del_others(e.id, "member") });
//   let num_of_rows = query_data_count[0].num_of_row;

//   if(query_data.length !== 0){
//     return res.status(200).json({
//       success: true,
//       recordsTotal: query_data.length,
//       recordsFiltered: num_of_rows,
//       data: query_data
//     });
//   }else{
//     return res.status(200).json({
//       success: true,
//       recordsTotal: 0,
//       recordsFiltered: 0,
//       data: query_data
//     });
//   }
// };

//end tareq vai

//Start Akash
exports.expired_data_list = async (req, res) => {
  try {
    const offset = parseInt(req.body.start) || 0;
    const limit = parseInt(req.body.length) || 10;
    const search_value = req.body?.search?.value || "";
    const replacements = {};

    let search_query = "";
    if (search_value) {
      search_query = `
        AND (
          ml.name LIKE :search OR
          ml.email LIKE :search OR
          ml.phone_number LIKE :search
        )
      `;
      replacements.search = `%${search_value}%`;
    }

    const baseRows = await sequelize.query(
      `
      SELECT 
        ml.id,
        ml.name,
        ml.phone_number,
        ml.email,
        ml.session,
        ml.admin_approval,
        ml.approved_at,
        ml.created_at,
        cl.category_name,
        cl.category_title,
        COALESCE(
          MAX(COALESCE(mp.tx_tran_date, mp.created_at, er.tx_tran_date, er.created_at)),
          NULL
        ) AS last_payment_raw
      FROM member_list ml
      INNER JOIN category_list cl ON cl.id = ml.membership_category_id
      LEFT JOIN member_ship_payments mp
        ON ml.id = mp.member_id
        AND mp.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN event_register er
        ON ml.id = er.member_id
        AND er.tx_status IN ('VALID', 'CASH_RECEIVED')
      WHERE ml.status = 1
        AND ml.admin_approval = 1
        ${search_query}
      GROUP BY ml.id
      ORDER BY ml.id DESC
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const now = Date.now();
    const normalizedRows = (baseRows || [])
      .map((row) => {
        const categoryMeta = resolveCategoryMembershipMeta(row.category_title, row.category_name);
        const approvedDate = resolveEffectiveApprovedDate({
          adminApproval: row.admin_approval,
          approvedAt: row.approved_at,
          lastPaymentRaw: row.last_payment_raw,
          createdAt: row.created_at,
        });
        const isValidApprovedDate = !!approvedDate;
        const lastPaymentDate = row.last_payment_raw ? new Date(row.last_payment_raw) : null;

        let expireDate = null;
        if (categoryMeta.membership_type !== "lifetime" && isValidApprovedDate) {
          const durationMs =
            Number(categoryMeta.membership_duration_days || 365) * 24 * 60 * 60 * 1000;
          expireDate = new Date(approvedDate.getTime() + durationMs);
        }

        const status =
          categoryMeta.membership_type === "lifetime"
            ? "Active"
            : expireDate && expireDate.getTime() < now
              ? "Expired"
              : "Active";

        return {
          id: row.id,
          name: row.name,
          phone_number: row.phone_number,
          email: row.email,
          session: row.session,
          approved_date: formatDateYmd(approvedDate),
          last_payment_date: formatDateYmd(lastPaymentDate),
          expire_date:
            categoryMeta.membership_type === "lifetime"
              ? "Lifetime"
              : formatDateYmd(expireDate),
          status,
        };
      })
      .filter((row) => row.status === "Expired");

    await Promise.all(
      (baseRows || [])
        .filter(
          (row) =>
            Number(row.admin_approval) === 1 &&
            !row.approved_at &&
            resolveEffectiveApprovedDate({
              adminApproval: row.admin_approval,
              approvedAt: row.approved_at,
              lastPaymentRaw: row.last_payment_raw,
              createdAt: row.created_at,
            })
        )
        .map((row) =>
          MemberModel.update(
            {
              approved_at: resolveEffectiveApprovedDate({
                adminApproval: row.admin_approval,
                approvedAt: row.approved_at,
                lastPaymentRaw: row.last_payment_raw,
                createdAt: row.created_at,
              }),
            },
            { where: { id: row.id } }
          ).catch(() => {})
        )
    );

    const recordsTotal = normalizedRows.length;
    const query_data = normalizedRows.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      draw: req.body.draw,
      recordsTotal,
      recordsFiltered: recordsTotal,
      data: query_data,
    });
  } catch (err) {
    console.error("Expired data fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
//End Akash

exports.add_from = async (req, res, next) => {
  const batch_session_list = await sequelize.query(
    `SELECT * FROM batch_session_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );
  const occupation_list = await sequelize.query(
    `SELECT * FROM occupation_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );
  const category_list = await sequelize.query(
    `SELECT * FROM category_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );

  res.render("member/add", {
    membership_number: "",
    name: "",
    phone_number: "",
    email: "",
    session: "",
    occupation: "",
    organization_name: "",
    designation_name: "",
    status: 1,
    admin_approval: 0,
    batch_session_list: batch_session_list,
    occupation_list: occupation_list,
    category_list: category_list,
    password: "",
    hsc_passing_year: "",
    member_image: "",
    membership_category_id: "",
    address: "",
    validation: validations.all_field_validations(null, fields),
  });
};

// Start tareq vai code GM,LM,ST
// exports.add = [
//   async (req, res, next) => {
//     const storage = multer.diskStorage({
//       destination: function (req, file, cb) {
//         cb(null, "public/member");
//       },
//       filename: (req, file, cb) => {
//         cb(null, "member_" + Date.now() + path.extname(file.originalname));
//       },
//     });
//     const upload = multer({
//       storage: storage,
//       limits: { fileSize: 50 * 1024 * 1024 },
//     }).single("_image");

//     const errorHandlerProductList = (err) => {
//       req.flash("error", err.original.sqlMessage);
//       res.redirect("/member/add");
//     };
//     const errorHandlerUpload = async (err, _id) => {
//       req.flash("error", err);
//       res.redirect("/member/add");
//     };
//     const errorHandler = async (err, _id) => {
//       req.flash("error", err);
//       res.redirect("/member/add");
//     };
//     upload(req, res, async (err) => {
//       if (err) {
//         await errorHandlerUpload(err);
//       } else {
//         let image = "";
//         if (req.file === undefined) {
//           req.flash("error", "Please add image");
//           res.redirect("/member/add");
//         } else {
//           const resizedImagePath = "public/member/resized_" + req.file.filename;
//           await sharp(req.file.path)
//             .resize(150, 150) // Resize to 300x300 pixels
//             .toFile(resizedImagePath)
//             .catch(errorHandler);

//           image = resizedImagePath.split("public/member/")[1];
//           // image = req.file.filename;
//         }
//         if (req.body.name === "") {
//           req.flash("error", "Please enter name");
//           res.redirect("/member/add");
//         }
//         if (req.body.phone_number === "") {
//           req.flash("error", "Please enter phone number");
//           res.redirect("/member/add");
//         }

//         let prefix = "";
//         switch (req.body.membership_category_id) {
//           case "3":
//             prefix = "LM";
//             break;
//           case "4":
//             prefix = "GM";
//             break;
//           case "6":
//             prefix = "SM";
//             break;
//           default:
//             prefix = "MB"; // fallback
//         }
//         // Get max ID for this category
//         const maxEntry = await MemberModel.findOne({
//           where: { membership_category_id: req.body.membership_category_id },
//           order: [["id", "DESC"]],
//           attributes: ["id"],
//         });

//         const nextId = maxEntry ? maxEntry.id + 1 : 1;
//         const membership_number = `${prefix}${nextId}`;

//         if (
//           req.file !== undefined &&
//           req.body.name !== "" &&
//           req.body.phone_number !== ""
//         ) {
//           let insert_data = {
//             membership_number: membership_number,
//             name: req.body.name,
//             phone_number: req.body.phone_number,
//             email: req.body.email,
//             session: req.body.session,
//             hsc_passing_year: req.body.hsc_passing_year,
//             occupation: req.body.occupation,
//             organization_name: req.body.organization_name,
//             designation_name: req.body.designation_name,
//             status: req.body.status,
//             password: req.body.password,
//             admin_approval: req.body.admin_approval,
//             membership_category_id: req.body.membership_category_id,
//             address: req.body.address,
//             member_image: image,
//           };
//           const save_date = await MemberModel.create(insert_data).catch(
//             errorHandlerProductList
//           );
//           req.flash("success", "Data add successfully!");
//           res.redirect("/member/add");
//         }
//       }
//     });
//   },
// ];
// End tareq vai code

///// start akash code GM,LM,ST
exports.add = [
  async (req, res, next) => {
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, "public/member");
      },
      filename: (req, file, cb) => {
        cb(null, "member_" + Date.now() + path.extname(file.originalname));
      },
    });
    const upload = multer({
      storage: storage,
      limits: { fileSize: 50 * 1024 * 1024 },
    }).single("_image");

    const errorHandlerProductList = (err) => {
      req.flash("error", err.original?.sqlMessage || err);
      res.redirect("/member/add");
    };
    const errorHandlerUpload = async (err) => {
      req.flash("error", err);
      res.redirect("/member/add");
    };
    const errorHandler = async (err) => {
      req.flash("error", err);
      res.redirect("/member/add");
    };

    upload(req, res, async (err) => {
      if (err) {
        await errorHandlerUpload(err);
      } else {
        let image = "";
        if (req.file === undefined) {
          req.flash("error", "Please add image");
          return res.redirect("/member/add");
        } else {
          const resizedImagePath = "public/member/resized_" + req.file.filename;
          await sharp(req.file.path)
            .resize(150, 150)
            .toFile(resizedImagePath)
            .catch(errorHandler);
          image = resizedImagePath.split("public/member/")[1];
        }

        if (!req.body.name) {
          req.flash("error", "Please enter name");
          return res.redirect("/member/add");
        }
        if (!req.body.phone_number) {
          req.flash("error", "Please enter phone number");
          return res.redirect("/member/add");
        }

        const prefix = await resolveMembershipPrefixByCategoryId(
          req.body.membership_category_id
        );

        // Get the last membership_number for this category
        const lastMember = await MemberModel.findOne({
          where: { membership_category_id: req.body.membership_category_id },
          order: [["id", "DESC"]],
          attributes: ["membership_number"],
        });

        let nextNumber = 1;
        if (lastMember && lastMember.membership_number) {
          const lastNumber = parseInt(
            lastMember.membership_number.replace(prefix, ""),
            10
          );
          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        }

        const membership_number = `${prefix}${nextNumber}`;

        // Insert into DB
        let insert_data = {
          membership_number: membership_number,
          name: req.body.name,
          phone_number: req.body.phone_number,
          email: req.body.email,
          session: req.body.session,
          hsc_passing_year: req.body.hsc_passing_year,
          occupation: req.body.occupation,
          organization_name: req.body.organization_name,
          designation_name: req.body.designation_name,
          status: req.body.status,
          password: req.body.password,
          admin_approval: req.body.admin_approval,
          approved_at: resolveApprovedAtValue(req.body.admin_approval),
          membership_category_id: req.body.membership_category_id,
          address: req.body.address,
          member_image: image,
        };

        await MemberModel.create(insert_data).catch(errorHandlerProductList);
        req.flash("success", "Data added successfully!");
        res.redirect("/member/add");
      }
    });
  },
];
///// end  akash code

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;

  const batch_session_list = await sequelize.query(
    `SELECT * FROM batch_session_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );
  const occupation_list = await sequelize.query(
    `SELECT * FROM occupation_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );
  const category_list = await sequelize.query(
    `SELECT * FROM category_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );

  const errorHandler = (err) => {
    req.flash("error", err.original.sqlMessage);
    res.redirect("/member/edit/" + id);
  };
  let result = await MemberModel.findOne({
    where: { id: id },
    order: [["id", "DESC"]],
  }).catch(errorHandler);
  res.render("member/edit", {
    membership_number: result.membership_number,
    name: result.name,
    phone_number: result.phone_number,
    email: result.email,
    session: result.session,
    hsc_passing_year: result.hsc_passing_year,
    occupation: result.occupation,
    organization_name: result.organization_name,
    designation_name: result.designation_name,
    status: result.status,
    admin_approval: result.admin_approval,
    batch_session_list: batch_session_list,
    occupation_list: occupation_list,
    password: result.password,
    category_list: category_list,
    member_image: result.member_image,
    membership_category_id: result.membership_category_id,
    address: result.address,
    id: result.id,
    validation: validations.all_field_validations(null, fields),
  });
};

exports.edit = [
  async (req, res, next) => {
    let id = req.params.id;
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, "public/member");
      },
      filename: (req, file, cb) => {
        cb(null, "member_" + Date.now() + path.extname(file.originalname));
      },
    });
    const upload = multer({
      storage: storage,
      limits: { fileSize: 50 * 1024 * 1024 },
    }).single("_image");

    const errorHandlerProductList = (err) => {
      req.flash("error", err.original.sqlMessage);
      res.redirect("/member/edit/" + id);
    };
    const errorHandlerUpload = async (err, _id) => {
      req.flash("error", err);
      res.redirect("/member/edit/" + id);
    };

    upload(req, res, async (err) => {
      if (err) {
        await errorHandlerUpload(err);
      } else {
        let image = "";
        if (req.file !== undefined) {
          image = req.file.filename;
        }
        if (req.body.name === "") {
          req.flash("error", "Please enter name");
          res.redirect("/member/edit/" + id);
        }
        if (req.body.phone_number === "") {
          req.flash("error", "Please enter phone number");
          res.redirect("/member/edit/" + id);
        }
        if (req.body.name !== "" && req.body.phone_number !== "") {
          const existingMember = await MemberModel.findOne({
            where: { id: req.body.id },
            attributes: ["approved_at"],
          }).catch(errorHandlerProductList);

          let update_data = {
            name: req.body.name,
            phone_number: req.body.phone_number,
            email: req.body.email,
            session: req.body.session,
            hsc_passing_year: req.body.hsc_passing_year,
            occupation: req.body.occupation,
            organization_name: req.body.organization_name,
            designation_name: req.body.designation_name,
            status: req.body.status,
            password: req.body.password,
            admin_approval: req.body.admin_approval,
            approved_at: resolveApprovedAtValue(
              req.body.admin_approval,
              existingMember?.approved_at || null
            ),
            membership_category_id: req.body.membership_category_id,
            address: req.body.address,
            member_image: image,
          };
          if (image === "") {
            delete update_data.member_image;
          }
          const save_date = await MemberModel.update(update_data, {
            where: { id: req.body.id },
          }).catch(errorHandlerProductList);
          req.flash("success", "Data update successfully!");
          res.redirect("/member/edit/" + id);
        }
      }
    });
  },
];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res
      .status(500)
      .json({ success: false, error: err.original.sqlMessage });
  };
  const results = await MemberModel.destroy({
    where: { id: req.body.del_id },
  }).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results,
  });
};

exports.approve = async (req, res, next) => {
  const errorHandler = (err) => {
    return res
      .status(500)
      .json({ success: false, error: err.original.sqlMessage });
  };
  const results = await MemberModel.update(
    { admin_approval: 1, approved_at: new Date() },
    { where: { id: req.body.approve_id } }
  ).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results,
  });
};

exports.not_approve = async (req, res, next) => {
  const errorHandler = (err) => {
    return res
      .status(500)
      .json({ success: false, error: err.original.sqlMessage });
  };
  const results = await MemberModel.update(
    { admin_approval: 0, approved_at: null },
    { where: { id: req.body.approve_id } }
  ).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results,
  });
};

exports.excel_report = [
  async (req, res, next) => {
    let file_name = "";
    const errors = validationResult(req);
    let validation = true;
    let validation_message = "";

    if (errors.errors.length !== 0) {
      validation = false;
      errors.errors.forEach((err) => {
        validation_message += err.msg + "<br />";
      });
      req.flash("error", validation_message);
      return res.redirect("/member");
    }

    try {
      file_name = "Excel_Member";
      const list = await sequelize.query(`SELECT * FROM member_list;`, {
        type: QueryTypes.SELECT,
      });

      let workbook = new excel.Workbook();
      let worksheet = workbook.addWorksheet("Members");

      worksheet.columns = [
        { header: "Membership Number", key: "membership_number", width: 20 },
        { header: "Name", key: "name", width: 20 },
        { header: "Phone Number", key: "phone_number", width: 20 },
        { header: "Email", key: "email", width: 25 },
        { header: "Address", key: "address", width: 30 },
        { header: "Session/Batch", key: "session", width: 15 },
        { header: "HSC Passing Year", key: "hsc_passing_year", width: 20 },
        { header: "Occupation", key: "occupation", width: 20 },
        { header: "Organization name", key: "organization_name", width: 25 },
        { header: "Designation name", key: "designation_name", width: 25 },
        {
          header: "Membership Category",
          key: "membership_category_id",
          width: 20,
        },
      ];

      const sanitize = (value) => {
        if (!value) return "";
        return String(value)
          .replace(/\\/g, "\\\\") // Escape backslashes
          .replace(/"/g, '\\"') // Escape double quotes
          .replace(/\r/g, "") // Remove carriage returns
          .replace(/\n/g, " "); // Replace newlines with space
      };

      list.forEach((member) => {
        const json_obj = {
          membership_number: sanitize(member.membership_number),
          name: sanitize(member.name),
          phone_number: sanitize(member.phone_number),
          email: sanitize(member.email),
          address: sanitize(member.address),
          session: sanitize(member.session),
          hsc_passing_year: sanitize(member.hsc_passing_year),
          occupation: sanitize(member.occupation),
          organization_name: sanitize(member.organization_name),
          designation_name: sanitize(member.designation_name),
          membership_category_id: sanitize(member.membership_category_id),
        };

        worksheet.addRow(json_obj);
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" + file_name + ".xlsx"
      );

      return workbook.xlsx.write(res).then(() => {
        res.status(200).end();
      });
    } catch (err) {
      console.error("Excel Export Error:", err);
      req.flash("error", "Excel export failed!");
      return res.redirect("/member");
    }
  },
];

/// akash code GM List export Excel Button
exports.expired_data_excel = async (req, res) => {
  try {
    const search_value = req.query.search || ""; // query দিয়ে filter করব
    const replacements = {};

    let search_query = "";
    if (search_value) {
      search_query = `
        AND (
          ml.name LIKE :search OR
          ml.email LIKE :search OR
          ml.phone_number LIKE :search
        )
      `;
      replacements.search = `%${search_value}%`;
    }

    const listRows = await sequelize.query(
      `
      SELECT 
        ml.id,
        ml.name,
        ml.phone_number,
        ml.email,
        ml.session,
        ml.admin_approval,
        ml.approved_at,
        ml.created_at,
        cl.category_name,
        cl.category_title,
        COALESCE(
          MAX(COALESCE(mp.tx_tran_date, mp.created_at, er.tx_tran_date, er.created_at)),
          NULL
        ) AS last_payment_raw
      FROM member_list ml
      INNER JOIN category_list cl ON cl.id = ml.membership_category_id
      LEFT JOIN member_ship_payments mp
        ON ml.id = mp.member_id
        AND mp.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN event_register er
        ON ml.id = er.member_id
        AND er.tx_status IN ('VALID', 'CASH_RECEIVED')
      WHERE ml.status = 1
        AND ml.admin_approval = 1
        ${search_query}
      GROUP BY ml.id
      ORDER BY ml.id DESC
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    const now = Date.now();
    const list = (listRows || [])
      .map((row) => {
        const categoryMeta = resolveCategoryMembershipMeta(row.category_title, row.category_name);
        const approvedDate = resolveEffectiveApprovedDate({
          adminApproval: row.admin_approval,
          approvedAt: row.approved_at,
          lastPaymentRaw: row.last_payment_raw,
          createdAt: row.created_at,
        });
        const isValidApprovedDate = !!approvedDate;
        const lastPaymentDate = row.last_payment_raw ? new Date(row.last_payment_raw) : null;

        let expireDate = null;
        if (categoryMeta.membership_type !== "lifetime" && isValidApprovedDate) {
          const durationMs =
            Number(categoryMeta.membership_duration_days || 365) * 24 * 60 * 60 * 1000;
          expireDate = new Date(approvedDate.getTime() + durationMs);
        }

        const status =
          categoryMeta.membership_type === "lifetime"
            ? "Active"
            : expireDate && expireDate.getTime() < now
              ? "Expired"
              : "Active";

        return {
          id: row.id,
          name: row.name,
          phone_number: row.phone_number,
          email: row.email,
          session: row.session,
          last_payment_date: formatDateYmd(lastPaymentDate),
          expire_date:
            categoryMeta.membership_type === "lifetime"
              ? "Lifetime"
              : formatDateYmd(expireDate),
          status,
        };
      })
      .filter((row) => row.status === "Expired");

    // === Excel File Generate ===
    const file_name = "Expired_Members";
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Expired Members");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Name", key: "name", width: 20 },
      { header: "Phone Number", key: "phone_number", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Session", key: "session", width: 15 },
      { header: "Last Payment Date", key: "last_payment_date", width: 20 },
      { header: "Expire Date", key: "expire_date", width: 20 },
      { header: "Status", key: "status", width: 15 },
    ];

    const sanitize = (value) => {
      if (!value) return "";
      return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "")
        .replace(/\n/g, " ");
    };

    list.forEach((member) => {
      worksheet.addRow({
        id: member.id,
        name: sanitize(member.name),
        phone_number: sanitize(member.phone_number),
        email: sanitize(member.email),
        session: sanitize(member.session),
        last_payment_date: sanitize(member.last_payment_date),
        expire_date: sanitize(member.expire_date),
        status: sanitize(member.status),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + file_name + ".xlsx"
    );

    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  } catch (err) {
    console.error("Excel Export Error:", err);
    return res.status(500).json({
      success: false,
      message: "Excel export failed!",
    });
  }
};

exports.mark_cash_received = async (req, res, next) => {
  try {
    const pendingPayment = await sequelize.query(
      `SELECT * FROM member_ship_payments
       WHERE member_id = :member_id
         AND payment_type = 'cash'
         AND tx_status = 'CASH_PENDING'
       ORDER BY id DESC
       LIMIT 1`,
      {
        replacements: { member_id: req.body.member_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!pendingPayment[0]) {
      return res.status(200).json({
        success: false,
        message: "No pending cash payment request found for this member.",
      });
    }

    await sequelize.query(
      `UPDATE member_ship_payments
       SET tx_status = 'CASH_RECEIVED',
           tx_tran_date = NOW(),
           updated_at = NOW()
       WHERE id = :id`,
      {
        replacements: { id: pendingPayment[0].id },
        type: QueryTypes.UPDATE,
      }
    );

    await MemberModel.update(
      {
        is_pay: 1,
        amount: pendingPayment[0].pay_amount,
        approved_at: new Date(),
        updated_at: new Date(),
      },
      { where: { id: req.body.member_id } }
    );

    return res.status(200).json({
      success: true,
      message: "Member cash payment received successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.original?.sqlMessage || error.message,
    });
  }
};

exports.mark_paid = async (req, res, next) => {
  try {
    await MemberModel.update(
      { is_pay: 1, approved_at: new Date(), updated_at: new Date() },
      { where: { id: req.body.member_id } }
    );

    return res.status(200).json({
      success: true,
      message: "Member marked as paid successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.original?.sqlMessage || error.message,
    });
  }
};

exports.mark_not_paid = async (req, res, next) => {
  try {
    await MemberModel.update(
      { is_pay: 0, updated_at: new Date() },
      { where: { id: req.body.member_id } }
    );

    return res.status(200).json({
      success: true,
      message: "Member marked as not paid successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.original?.sqlMessage || error.message,
    });
  }
};



exports.expired_delete = async (req, res) => {
  try {
    const id = Number(req.body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(200).json({ success: false, message: "Invalid member id." });
    }

    const deleted = await MemberModel.destroy({ where: { id } });
    if (!deleted) {
      return res.status(200).json({ success: false, message: "Member not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.original?.sqlMessage || error.message,
    });
  }
};

exports.expired_bulk_delete = async (req, res) => {
  try {
    let ids = req.body.selected_ids || [];

    if (typeof ids === "string") {
      try {
        ids = JSON.parse(ids);
      } catch (error) {
        ids = ids.split(",").map((id) => id.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(ids) || !ids.length) {
      req.flash("error", "Please select at least one expired member.");
      return res.redirect("/expired_members");
    }

    const cleanIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!cleanIds.length) {
      req.flash("error", "Selected member ids are invalid.");
      return res.redirect("/expired_members");
    }

    await MemberModel.destroy({ where: { id: cleanIds } });
    req.flash("success", `${cleanIds.length} expired member(s) deleted successfully.`);
    return res.redirect("/expired_members");
  } catch (error) {
    req.flash("error", error.original?.sqlMessage || error.message);
    return res.redirect("/expired_members");
  }
};
