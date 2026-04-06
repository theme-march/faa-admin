const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

exports.List = async (req, res, next) => {
  const data = await sequelize.query(
    "SELECT yv.* FROM youtube_video yv WHERE yv.status = 1 ORDER BY yv.id DESC LIMIT 1;",
    { type: QueryTypes.SELECT }
  );

  return res.status(200).json({
    success: true,
    result: data[0] || null,
  });
};
