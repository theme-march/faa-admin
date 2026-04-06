const { sequelize, PublicationModel, BranchModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const moment = require('moment');

exports.list = (req, res, next) => {
    res.render('publication/index', { })
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

    const query_data = await sequelize.query(`SELECT * FROM publication ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM publication ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "publication") });
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
    res.render('publication/add', {
      title: "",
      details: "",
      cover_image: "",
      file: "",
      status: "",
      type: "",
    });
};

exports.add = [async (req, res, next) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/publication');
        },
        filename:(req,file,cb)=>{
            cb(null, "publication_"+Date.now()+path.extname(file.originalname));
        }
    });
    const uploads = multer({
        storage: storage,
        limits: { fileSize: 6 * 1024 * 1024 }
    }).array('ff', 2);


    const errorHandlerProductList = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/publication/add');
    };
    const errorHandlerUpload = async (err, _id) => {
        req.flash('error', err);
        res.redirect('/publication/add');
    };

    // Upload image
    uploads(req, res, async ( err ) => {
        if (err) {
            await errorHandlerUpload(err);
        } else {
            if(req.files[0] === undefined || req.files[1] === undefined){
                req.flash('error', "Please add image and file");
                res.redirect('/publication/add');
            }
            if(req.body.title === ""){
                req.flash('error', "Please enter title");
                res.redirect('/publication/add');
            }

            if(req.files[0] !== undefined && req.files[1] !== undefined && req.body.title !== "" ){
                let insert_data = {
                  title: req.body.title,
                  details: req.body.details,
                  type: req.body.type,
                  cover_image: req.files[0].filename,
                  file: req.files[1].filename,
                  status: req.body.status
                };
                const save_date = await PublicationModel.create(insert_data).catch(errorHandlerProductList);
                req.flash('success', 'Data add successfully!');
                res.redirect('/publication/add');
            }
        }
    });
}];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/publication/edit/'+id);
    };
    let result = await PublicationModel.findOne({ where: {id: id} }).catch(errorHandler);
    res.render('publication/edit', {
      title: result.title,
      details: result.details,
      type: result.type,
      cover_image: result.cover_image,
      file: result.file,
      status: result.status,
      id: result.id,
    });
};

exports.edit = [async (req, res, next) => {
    let id = req.params.id;

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/publication');
        },
        filename:(req,file,cb)=>{
            cb(null, "publication_"+Date.now()+path.extname(file.originalname));
        }
    });
    const uploads = multer({
        storage: storage,
        limits: { fileSize: 6 * 1024 * 1024 }
    }).array('ff', 2);


    const errorHandlerProductList = (err) => {
        req.flash('error', err);
        res.redirect('/publication/edit/'+id);
    };
    const errorHandlerUpload = async (err) => {
        req.flash('error', err);
        res.redirect('/publication/edit/'+id);
    };

    // Upload image
    uploads(req, res, async ( err ) => {
        if (err) {
            await errorHandlerUpload(err);
        } else {
            if(req.body.title === ""){
                req.flash('error', "Please enter title");
                res.redirect('/publication/edit/'+id);
            }

            if(req.body.title !== ""){
                let update_data = {
                  title: req.body.title,
                  details: req.body.details,
                  type: req.body.type,
                  cover_image: req.files[0] === undefined ? '' : req.files[0].filename,
                  file: req.files[1] === undefined ? '' : req.files[1].filename,
                  status: req.body.status
                };
                if(req.files[0]===undefined){
                    delete update_data.cover_image;
                }
                if(req.files[1]===undefined){
                    delete update_data.file;
                }

                const update_date = await PublicationModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
                req.flash('success', 'Data update successfully!');
                res.redirect('/publication/edit/'+id);
            }

        }
    });
}];

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await PublicationModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
