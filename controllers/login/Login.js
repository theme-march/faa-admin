const { AdminLogin } = require("../../models");

exports.login_view = (req, res, next) => {
    res.render('login/index', {layout: false});
}

exports.login_from = async (req, res, next) => {
    let username = req.body.username;
    let password = req.body.password;

    const errorHandler = (error) => {
        req.flash('error', error);
        res.redirect('/login');
    };

    if(username === ""){
        req.flash('error', "Please enter user name");
        res.redirect('/login');
    }else if(password === ""){
        req.flash('error', "Please enter password");
        res.redirect('/login');
    }else{
        let result = await AdminLogin.findOne({ where: {username: username, password: password}}).catch(errorHandler);

        if(result === null){
            req.flash('error', "Please check your user name and password !");
            res.redirect('/login');
        }else{
            req.session.user = result;
            res.redirect('/dashboard');
        }
    }
}
