const { sequelize, CategoryModel, MemberModel } = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');

const fields = [
  {param: 'category_name'},
  {param: 'membership_number_prefix'},
  {param: 'category_price'},
];

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function generatePrefixFromCategoryName(categoryName = "") {
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

  const initials = words.map((word) => word.charAt(0).toUpperCase()).join("").slice(0, 2);
  return initials || "MB";
}

function parseCategoryMeta(metaValue = "", categoryName = "") {
  const fallbackPrefix = generatePrefixFromCategoryName(categoryName);

  if (!metaValue) {
    return {
      membership_number_prefix: fallbackPrefix,
      membership_type: "time_limited",
      membership_duration_days: 365,
    };
  }

  try {
    const parsed = typeof metaValue === "string" ? JSON.parse(metaValue) : metaValue;
    const membershipType =
      String(parsed?.membership_type || "").toLowerCase() === "lifetime"
        ? "lifetime"
        : "time_limited";

    const durationRaw = Number(parsed?.membership_duration_days);
    const durationDays =
      membershipType === "lifetime"
        ? null
        : Number.isFinite(durationRaw) && durationRaw > 0
          ? durationRaw
          : 365;

    return {
      membership_number_prefix: String(parsed?.membership_number_prefix || fallbackPrefix).toUpperCase(),
      membership_type: membershipType,
      membership_duration_days: durationDays,
    };
  } catch (error) {
    return {
      membership_number_prefix: String(metaValue || fallbackPrefix).toUpperCase(),
      membership_type: "time_limited",
      membership_duration_days: 365,
    };
  }
}

function buildCategoryMeta(payload = {}) {
  const membershipType =
    String(payload.membership_type || "").toLowerCase() === "lifetime"
      ? "lifetime"
      : "time_limited";

  const durationRaw = Number(payload.membership_duration_days);
  const durationDays =
    membershipType === "lifetime"
      ? null
      : Number.isFinite(durationRaw) && durationRaw > 0
        ? durationRaw
        : 365;

  return JSON.stringify({
    membership_number_prefix: String(payload.membership_number_prefix || "MB").toUpperCase(),
    membership_type: membershipType,
    membership_duration_days: durationDays,
  });
}

function buildMembershipValidityLabel(meta = {}) {
  if (meta.membership_type === "lifetime") return "Lifetime";
  return `${Number(meta.membership_duration_days || 365)} Day(s)`;
}

async function syncMembershipNumberPrefixForCategory(categoryId, prefix) {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase();
  if (!categoryId || !normalizedPrefix) return;

  const members = await MemberModel.findAll({
    where: { membership_category_id: categoryId },
    attributes: ["id", "membership_number"],
    order: [["id", "ASC"]],
  });

  const updates = members.map((member, index) => {
    const currentMembershipNumber = String(member.membership_number || "");
    const numericPart = currentMembershipNumber.match(/(\d+)$/)?.[1] || String(index + 1);
    const nextMembershipNumber = `${normalizedPrefix}${numericPart}`;

    if (nextMembershipNumber === currentMembershipNumber) return null;

    return MemberModel.update(
      { membership_number: nextMembershipNumber },
      { where: { id: member.id } }
    );
  }).filter(Boolean);

  if (updates.length) {
    await Promise.all(updates);
  }
}

