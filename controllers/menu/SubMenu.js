const { sequelize, MenuModel} = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
    {param: 'menu_name'},
    {param: 'menu_url'},
    {param: 'order_by'},
];

exports.list = (req, res, next) => {
    let id = req.query.parent_id;
    res.render('menu/sub_menu/index', {parent_id: id})
};

exports.data_list = async (req, res, next) => {
    let id = req.query.parent_id;
    let offset = req.body.start;
    let limit = req.body.length;
    let page_num = req.body.draw;
    let search = req.body['search[value]'];
    let query_str = "WHERE parent_id = '"+id+"' ";
    if(search){
        query_str = query_str + " AND menu_name like " + '%'+search+'%';
    }

    const query_data = await sequelize.query(`SELECT * FROM menu_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM menu_list ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del(e.id, "menu/sub_menu") });
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
    let parent_id = req.query.parent_id;
    res.render('menu/sub_menu/add', {
        parent_id: parent_id,
        menu_name: "",
        menu_url: "",
        order_by: "",
        status: 1,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.add = [
    check('menu_name').notEmpty().withMessage('Please enter menu name'),
    check('order_by').notEmpty().withMessage('Please enter order by'),
    async (req, res, next) => {

        const errors = validationResult(req);

        const errorHandler1 = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.redirect('/menu/sub_menu/add?parent_id='+req.body.parent_id);
        };

        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.render('menu/sub_menu/add', {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('menu/sub_menu/add',{
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let insert_data = {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                parent_id: req.body.parent_id,
                status: req.body.status,
            };
            const save_date = await MenuModel.create(insert_data).catch(errorHandler);
            req.flash('success', 'Data add successfully!');
            res.redirect('/menu/sub_menu/add?parent_id='+req.body.parent_id);
        }
    }];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/menu/sub_menu/edit/'+id);
    };
    let result = await MenuModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
    res.render('menu/sub_menu/edit', {
        menu_name:result.menu_name,
        menu_url:result.menu_url,
        order_by: result.order_by,
        status: result.status,
        parent_id: result.parent_id,
        id: result.id,
        validation: validations.all_field_validations(null, fields)
    });
};

exports.edit = [
    check('menu_name').notEmpty().withMessage('Please enter menu name'),
    check('order_by').notEmpty().withMessage('Please enter order by'),
    async (req, res, next) => {

        const errors = validationResult(req);

        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.render('menu/sub_menu/edit', {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('menu/sub_menu/edit',{
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(errors.errors, fields)
            });
        }else{
            let update_data = {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
            };
            const update_date = await MenuModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
            req.flash('success', 'Data edit successfully!');
            res.redirect('/menu/sub_menu/edit/'+req.body.id);
        }
    }];

exports.delete = async (req, res, next) => {
    const errorHandler = (err) => {
        return res.status(500).json({success: false, error: err.original.sqlMessage});
    };
    const results = await MenuModel.destroy({where:{id:req.body.del_id}}).catch(errorHandler);
    return res.status(200).json({
        success: true,
        result: results
    });
};
