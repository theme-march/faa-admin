const { sequelize, MenuModel, PageModel } = require("../../models");
const { QueryTypes } = require('sequelize');
const CommonFunction = require('../common_function');
const validations = require('../validations');
const { check, validationResult } = require('express-validator');
const fields = [
    {param: 'menu_name'},
    {param: 'menu_url'},
    {param: 'order_by'},
];
const HEADER_LOGO_SETTINGS_SLUG = "header-logo-settings-json";
const defaultHeaderSettings = {
    headerLogoUrl: "",
    headerTitle: "Finance Alumni Association",
    headerSubtitle: "Creating Value Through Fellowship",
};

const parseJson = (value, fallback) => {
    try {
        if (!value) return fallback;
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object") return fallback;
        return { ...fallback, ...parsed };
    } catch (error) {
        return fallback;
    }
};

exports.list = async (req, res, next) => {
    res.render('menu/index', {})
};

exports.header_branding_form = async (req, res, next) => {
    try {
        const row = await PageModel.findOne({ where: { slug: HEADER_LOGO_SETTINGS_SLUG } });
        const settings = parseJson(row?.details, defaultHeaderSettings);
        res.render('header_branding_settings/index', {
            headerSettings: {
                headerLogoUrl: settings.headerLogoUrl || settings.header_logo_url || "",
                headerTitle: settings.headerTitle || settings.header_title || defaultHeaderSettings.headerTitle,
                headerSubtitle: settings.headerSubtitle || settings.header_subtitle || defaultHeaderSettings.headerSubtitle,
            }
        });
    } catch (error) {
        req.flash('error', error.message);
        res.render('header_branding_settings/index', { headerSettings: defaultHeaderSettings });
    }
};

exports.data_list = async (req, res, next) => {
    let offset = req.body.start;
    let limit = req.body.length;
    let page_num = req.body.draw;
    let search = req.body['search[value]'];
    let query_str = "WHERE parent_id = 0 ";
    if(search){
        query_str = query_str + " AND menu_name like " + '%'+search+'%';
    }

    const query_data = await sequelize.query(`SELECT * FROM menu_list ${query_str} ORDER BY id DESC LIMIT ${offset}, ${limit};`, { type: QueryTypes.SELECT });
    const query_data_count = await sequelize.query(`SELECT COUNT(*) AS num_of_row FROM menu_list ${query_str};`, { type: QueryTypes.SELECT });

    query_data.forEach(function(e) { e.action = CommonFunction.action_menu_edit_del_sub(e.id, "menu") });
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
    res.render('menu/add', {
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
            res.redirect('/menu/add');
        };
        let result = await MenuModel.findAll().catch(errorHandler1);

        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.render('menu/add', {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('menu/add',{
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
                parent_id: 0,
                status: req.body.status,
            };
            const save_date = await MenuModel.create(insert_data).catch(errorHandler);
            req.flash('success', 'Data add successfully!');
            res.redirect('/menu/add');
        }
    }];

exports.edit_from = async (req, res, next) => {
    let id = req.params.id;
    const errorHandler = (err) => {
        req.flash('error', err.original.sqlMessage);
        res.redirect('/menu/edit/'+id);
    };
    let result = await MenuModel.findOne({ where: {id: id}, order: [ [ 'id', 'DESC' ]] }).catch(errorHandler);
    res.render('menu/edit', {
        menu_name:result.menu_name,
        menu_url:result.menu_url,
        order_by: result.order_by,
        status: result.status,
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
            res.render('menu/edit', {
                menu_name: req.body.menu_name,
                menu_url: req.body.menu_url,
                order_by: req.body.order_by,
                status: req.body.status,
                id: req.body.id,
                validation: validations.all_field_validations(null, fields)
            });
        };
        if(errors.errors.length !== 0){
            res.render('menu/edit',{
                menu_name: req.body.menu_name,
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
                parent_id: 0,
                id: req.body.id,
            };
            const update_date = await MenuModel.update(update_data, { where: { id: req.body.id } }).catch(errorHandler);
            req.flash('success', 'Data edit successfully!');
            res.redirect('/menu/edit/'+req.body.id);
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

exports.update_header_logo = async (req, res, next) => {
    try {
        const existing = await PageModel.findOne({ where: { slug: HEADER_LOGO_SETTINGS_SLUG } });
        const existingSettings = parseJson(existing?.details, defaultHeaderSettings);

        let headerLogoUrl = existingSettings.headerLogoUrl || existingSettings.header_logo_url || "";
        if (req.file && req.file.filename) {
            headerLogoUrl = `${req.protocol}://${req.get("host")}/uploads/header-logos/${req.file.filename}`;
        }

        const headerTitle = String(req.body.headerTitle || "").trim()
            || existingSettings.headerTitle
            || existingSettings.header_title
            || defaultHeaderSettings.headerTitle;
        const headerSubtitle = String(req.body.headerSubtitle || "").trim()
            || existingSettings.headerSubtitle
            || existingSettings.header_subtitle
            || defaultHeaderSettings.headerSubtitle;

        const payload = {
            title: "Header Logo Settings JSON",
            slug: HEADER_LOGO_SETTINGS_SLUG,
            details: JSON.stringify({ headerLogoUrl, headerTitle, headerSubtitle }),
            status: 1,
        };

        if (existing) {
            await PageModel.update(payload, { where: { id: existing.id } });
        } else {
            await PageModel.create(payload);
        }

        req.flash('success', 'Header settings updated successfully!');
        return res.redirect('/header-branding-settings');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/header-branding-settings');
    }
};
