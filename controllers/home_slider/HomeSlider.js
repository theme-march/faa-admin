const { sequelize, HomeSliderModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const sharp = require("sharp");

exports.list = (req, res, next) => {
  res.render('home_slider/index', {})
};

exports.data_list = async (req, res, next) => {
  let offset = req.body.start;
  let limit = req.body.length;
  let page_num = req.body.draw;
  let search = req.body['search[value]'];
  let query_str = "";
  if(search){
    query_str = " WHERE title like " + '%'+search+'%';
  }

  const query_data = await sequelize.query(`SELECT * FROM home_slider ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM home_slider ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "home_slider") });
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
  res.render('home_slider/add', {
    title: "",
    details: "",
    image: "",
    status: "",
  });
};

exports.add = [async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/home_slider_image');
    },
    filename:(req,file,cb)=>{
      cb(null, "home_slider_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_file');


  const errorHandlerProductList = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/home_slider/add');
  };
  const errorHandlerUpload = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/home_slider/add');
  };
  const errorHandler = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/home_slider/add');
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file === undefined){
        req.flash('error', "Please add document");
        res.redirect('/home_slider/add');
      }else{
        const resizedImagePath = 'public/home_slider_image/resized_' + req.file.filename;
        await sharp(req.file.path)
          .resize(1903, 660)
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split('public/home_slider_image/')[1];
        // image = req.file.filename;
      }

      if(req.file !== undefined ){
        let insert_data = {
          title: req.body.title,
          details: req.body.details,
          image: image,
          status: req.body.status
        };
        const save_date = await HomeSliderModel.create(insert_data).catch(errorHandlerProductList);
        req.flash('success', 'Data add successfully!');
        res.redirect('/home_slider/add');
      }
    }
  });
}];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/home_slider/edit/'+id);
  };
  let result = await HomeSliderModel.findOne({ where: {id: id} }).catch(errorHandler);
  res.render('home_slider/edit', {
    title: result.title,
    details: result.details,
    image: result.image,
    status: result.status,
    id: result.id,
  });
};

exports.edit = [async (req, res, next) => {
  let id = req.params.id;

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/home_slider_image');
    },
    filename:(req,file,cb)=>{
      cb(null, "home_slider_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_file');


  const errorHandlerProductList = (err) => {
    req.flash('error', err);
    res.redirect('/home_slider/edit/'+id);
  };
  const errorHandlerUpload = async (err) => {
    req.flash('error', err);
    res.redirect('/home_slider/edit/'+id);
  };
  const errorHandler = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/home_slider/add');
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file !== undefined){
        const resizedImagePath = 'public/home_slider_image/resized_' + req.file.filename;
        await sharp(req.file.path)
          .resize(1903, 660)
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split('public/home_slider_image/')[1];
        // image = req.file.filename;
      }

      if(req.body.title !== ""){
        let update_data = {
          title: req.body.title,
          details: req.body.details,
          image: image,
          status: req.body.status
        };
        if(image===""){
          delete update_data.image;
        }
        const update_date = await HomeSliderModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
        req.flash('success', 'Data update successfully!');
        res.redirect('/home_slider/edit/'+id);
      }

    }
  });
}];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await HomeSliderModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
