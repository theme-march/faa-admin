const {sequelize} = require("../../models");
const {QueryTypes} = require("sequelize");


exports.List = async (req, res, next) => {
  const _data = await sequelize.query(
    `
      SELECT el.*
      FROM home_popup el
      WHERE el.status = 1
      ORDER BY
        COALESCE(el.updated_at, el.created_at) DESC,
        el.id DESC
    `,
    { type: QueryTypes.SELECT }
  );

  return res.status(200).json({
    success: true,
    result: _data,
  });

};

