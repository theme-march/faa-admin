const { sequelize, BatchSessionModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
  {param: 'batch_session_name'},
];

exports.list = (req, res, next) => {
  res.render('batch_session/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = "";
  if(search){
    query_str = " WHERE batch_session_name like " + '%'+search+'%';
  }

  const query_data = await sequelize.query(`SELECT * FROM batch_session_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM batch_session_list ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "batch_session") });
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
  res.render('batch_session/add', {
    batch_session_name: "",
    status: 1,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.add = [
  check('batch_session_name').notEmpty().withMessage('Please enter batch session name'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('batch_session/add', {
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('batch_session/add',{
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let insert_data = {
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
      };
      const save_date = await BatchSessionModel.create(insert_data).catch(errorHandler);
      req.flash('success', 'Data add successfully!');
      res.redirect('/batch_session/add');
    }
  }];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/batch_session/edit/'+id);
  };
  let result = await BatchSessionModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
  res.render('batch_session/edit', {
    batch_session_name:result.batch_session_name,
    status: result.status,
    id: result.id,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.edit = [
  check('batch_session_name').notEmpty().withMessage('Please enter batch session name'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('batch_session/edit', {
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('batch_session/edit',{
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let update_data = {
        batch_session_name: req.body.batch_session_name,
        status: req.body.status,
        id: req.body.id,
      };
      const update_date = await BatchSessionModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
      req.flash('success', 'Data edit successfully!');
      res.redirect('/batch_session/edit/'+req.body.id);
    }
  }];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await BatchSessionModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
