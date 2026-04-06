
exports.all_field_validations = (errors, fields) => {
    let err_list= [];
    if(errors === null){
        fields.forEach(element => {
            let el = {msg: '', param: element.param};
            err_list.push(el)
        });
    }else{
        fields.forEach(element => {
            // console.log(errors.find(e => e.param === element.param));
            if(errors.find(e => e.param === element.param) === undefined){
                let el = {msg: '', param: element.param};
                err_list.push(el)
            }else{
                let msg = errors.find(e => e.param === element.param).msg;
                let el = {msg: msg, param: element.param};
                err_list.push(el)
            }
        });
    }
    return err_list;
}