exports.list = (req, res, next) => {
  res.render('category/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = "";
  const replacements = { offset: Number(offset) || 0, limit: Number(limit) || 10 };
  if(search){
    query_str = " WHERE category_name LIKE :search";
    replacements.search = `%${search}%`;
  }

  const query_data = await sequelize.query(
    `SELECT * FROM category_list ${query_str} ORDER BY id DESC LIMIT :offset, :limit;`,
    { replacements, type: QueryTypes.SELECT }
  );
  const query_data_count = await sequelize.query(
    `SELECT COUNT(*) AS num_of_row FROM category_list ${query_str};`,
    { replacements, type: QueryTypes.SELECT }
  );

  query_data.forEach((row) => {
    const meta = parseCategoryMeta(row.category_title, row.category_name);
    row.membership_number_prefix = meta.membership_number_prefix;
    row.membership_type = meta.membership_type;
    row.membership_duration_days = meta.membership_duration_days;
    row.membership_validity_label = buildMembershipValidityLabel(meta);
  });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "category") });
  let num_of_rows = query_data_count[0].num_of_row;

  if(query_data.length !== 0){
    return res.status(200).json({
      success: true,
      recordsTotal: query_data.length,
      recordsFiltered: num_of_rows,
      data: query_data
    });
  }else{
    return res.status(200).json({
      success: true,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: query_data
    });
  }
};

exports.add_from = async (req, res, next) => {
  res.render('category/add', {
    category_name: "",
    membership_number_prefix: "MB",
    membership_type: "time_limited",
    membership_duration_days: 365,
    category_price: "",
    status: 1,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.add = [
  check('category_name').notEmpty().withMessage('Please enter category name'),
  check('membership_number_prefix').notEmpty().withMessage('Please enter membership number prefix'),
  check('category_price').notEmpty().withMessage('Please enter category price'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('category/add', {
        category_name: req.body.category_name,
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
        category_price: req.body.category_price,
        status: req.body.status,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('category/add',{
        category_name: req.body.category_name,
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
        category_price: req.body.category_price,
        status: req.body.status,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      const membershipMeta = buildCategoryMeta({
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
      });
      let insert_data = {
        category_title: membershipMeta,
        category_name: req.body.category_name,
        category_price: req.body.category_price,
        status: req.body.status,
      };
      const save_date = await CategoryModel.create(insert_data).catch(errorHandler);
      req.flash('success', 'Data add successfully!');
      res.redirect('/category/add');
    }
  }];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/category/edit/'+id);
  };
  let result = await CategoryModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
  const categoryMeta = parseCategoryMeta(result.category_title, result.category_name);
  res.render('category/edit', {
    category_title: result.category_title,
    category_name:result.category_name,
    membership_number_prefix: categoryMeta.membership_number_prefix,
    membership_type: categoryMeta.membership_type,
    membership_duration_days: categoryMeta.membership_duration_days,
    category_price:result.category_price,
    status: result.status,
    id: result.id,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.edit = [
  check('category_name').notEmpty().withMessage('Please enter category name'),
  check('membership_number_prefix').notEmpty().withMessage('Please enter membership number prefix'),
  check('category_price').notEmpty().withMessage('Please enter category price'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('category/edit', {
        category_title: req.body.category_title,
        category_name: req.body.category_name,
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
        category_price: req.body.category_price,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('category/edit',{
        category_title: req.body.category_title,
        category_name: req.body.category_name,
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
        category_price: req.body.category_price,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      const existingCategory = await CategoryModel.findOne({
        where: { id: req.body.id },
        attributes: ["category_title", "category_name"],
      }).catch(errorHandler);

      const membershipMeta = buildCategoryMeta({
        membership_number_prefix: req.body.membership_number_prefix,
        membership_type: req.body.membership_type,
        membership_duration_days: req.body.membership_duration_days,
      });
      let update_data = {
        category_title: membershipMeta,
        category_name: req.body.category_name,
        category_price: req.body.category_price,
        status: req.body.status,
        id: req.body.id,
      };
      const update_date = await CategoryModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
      const previousPrefix = parseCategoryMeta(
        existingCategory?.category_title,
        existingCategory?.category_name
      )?.membership_number_prefix;
      const nextPrefix = String(req.body.membership_number_prefix || "").trim().toUpperCase();

      if (previousPrefix !== nextPrefix) {
        await syncMembershipNumberPrefixForCategory(req.body.id, nextPrefix);
      }
      req.flash('success', 'Data edit successfully!');
      res.redirect('/category/edit/'+req.body.id);
    }
  }];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await CategoryModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
