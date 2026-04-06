const { sequelize, ProgramsModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');

exports.list = (req, res, next) => {
  res.render('programs/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;

  const query_data = await sequelize.query(`SELECT * FROM programs ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM programs;`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "programs") });
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
  res.render('programs/add', {
    title: "",
    details: "",
    order_by: "",
    image: "",
    status: "",
  });
};

exports.add = [async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/programs');
    },
    filename:(req,file,cb)=>{
      cb(null, "programs_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_image');


  const errorHandlerProductList = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/programs/add');
  };
  const errorHandlerUpload = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/programs/add');
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file === undefined){
        req.flash('error', "Please add slider image");
        res.redirect('/programs/add');
      }else{
        image = req.file.filename;
      }
      if(req.body.title === ""){
        req.flash('error', "Please enter title");
        res.redirect('/programs/add');
      }
      if(req.body.order_by === ""){
        req.flash('error', "Please enter order by");
        res.redirect('/programs/add');
      }

      if(req.file !== undefined && req.body.title !== "" && req.body.order_by !== ""){
        let insert_data = {
          title: req.body.title,
          details: req.body.details,
          order_by: req.body.order_by,
          image: image,
          status: req.body.status,
        };
        const save_date = await ProgramsModel.create(insert_data).catch(errorHandlerProductList);
        req.flash('success', 'Data add successfully!');
        res.redirect('/programs/add');
      }
    }
  });
}];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/programs/edit/'+id);
  };
  let result = await ProgramsModel.findOne({ where: {id: id} }).catch(errorHandler);
  res.render('programs/edit', {
    title: result.title,
    details: result.details,
    order_by: result.order_by,
    image: result.image,
    status: result.status,
    id: result.id,
  });
};

exports.edit = [async (req, res, next) => {
  let id = req.params.id;

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/programs');
    },
    filename:(req,file,cb)=>{
      cb(null, "programs_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_image');


  const errorHandlerProductList = (err) => {
    req.flash('error', err);
    res.redirect('/programs/edit/'+id);
  };
  const errorHandlerUpload = async (err) => {
    req.flash('error', err);
    res.redirect('/programs/edit/'+id);
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file !== undefined){
        image = req.file.filename;
      }
      if(req.body.title === ""){
        req.flash('error', "Please enter title");
        res.redirect('/programs/add');
      }
      if(req.body.order_by === ""){
        req.flash('error', "Please enter order by");
        res.redirect('/programs/edit/'+id);
      }

      if(req.body.title !== "" && req.body.order_by !== ""){
        let update_data = {
          title: req.body.title,
          details: req.body.details,
          order_by: req.body.order_by,
          image: image,
          status: req.body.status,
        };
        if(image===""){
          delete update_data.image;
        }
        const update_date = await ProgramsModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
        req.flash('success', 'Data update successfully!');
        res.redirect('/programs/edit/'+id);
      }

    }
  });
}];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await ProgramsModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
