const {sequelize} = require("../../models");
const {QueryTypes} = require("sequelize");
const CommonFunction = require("../common_function");


exports.batch_session_list = async (req, res, next) => {

  const query_data = await sequelize.query(`SELECT * FROM batch_session_list;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: query_data,
  });
};


exports.occupation_list_list = async (req, res, next) => {

  const query_data = await sequelize.query(`SELECT * FROM occupation_list;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: query_data,
  });
};
