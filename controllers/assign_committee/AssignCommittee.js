const { sequelize, AssignCommitteeModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
  {param: 'membership_id'},
  {param: 'designation_id'},
];

exports.list = (req, res, next) => {
  let id = req.query.id;
  res.render('committee/assign_committee/index', {id: id})
};

exports.data_list = async (req, res, next) => {
  let id = req.query.id;
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = ` WHERE ac.committee_id=${id} `;
  if(search){
    query_str = query_str + " AND ml.name like " + '%'+search+'%';
  }

  const query_data = await sequelize.query(
                `SELECT ac.*,cl.committee_name,ml.name,dl.designation_name FROM assign_committee ac 
                  INNER JOIN committee_list cl ON cl.id=ac.committee_id
                  INNER JOIN member_list ml ON ml.id=ac.membership_id
                  INNER JOIN designation_list dl ON dl.id=ac.designation_id ${query_str} ORDER BY ac.id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(
                `SELECT COUNT(*) AS num_of_row FROM assign_committee ac 
                  INNER JOIN committee_list cl ON cl.id=ac.committee_id
                  INNER JOIN member_list ml ON ml.id=ac.membership_id
                  INNER JOIN designation_list dl ON dl.id=ac.designation_id ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "committee") });
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
  const member_list = await sequelize.query(`SELECT * FROM member_list WHERE status = 1;`, { type: QueryTypes.SELECT });
  const designation_list = await sequelize.query(`SELECT * FROM designation_list WHERE status = 1;`, { type: QueryTypes.SELECT });
  let id = req.query.id;
  res.render('committee/assign_committee/add', {
    id: id,
    member_list:member_list,
    designation_list:designation_list,
    membership_id: "",
    designation_id: "",
    validation: validations.all_field_validations(null, fields)
  });
};

exports.add = [
  check('membership_id').notEmpty().withMessage('Please select member'),
  check('designation_id').notEmpty().withMessage('Please select designation'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render(`committee/assign_committee/add?id=${req.body.id}`, {
        membership_id: req.body.membership_id,
        designation_id: req.body.designation_id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render(`committee/assign_committee/add?id=${req.body.id}`,{
        membership_id: req.body.membership_id,
        designation_id: req.body.designation_id,
        status: req.body.status,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let insert_data = {
        committee_id: req.body.id,
        membership_id: req.body.membership_id,
        designation_id: req.body.designation_id,
        status: req.body.status,
      };
      const save_date = await AssignCommitteeModel.create(insert_data).catch(errorHandler);
      req.flash('success', 'Data add successfully!');
      res.redirect(`committee/assign_committee/add?id=${req.body.id}`);
    }
  }];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/committee/edit/'+id);
  };
  let result = await AssignCommitteeModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
  res.render('committee/edit', {
    committee_name:result.committee_name,
    status: result.status,
    id: result.id,
    validation: validations.all_field_validations(null, fields)
  });
};

exports.edit = [
  check('committee_name').notEmpty().withMessage('Please enter committee name'),
  async (req, res, next) => {

    const errors = validationResult(req);

    const errorHandler = (err) => {
      req.flash('error', err.original.sqlMessage);
      res.render('committee/edit', {
        committee_name: req.body.committee_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(null, fields)
      });
    };
    if(errors.errors.length !== 0){
      res.render('committee/edit',{
        committee_name: req.body.committee_name,
        status: req.body.status,
        id: req.body.id,
        validation: validations.all_field_validations(errors.errors, fields)
      });
    }else{
      let update_data = {
        committee_name: req.body.committee_name,
        status: req.body.status,
        id: req.body.id,
      };
      const update_date = await AssignCommitteeModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
      req.flash('success', 'Data edit successfully!');
      res.redirect('/committee/edit/'+req.body.id);
    }
  }];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await AssignCommitteeModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
