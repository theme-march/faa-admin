const { sequelize, EventModel, EventImageModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const path = require('path');
const multer = require('multer');
const moment = require('moment');

exports.media_list_add_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/event/media_list/'+id);
    };
    let media_list = await EventImageModel.findAll({ where: {event_id: id}, order: [ [ 'id', 'ASC' ]] }).catch(errorHandler);
    res.render('event/media_list', {
        media_list: media_list,
        title: "",
        image: "",
        status: "",
        id: id,
    });
};

exports.media_list_add = [async (req, res, next) => {
    let id = req.params.id;
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/event_image/');
        },
        filename: function (req, file, cb) {
            cb(null, Date.now()+path.extname(file.originalname))
        }
    });
    const uploads = multer({
        storage: storage,
        limits: { fileSize: 50 * 1024 * 1024 }
    }).array('ff', 30);

    uploads(req, res, async ( err ) => {

        const errorHandlerProductList = (err) => {
            console.log("err==",err);
            req.flash('error', err.original.sqlMessage);
            res.redirect('/event/media_list/'+id);
        };
        let media_list = await EventImageModel.findAll({ where: {event_id: id}, order: [ [ 'id', 'ASC' ]] }).catch(errorHandlerProductList);

        if(media_list.length !== 0){
            req.flash('success', "Update successfully");
            res.redirect('/event/media_list/'+id);
        }else{
            let files = [];
            let isSave = true;
            if (Array.isArray(req.body.title)){
                for (let i=0;i<req.body.title.length;i++){
                    if(req.body.title[i] === ""){
                        isSave = false;
                        req.flash('error', "Please enter title");
                        res.redirect('/event/media_list/'+id);
                    }else{
                        if(req.files[i] === undefined){
                            isSave = false;
                            req.flash('error', "Please select title");
                            res.redirect('/event/media_list/'+id);
                        }
                        files.push({
                            title: req.body.title[i],
                            thm: req.files[i].filename,
                        });
                    }
                }
            }
            if(isSave){
                for (let j=0;j<files.length;j++){
                    let insert_data = {
                        event_id: id,
                        image: files[j].thm,
                        title: files[j].title
                    };
                    const save_date = await EventImageModel.create(insert_data).catch(errorHandlerProductList);
                }
                req.flash('success', 'Data add successfully!');
                res.redirect('/event/media_list/'+id);
            }
        }
    });
}];

