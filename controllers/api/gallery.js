const {sequelize} = require("../../models");
const {QueryTypes} = require("sequelize");


exports.List = async (req, res, next) => {
  const type = req.query.type
  const _data = await sequelize.query(`SELECT el.* FROM gallery el WHERE status = 1 ORDER BY el.id;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: _data,
  });

};
