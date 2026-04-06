const {sequelize} = require("../../models");
const {QueryTypes} = require("sequelize");

exports.NewsDetails = async (req, res, next) => {
  const _id = req.params.id
  const _data = await sequelize.query(`SELECT el.* FROM publication el WHERE id = ${_id};`, { type: QueryTypes.SELECT });

  if(_data.length !== 0){
    return res.status(200).json({
      success: true,
      result: _data[0],
    });
  }else{
    return res.status(200).json({
      success: false,
      message: "Data not found"
    });
  }


};

exports.ScrollingNewsList = async (req, res, next) => {
  const type = req.query.type
  const _data = await sequelize.query(`SELECT * FROM scrolling_news WHERE status = 1 ORDER BY id DESC;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: _data,
  });

};

exports.List = async (req, res, next) => {
  const type = req.query.type
  const _data = await sequelize.query(`SELECT el.* FROM publication el WHERE status = 1 and type = '${type}' ORDER BY el.id;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: _data,
  });

};
