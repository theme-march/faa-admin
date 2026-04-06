const { sequelize, MenuModel} = require("../../models");
const { QueryTypes } = require('sequelize');

exports.pageDetails = async (req, res, next) => {
  const _data_1 = await sequelize.query(`SELECT * FROM page WHERE status = 1 AND slug = '${req.body.page_url}' AND LOWER(title) <> 'executive committee' ORDER BY id ASC;`, { type: QueryTypes.SELECT });
  return res.status(200).json({
    success: true,
    result: _data_1,
  });

};
