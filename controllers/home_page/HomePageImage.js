const { sequelize, MediaModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const moment = require('moment');
const sharp = require('sharp');

exports.media_list_add_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/home_page/media_list/'+id);
    };
    let media_list = await MediaModel.findAll({ where: {parent_id: id, type: "HomePage"}, order: [ [ 'id', 'ASC' ]] }).catch(errorHandler);
    res.render('home_page/media_list', {
        media_list: media_list,
        image: "",
        type: "",
        order_by: "",
        status: "",
        id: id,
    });
};

exports.media_list_add = [async (req, res, next) => {
  let id = req.params.id;
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/home_page_image/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  const uploads = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
  }).array('ff', 30);

  uploads(req, res, async (err) => {
    const errorHandlerProductList = (err) => {
      console.log("err==", err);
      req.flash('error', err.original.sqlMessage);
      res.redirect('/home_page/media_list/' + id);
    };

    // Immediately after upload, resize images
    const resizeImages = async () => {
      let files = req.files; // Array of all uploaded files
      let resizePromises = files.map(file => {
        let resizedImagePath = `public/home_page_image/resized_${file.filename}`;
        return sharp(file.path)
          .resize(530, 320) // Resize to desired dimensions
          .toFile(resizedImagePath)
          .then(() => {
            file.path = resizedImagePath; // Update file path to resized image path
            file.filename = resizedImagePath.split('public/home_page_image/')[1];
          });
      });
      await Promise.all(resizePromises);
    };

    if (err) {
      errorHandlerProductList(err);
    } else {
      await resizeImages(); // Resize images before proceeding

      let media_list = await MediaModel.findAll({
        where: { parent_id: id, type: "HomePage" },
        order: [['id', 'ASC']]
      }).catch(errorHandlerProductList);

      if (media_list.length !== 0) {
        req.flash('success', "Update successfully");
        res.redirect('/home_page/media_list/' + id);
      } else {
        let files = [];
        let isSave = true;
        if (Array.isArray(req.body.title)) {
          for (let i = 0; i < req.body.title.length; i++) {
            if (req.body.order_by[i] === "") {
              isSave = false;
              req.flash('error', "Please enter order by");
              res.redirect('/home_page/media_list/' + id);
            } else {
              if (req.files[i] === undefined) {
                isSave = false;
                req.flash('error', "Please select image");
                res.redirect('/home_page/media_list/' + id);
              }
              files.push({
                title: req.body.title[i],
                order_by: req.body.order_by[i],
                thm: req.files[i].filename, // Filename now points to resized image
              });
            }
          }
        }
        if (isSave) {
          for (let j = 0; j < files.length; j++) {
            let insert_data = {
              parent_id: id,
              image: files[j].thm,
              title: files[j].title,
              order_by: files[j].order_by,
              type: "HomePage"
            };
            await MediaModel.create(insert_data).catch(errorHandlerProductList);
          }
          req.flash('success', 'Data add successfully!');
          res.redirect('/home_page/media_list/' + id);
        }
      }
    }
  });
}];
