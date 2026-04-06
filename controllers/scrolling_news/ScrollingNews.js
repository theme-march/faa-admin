const { sequelize, ScrollingNewsModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
    {param: 'title'},
    {param: 'order_by'},
];

exports.list = (req, res, next) => {
    res.render('scrolling_news/index', {})
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

    const query_data = await sequelize.query(`SELECT * FROM scrolling_news ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM scrolling_news ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "scrolling_news") });
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
    res.render('scrolling_news/add', {
        title: "",
        order_by: "",
        status: 1,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.add = [
    check('title').notEmpty().withMessage('Please enter title'),
    check('order_by').notEmpty().withMessage('Please enter order order_by'),
    async (req, res, next) => {

        const errors = validationResult(req);
        const errorHandler = (err) => {
            console.log("err", err);
            req.flash('error', err.original.sqlMessage);
            res.render('scrolling_news/add', {
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('scrolling_news/add',{
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let insert_data = {
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
            };
            const save_date = await ScrollingNewsModel.create(insert_data).catch(errorHandler);
            req.flash('success', 'Data add successfully!');
            res.redirect('/scrolling_news/add');
        }
    }];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/scrolling_news/add');
    };
    let result = await ScrollingNewsModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
    res.render('scrolling_news/edit',{
        title: result.title,
        order_by: result.order_by,
        status: result.status,
        id: result.id,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.edit = [
    check('title').notEmpty().withMessage('Please enter title'),
    check('order_by').notEmpty().withMessage('Please enter order by'),
    async (req, res, next) => {

        const errors = validationResult(req);
        const errorHandler = (err) => {
            console.log("err", err);
            req.flash('error', err.original.sqlMessage);
            res.render('scrolling_news/add', {
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('scrolling_news/edit',{
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let update_data = {
                title: req.body.title,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
            };
            const update_date = await ScrollingNewsModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
            req.flash('success', 'Data edit successfully!');
            res.redirect('/scrolling_news/edit/'+req.body.id);
        }
    }];

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await ScrollingNewsModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
