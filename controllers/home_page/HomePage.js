const { sequelize, HomePageModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
  {param: 'title'},
  {param: 'details'},
  {param: 'url'},
  {param: 'section'},
  {param: 'order_by'},
  {param: 'status'},
];

exports.list = (req, res, next) => {
  res.render('home_page/index', { })
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;

  const query_data = await sequelize.query(`SELECT * FROM home_page ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM home_page;`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del_add_image(e.id, "home_page") });
  let num_of_rows = query_data_count[0].num_of_row;

  if(query_data.length !== 0){
    return res.status(200).json({
      success: true,
      recordsTotal: query_data.length,
      recordsFiltered: num_of_rows,
      data: query_data,
    });
  }else{
    return res.status(200).json({
      success: true,
      recordsTotal: 0,
      recordsFiltered: 0,
      data: query_data,
    });
  }
};

exports.add_from = async (req, res, next) => {
  res.render('home_page/add', {
    title: "",
    details: "",
    url: "",
    section: "",
    order_by: "",
    status: 1,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.add = [
  check('title').notEmpty().withMessage('Please enter title'),
  check('details').notEmpty().withMessage('Please enter details'),
  check('url').notEmpty().withMessage('Please enter url'),
  check('section').notEmpty().withMessage('Please select section'),
  check('order_by').notEmpty().withMessage('Please enter order by'),
  check('status').notEmpty().withMessage('Please enter status'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('home_page/add', {
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('home_page/add',{
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let insert_data = {
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
      };
      const save_date = await HomePageModel.create(insert_data).catch(errorHandler);
      req.flash('success', 'Data add successfully!');
      res.redirect('/home_page/add');
    }
  }];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/home_page/edit/'+id);
  };
  let result = await HomePageModel.findOne({ where: {id: id} }).catch(errorHandler);
  res.render('home_page/edit', {
    title: result.title,
    details: result.details,
    url: result.url,
    section: result.section,
    order_by: result.order_by,
    status: result.status,
    id: result.id,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.edit = [
  check('title').notEmpty().withMessage('Please enter title'),
  check('details').notEmpty().withMessage('Please enter details'),
  check('url').notEmpty().withMessage('Please enter url'),
  check('section').notEmpty().withMessage('Please select section'),
  check('order_by').notEmpty().withMessage('Please enter order by'),
  check('status').notEmpty().withMessage('Please enter status'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('home_page/edit', {
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('home_page/edit',{
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let update_data = {
        title: req.body.title,
        details: req.body.details,
        url: req.body.url,
        section: req.body.section,
        order_by: req.body.order_by,
        status: req.body.status,
        id: req.body.id,
      };
      const update_date = await HomePageModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
      req.flash('success', 'Data edit successfully!');
      res.redirect('/home_page/edit/'+req.body.id);
    }
  }];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await HomePageModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};

