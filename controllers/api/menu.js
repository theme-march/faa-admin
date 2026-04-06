const { sequelize, MenuModel} = require("../../models");
const { QueryTypes } = require('sequelize');

exports.menu_list = async (req, res, next) => {
  const getList = await sequelize.query(`SELECT * FROM menu_list WHERE status = 1 ORDER BY order_by ASC;`, { type: QueryTypes.SELECT });
  const MenuArray = [];

  const parentMenuList = getList.filter(it => it.parent_id === 0);
  parentMenuList.forEach((item) => {
    const subMenuList = getList.filter(it => it.parent_id === item.id);
    const SubMenuArray = [];
    if(subMenuList.length !== 0){
      subMenuList.forEach((sub_item) => {
        const subMenuItem = {
          title: sub_item.menu_name,
          link: sub_item.menu_url,
          key: sub_item.menu_name.toLowerCase().replace(/ /g, ''),
        };
        SubMenuArray.push(subMenuItem)
      })
      const menuItem = {
        title: item.menu_name,
        link: item.menu_url,
        key: item.menu_name.toLowerCase().replace(/ /g, ''),
        childern: SubMenuArray
      };
      MenuArray.push(menuItem)
    }else{
      const menuItem = {
        title: item.menu_name,
        link: item.menu_url,
        key: item.menu_name.toLowerCase().replace(/ /g, ''),
      };
      MenuArray.push(menuItem)
    }
  })

  if(getList.length === 0){
    return res.status(200).json({
      success: false,
      message: "Data not found"
    });
  }else{
    return res.status(200).json({
      success: true,
      result: MenuArray,
    });
  }

};
