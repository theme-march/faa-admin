const { sequelize, JobModel, BranchModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const moment = require('moment');

exports.list = (req, res, next) => {
  res.render('job/index', { })
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = "";
  if(search){
    query_str = " WHERE jon_title like " + '%'+search+'%';
  }

  const query_data = await sequelize.query(`SELECT * FROM job_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM job_list ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "job") });
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
  res.render('job/add', {
    job_title: "",
    job_details: "",
    experience: "",
    company: "",
    company_logo: "",
    location: "",
    post_date: "",
    deadline: "",
    link: "",
    file: "",
    status: "",
  });
};

exports.add = [async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/job');
    },
    filename:(req,file,cb)=>{
      cb(null, "job_"+Date.now()+path.extname(file.originalname));
    }
  });
  const uploads = multer({
    storage: storage,
    limits: { fileSize: 3 * 1024 * 1024 }
  }).array('ff', 2);


  const errorHandlerProductList = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/job/add');
  };
  const errorHandlerUpload = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/job/add');
  };

  // Upload image
  uploads(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      if(req.files[0] === undefined || req.files[1] === undefined){
        req.flash('error', "Please add company logo and file");
        res.redirect('/job/add');
      }
      if(req.body.job_title === ""){
        req.flash('error', "Please enter job title");
        res.redirect('/job/add');
      }

      if(req.files[0] !== undefined && req.files[1] !== undefined && req.body.job_title !== "" ){
        let insert_data = {
          job_title: req.body.job_title,
          job_details: req.body.job_details,
          experience: req.body.experience,
          company: req.body.company,
          location: req.body.location,
          post_date: req.body.post_date,
          deadline: req.body.deadline,
          link: req.body.link,
          company_logo: req.files[0].filename,
          file: req.files[1].filename,
          status: req.body.status
        };
        const save_date = await JobModel.create(insert_data).catch(errorHandlerProductList);
        req.flash('success', 'Data add successfully!');
        res.redirect('/job/add');
      }
    }
  });
}];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/job/edit/'+id);
  };
  let result = await JobModel.findOne({ where: {id: id} }).catch(errorHandler);
  res.render('job/edit', {
    job_title: result.job_title,
    job_details: result.job_details,
    experience: result.experience,
    company: result.company,
    location: result.location,
    post_date: result.post_date,
    deadline: result.deadline,
    link: result.link,
    company_logo: result.company_logo,
    file: result.file,
    status: result.status,
    id: result.id,
  });
};

exports.edit = [async (req, res, next) => {
  let id = req.params.id;

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/job');
    },
    filename:(req,file,cb)=>{
      cb(null, "job_"+Date.now()+path.extname(file.originalname));
    }
  });
  const uploads = multer({
    storage: storage,
    limits: { fileSize: 3 * 1024 * 1024 }
  }).array('ff', 2);


  const errorHandlerProductList = (err) => {
    req.flash('error', err);
    res.redirect('/job/edit/'+id);
  };
  const errorHandlerUpload = async (err) => {
    req.flash('error', err);
    res.redirect('/job/edit/'+id);
  };

  // Upload image
  uploads(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      if(req.body.job_title === ""){
        req.flash('error', "Please enter title");
        res.redirect('/job/edit/'+id);
      }

      if(req.body.job_title !== ""){
        let update_data = {
          job_title: req.body.job_title,
          job_details: req.body.job_details,
          experience: req.body.experience,
          company: req.body.company,
          location: req.body.location,
          post_date: req.body.post_date,
          deadline: req.body.deadline,
          link: req.body.link,
          company_logo: req.files[0] === undefined ? '' : req.files[0].filename,
          file: req.files[1] === undefined ? '' : req.files[1].filename,
          status: req.body.status
        };
        if(req.files[0]===undefined){
          delete update_data.company_logo;
        }
        if(req.files[1]===undefined){
          delete update_data.file;
        }

        const update_date = await JobModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
        req.flash('success', 'Data update successfully!');
        res.redirect('/job/edit/'+id);
      }

    }
  });
}];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await JobModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
