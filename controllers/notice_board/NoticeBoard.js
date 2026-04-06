const { sequelize, NoticeBoardModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');

exports.list = (req, res, next) => {
    res.render('notice_board/index', {})
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

    const query_data = await sequelize.query(`SELECT * FROM notice_board ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM notice_board ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "notice_board") });
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
    res.render('notice_board/add', {
        notice_name: "",
        published_date: "",
        closing_date: "",
        document: "",
        status: "",
    });
};

exports.add = [async (req, res, next) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/notice_board');
        },
        filename:(req,file,cb)=>{
            cb(null, "notice_board_"+Date.now()+path.extname(file.originalname));
        }
    });
    const upload = multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 }
    }).single('_file');


    const errorHandlerProductList = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/notice_board/add');
    };
    const errorHandlerUpload = async (err, _id) => {
        req.flash('error', err);
        res.redirect('/notice_board/add');
    };

    // Upload image
    upload(req, res, async ( err ) => {
        if (err) {
            await errorHandlerUpload(err);
        } else {
            let image = "";
            if(req.file === undefined){
                req.flash('error', "Please add document");
                res.redirect('/notice_board/add');
            }else{
                image = req.file.filename;
            }
            if(req.body.notice_name === ""){
                req.flash('error', "Please enter notice name");
                res.redirect('/notice_board/add');
            }
            if(req.body.published_date === ""){
                req.flash('error', "Please enter published date");
                res.redirect('/notice_board/add');
            }
            if(req.body.closing_date === ""){
                req.flash('error', "Please enter closing date");
                res.redirect('/notice_board/add');
            }

            if(req.file !== undefined && req.body.notice_name !== "" && req.body.published_date !== "" && req.body.closing_date !== ""){
                let insert_data = {
                    notice_name: req.body.notice_name,
                    published_date: req.body.published_date,
                    closing_date: req.body.closing_date,
                    document: image,
                    status: req.body.status
                };
                const save_date = await NoticeBoardModel.create(insert_data).catch(errorHandlerProductList);
                req.flash('success', 'Data add successfully!');
                res.redirect('/notice_board/add');
            }
        }
    });
}];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/notice_board/edit/'+id);
    };
    let result = await NoticeBoardModel.findOne({ where: {id: id} }).catch(errorHandler);
    res.render('notice_board/edit', {
        notice_name: result.notice_name,
        published_date: result.published_date,
        closing_date: result.closing_date,
        document: result.document,
        status: result.status,
        id: result.id,
    });
};

exports.edit = [async (req, res, next) => {
    let id = req.params.id;

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/notice_board');
        },
        filename:(req,file,cb)=>{
            cb(null, "notice_board_"+Date.now()+path.extname(file.originalname));
        }
    });
    const upload = multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 }
    }).single('_file');


    const errorHandlerProductList = (err) => {
        req.flash('error', err);
        res.redirect('/notice_board/edit/'+id);
    };
    const errorHandlerUpload = async (err) => {
        req.flash('error', err);
        res.redirect('/notice_board/edit/'+id);
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
            if(req.body.notice_name === ""){
                req.flash('error', "Please enter notice name");
                res.redirect('/notice_board/add');
            }
            if(req.body.published_date === ""){
                req.flash('error', "Please enter published date");
                res.redirect('/notice_board/add');
            }
            if(req.body.closing_date === ""){
                req.flash('error', "Please enter closing date");
                res.redirect('/notice_board/add');
            }

            if(req.body.notice_name !== "" && req.body.published_date !== "" && req.body.closing_date !== ""){
                let update_data = {
                    notice_name: req.body.notice_name,
                    published_date: req.body.published_date,
                    closing_date: req.body.closing_date,
                    document: image,
                    status: req.body.status
                };
                if(image===""){
                    delete update_data.document;
                }
                const update_date = await NoticeBoardModel.update(update_data,{ where: { id: req.body.id } }).catch(errorHandlerProductList);
                req.flash('success', 'Data update successfully!');
                res.redirect('/notice_board/edit/'+id);
            }

        }
    });
}];

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await NoticeBoardModel.destroy({ where: { id: req.body.del_id } }).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
