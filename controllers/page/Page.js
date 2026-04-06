const { sequelize, PageModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
    {param: 'title'},
    {param: 'details'},
    {param: 'slug'},
];

exports.list = (req, res, next) => {
    res.render('page/index', {})
};

exports.data_list = async (req, res, next) => {
    let offset = req.body.start;
    let limit = req.body.length;
    let page_num = req.body.draw;
    let search = req.body['search[value]'];
    let query_str = "WHERE status = 1 AND LOWER(title) <> 'executive committee' ";
    if(search){
        query_str = query_str + " AND title like " + '%'+search+'%';
    }

    const query_data = await sequelize.query(`SELECT id,title,details,slug,status FROM page ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM page ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "page") });
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
    res.render('page/add', {
        title: "",
        slug: "",
        details: "",
        status: 1,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.add = [
    check('title').notEmpty().withMessage('Please enter title'),
    check('slug').notEmpty().withMessage('Please enter slug'),
    async (req, res, next) => {

        const errors = validationResult(req);

        const errorHandler1 = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.redirect('/page/add');
        };

        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.render('page/add', {
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('page/add',{
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let insert_data = {
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
            };
            const save_date = await PageModel.create(insert_data).catch(errorHandler);
            req.flash('success', 'Data add successfully!');
            res.redirect('/page/add');
        }
    }];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/page/edit/'+id);
    };
    let result = await PageModel.findOne({ where: {id: id} }).catch(errorHandler);
    res.render('page/edit', {
        title: result.title,
        slug: result.slug,
        details: result.details,
        status: result.status,
        id: result.id,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.edit = [
    check('title').notEmpty().withMessage('Please enter title'),
    check('slug').notEmpty().withMessage('Please enter slug'),
    async (req, res, next) => {

        const errors = validationResult(req);

        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.render('page/edit', {
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('page/edit',{
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let update_data = {
                title: req.body.title,
                slug: req.body.slug,
                details: req.body.details,
                status: req.body.status,
                parent_id: 0,
                id: req.body.id,
            };
            const update_date = await PageModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
            req.flash('success', 'Data edit successfully!');
            res.redirect('/page/edit/'+req.body.id);
        }
    }];

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await PageModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
