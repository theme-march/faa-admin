const { sequelize, AboutUsMessageModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const sharp = require("sharp");

exports.list = (req, res, next) => {
    res.render('about_us_message/index', {})
};

exports.data_list = async (req, res, next) => {
    let offset = req.body.start;
    let limit = req.body.length;
    let page_num = req.body.draw;
    let search = req.body['search[value]'];
    let query_str = "";
    if(search){
        query_str = " WHERE notice_name like " + '%'+search+'%';
    }

    const query_data = await sequelize.query(`SELECT * FROM about_us_message ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM about_us_message ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "about_us_message") });
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
    res.render('about_us_message/add', {
      name: "",
      designation: "",
      image: "",
      message: "",
      status: "",
    });
};

exports.add = [async (req, res, next) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/about_us_message_image');
        },
        filename:(req,file,cb)=>{
            cb(null, "about_us_message_"+Date.now()+path.extname(file.originalname));
        }
    });
    const upload = multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 }
    }).single('_file');

    const errorHandlerProductList = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/about_us_message/add');
    };
    const errorHandlerUpload = async (err, _id) => {
        req.flash('error', err);
        res.redirect('/about_us_message/add');
    };
    const errorHandler = async (err, _id) => {
        req.flash('error', err);
        res.redirect('/about_us_message/add');
    };

    // Upload image
    upload(req, res, async ( err ) => {
        if (err) {
            await errorHandlerUpload(err);
        } else {
            let image = "";
            if(req.file === undefined){
                req.flash('error', "Please add image");
                res.redirect('/about_us_message/add');
            }else{
              const resizedImagePath = 'public/about_us_message_image/resized_' + req.file.filename;
              await sharp(req.file.path)
                .resize(75, 76)
                .toFile(resizedImagePath)
                .catch(errorHandler);

              image = resizedImagePath.split('public/about_us_message_image/')[1];
              // image = req.file.filename;
            }

            if(req.file !== undefined ){
                let insert_data = {
                    name: req.body.name,
                    designation: req.body.designation,
                    message: req.body.message,
                    image: image,
                    status: req.body.status
                };
                const save_date = await AboutUsMessageModel.create(insert_data).catch(errorHandlerProductList);
                req.flash('success', 'Data add successfully!');
                res.redirect('/about_us_message/add');
            }
        }
    });
}];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/about_us_message/edit/'+id);
    };
    let result = await AboutUsMessageModel.findOne({ where: {id: id} }).catch(errorHandler);
    res.render('about_us_message/edit', {
        name: result.name,
        designation: result.designation,
        message: result.message,
        image: result.image,
        status: result.status,
        id: result.id,
    });
};

exports.edit = [async (req, res, next) => {
    let id = req.params.id;

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/about_us_message_image');
        },
        filename:(req,file,cb)=>{
            cb(null, "about_us_message_"+Date.now()+path.extname(file.originalname));
        }
    });
    const upload = multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 }
    }).single('_file');


    const errorHandlerProductList = (err) => {
        req.flash('error', err);
        res.redirect('/about_us_message/edit/'+id);
    };
    const errorHandlerUpload = async (err) => {
        req.flash('error', err);
        res.redirect('/about_us_message/edit/'+id);
    };

    // Upload image
    upload(req, res, async ( err ) => {
        if (err) {
            await errorHandlerUpload(err);
        } else {
            let image = "";
            if(req.file !== undefined){
              const resizedImagePath = 'public/about_us_message_image/resized_' + req.file.filename;
              await sharp(req.file.path)
                .resize(75, 76)
                .toFile(resizedImagePath)
                .catch(errorHandler);

              image = resizedImagePath.split('public/about_us_message_image/')[1];
                // image = req.file.filename;
            }

            if(req.body.name !== "" ){
                let update_data = {
                    name: req.body.name,
                    designation: req.body.published_date,
                    message: req.body.message,
                    image: image,
                    status: req.body.status
                };
                if(image===""){
                    delete update_data.image;
                }
                const update_date = await AboutUsMessageModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
                req.flash('success', 'Data update successfully!');
                res.redirect('/about_us_message/edit/'+id);
            }

        }
    });
}]

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await AboutUsMessageModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
