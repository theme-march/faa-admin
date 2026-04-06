
exports.action_menu_edit_del_add_assign_committee = (id, url_name) => {
  let menu=
    "<div class='list-icons'> " +
    "<div class='dropdown'> " +
    "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
    "<i class='icon-menu9'></i> " +
    "</a> " +
    "<div class='dropdown-menu dropdown-menu-right'> " +
    "<a href='/"+url_name+"/edit/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a> " +
    "<a href='/"+url_name+"/assign_committee/?id="+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Assign</a> " +
    "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
    "</div> " +
    "</div> " +
    "</div>";
  return menu;
}


exports.action_menu_edit_del_sub = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/edit/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a> " +
        "<a href='/"+url_name+"/sub_menu?parent_id="+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Sub Menu</a> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
}

exports.action_menu_edit_del_add_image = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/edit/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a> " +
        "<a href='/"+url_name+"/media_list/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Add Image</a> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
}

exports.action_menu_edit_del = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/edit/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
}

exports.action_menu_edit_del_others = (id, url_name) => {
  let menu=
    "<div class='list-icons'> " +
    "<div class='dropdown'> " +
    "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
    "<i class='icon-menu9'></i> " +
    "</a> " +
    "<div class='dropdown-menu dropdown-menu-right'> " +
    "<a href='/"+url_name+"/edit/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Edit</a> " +
    "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
    "<a data-approve-id='"+id+"' href='javascript:void(0);' id='approve' class='dropdown-item'><i class='icon-user-check'></i> Approve</a> " +
    "<a data-approve-id='"+id+"' href='javascript:void(0);' id='not_approve' class='dropdown-item'><i class='icon-user-cancel '></i>Not Approve</a> " +
    "</div> " +
    "</div> " +
    "</div>";
  return menu;
}

exports.action_menu_del = (id, url_name) => {
  let menu=
    "<div class='list-icons'> " +
    "<div class='dropdown'> " +
    "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
    "<i class='icon-menu9'></i> " +
    "</a> " +
    "<div class='dropdown-menu dropdown-menu-right'> " +
    "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
    "</div> " +
    "</div> " +
    "</div>";
  return menu;
}

exports.action_menu = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
            "<div class='dropdown'> " +
                "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
                    "<i class='icon-menu9'></i> " +
                "</a> " +
                "<div class='dropdown-menu dropdown-menu-right'> " +
                    "<a href='/"+url_name+"/details/"+ id +"' class='dropdown-item'><i class='icon-newspaper2'></i> Details</a> " +
                "</div> " +
            "</div> " +
        "</div>";
    return menu;
};

exports.action_delete_menu = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
};

exports.action_sms_scheduler_menu = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/sms_scheduler_doctor_list/"+ id +"' class='dropdown-item'><i class='icon-list3 '></i> Doctor List</a> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
};


exports.action_email_scheduler_menu = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/email_scheduler_doctor_list/"+ id +"' class='dropdown-item'><i class='icon-list3 '></i> Doctor List</a> " +
        "<a data-delete-id='"+id+"' href='javascript:void(0);' id='delete' class='dropdown-item'><i class='icon-trash-alt'></i> Delete</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
};

exports.action_details = (id, url_name) => {
    let menu=
        "<div class='list-icons'> " +
        "<div class='dropdown'> " +
        "<a href='#' class='list-icons-item' data-toggle='dropdown'> " +
        "<i class='icon-menu9'></i> " +
        "</a> " +
        "<div class='dropdown-menu dropdown-menu-right'> " +
        "<a href='/"+url_name+"/details/"+ id +"' class='dropdown-item'><i class='icon-pencil5'></i> Details</a> " +
        "</div> " +
        "</div> " +
        "</div>";
    return menu;
}
