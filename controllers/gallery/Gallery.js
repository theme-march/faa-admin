const { sequelize, GalleryModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const sharp = require("sharp");

exports.list = (req, res, next) => {
  res.render('gallery/index', {})
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

  const query_data = await sequelize.query(`SELECT * FROM gallery ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
  const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM gallery ${query_str};`, { type: QueryTypes.SELECT });

  query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "gallery") });
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
  res.render('gallery/add', {
    title: "",
    image: "",
    status: "",
  });
};

exports.add = [async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/gallery_image');
    },
    filename:(req,file,cb)=>{
      cb(null, "gallery_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_file');


  const errorHandlerProductList = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/gallery/add');
  };
  const errorHandlerUpload = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/gallery/add');
  };
  const errorHandler = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/gallery/add');
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file === undefined){
        req.flash('error', "Please add document");
        res.redirect('/gallery/add');
      }else{
        const resizedImagePath = 'public/gallery_image/resized_' + req.file.filename;
        await sharp(req.file.path)
          .resize(393, 447) // Resize to 300x300 pixels
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split('public/gallery_image/')[1];
        // image = req.file.filename;
      }

      if(req.file !== undefined ){
        let insert_data = {
          title: req.body.title,
          image: image,
          status: req.body.status
        };
        const save_date = await GalleryModel.create(insert_data).catch(errorHandlerProductList);
        req.flash('success', 'Data add successfully!');
        res.redirect('/gallery/add');
      }
    }
  });
}];

exports.edit_from = async (req, res, next) => {
  let id = req.params.id;
  const errorHandler = (err) => {
    req.flash('error', err.original.sqlMessage);
    res.redirect('/gallery/edit/'+id);
  };
  let result = await GalleryModel.findOne({ where: {id: id} }).catch(errorHandler);
  res.render('gallery/edit', {
    title: result.title,
    image: result.image,
    status: result.status,
    id: result.id,
  });
};

exports.edit = [async (req, res, next) => {
  let id = req.params.id;

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/gallery_image');
    },
    filename:(req,file,cb)=>{
      cb(null, "gallery_"+Date.now()+path.extname(file.originalname));
    }
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).single('_file');


  const errorHandlerProductList = (err) => {
    req.flash('error', err);
    res.redirect('/gallery/edit/'+id);
  };
  const errorHandlerUpload = async (err) => {
    req.flash('error', err);
    res.redirect('/gallery/edit/'+id);
  };
  const errorHandler = async (err, _id) => {
    req.flash('error', err);
    res.redirect('/gallery/add');
  };

  // Upload image
  upload(req, res, async ( err ) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if(req.file !== undefined){
        const resizedImagePath = 'public/gallery_image/resized_' + req.file.filename;
        await sharp(req.file.path)
          .resize(393, 447) // Resize to 300x300 pixels
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split('public/gallery_image/')[1];
        // image = req.file.filename;
      }

      if(req.body.title !== ""){
        let update_data = {
          title: req.body.title,
          image: image,
          status: req.body.status
        };
        if(image===""){
          delete update_data.image;
        }
        const update_date = await GalleryModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
        req.flash('success', 'Data update successfully!');
        res.redirect('/gallery/edit/'+id);
      }

    }
  });
}];

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(500).json({success: false, error: err.original.sqlMessage});
  };
  const results = await GalleryModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
  return res.status(200).json({
    success: true,
    result: results
  });
};
