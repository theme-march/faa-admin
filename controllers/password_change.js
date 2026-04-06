const validations = require("./validations");
const {check, validationResult} = require("express-validator");
const { AdminLogin } = require("../models");
const fields = [
    {param: 'current_password'},
    {param: 'new_password'},
    {param: 'confirm_password'},
];

exports.edit_from = async (req, res, next) => {
    res.render('change_password', {
        validation: validations.all_field_validations(null, fields)
    });
};

exports.edit = [
    async (req, res, next) => {

        const errors = validationResult(req);
        const errorHandler = (err) => {
            req.flash('error', err.original.sqlMessage);
            res.redirect('/change_password');
        };

        let v = false;
        if(req.body.current_password === ""){
            req.flash('error', 'Current password empty ');
            res.redirect('/change_password');
        }else if(req.body.new_password === ""){
            req.flash('error', 'New password empty ');
            res.redirect('/change_password');
        }else if(req.body.confirm_password === ""){
            req.flash('error', 'Confirm password empty ');
            res.redirect('/change_password');
        }else if(req.body.current_password !== "" && req.body.new_password !== "" && req.body.confirm_password !== ""){
            v=true
        }

        if(v){
            if(req.session.user.password === req.body.current_password){
                if(req.body.new_password === req.body.confirm_password){
                    let update_data = {
                        password: req.body.new_password,
                    };
                    const update_date = await AdminLogin.update(update_data,{ where: { id: req.session.user.id } }).catch(errorHandler);
                    req.flash('success', 'Password update successfully!');
                    res.redirect('/change_password');
                }else{
                    req.flash('error', 'Confirm password not match ');
                    res.redirect('/change_password');
                }
            }else{
                req.flash('error', 'Current password not correct ');
                res.redirect('/change_password');
            }
        }
    }];
