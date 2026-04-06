const { sequelize, DesignationModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
  {param: 'designation_name'},
];

exports.list = (req, res, next) => {
  res.render('designation/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = "";
  if(search){
    query_str = " WHERE designation_name like " + '%'+search+'%';
  }

  const query_data = await sequelize.query(`SELECT * FROM designation_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM designation_list ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "designation") });
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
  res.render('designation/add', {
    designation_name: "",
    status: 1,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.add = [
  check('designation_name').notEmpty().withMessage('Please enter designation name'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('designation/add', {
        designation_name: req.body.designation_name,
        status: req.body.status,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('designation/add',{
        designation_name: req.body.designation_name,
        status: req.body.status,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let insert_data = {
        designation_name: req.body.designation_name,
        status: req.body.status,
      };
      const save_date = await DesignationModel.create(insert_data).catch(errorHandler);
      req.flash('success', 'Data add successfully!');
      res.redirect('/designation/add');
    }
  }];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/designation/edit/'+id);
  };
  let result = await DesignationModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
  res.render('designation/edit', {
    designation_name:result.designation_name,
    status: result.status,
    id: result.id,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.edit = [
  check('designation_name').notEmpty().withMessage('Please enter designation name'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('designation/edit', {
        designation_name: req.body.designation_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('designation/edit',{
        designation_name: req.body.designation_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let update_data = {
        designation_name: req.body.designation_name,
        status: req.body.status,
        id: req.body.id,
      };
      const update_date = await DesignationModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
      req.flash('success', 'Data edit successfully!');
      res.redirect('/designation/edit/'+req.body.id);
    }
  }];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await DesignationModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
