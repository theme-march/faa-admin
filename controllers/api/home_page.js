const { sequelize, MenuModel} = require("../../models");
const { QueryTypes } = require('sequelize');

exports.home_page = async (req, res, next) => {
  const _data_1 = await sequelize.query(`SELECT * FROM home_page WHERE status = 1 ORDER BY order_by ASC;`, { type: QueryTypes.SELECT });
  let section_1 = [];
  for (let i=0;i<_data_1.length;i++){
    const _media_data_1 = await sequelize.query(`SELECT * FROM media WHERE type='HomePage' AND parent_id = ${_data_1[i].id} AND status = 1 ORDER BY order_by ASC;`, { type: QueryTypes.SELECT });
    section_1.push({
      details: _data_1[i],
      media_data: _media_data_1,
    })
  }
  const _data_2 = await sequelize.query(`SELECT * FROM donation_career WHERE status = 1 AND is_show_in_home_page = 1 ORDER BY order_by ASC;`, { type: QueryTypes.SELECT });
  const _data_3 = await sequelize.query(`SELECT el.* FROM event_list el WHERE status = 1 and event_session != "Upcoming Event" ORDER BY el.id DESC LIMIT 3;`, { type: QueryTypes.SELECT });
  const _data_4 = await sequelize.query(`SELECT * FROM event_sponsors WHERE status = 1 ORDER BY order_by ASC;`, { type: QueryTypes.SELECT });
  const _data_5 = await sequelize.query(`SELECT el.* FROM event_list el WHERE status = 1 and event_session = "Upcoming Event" ORDER BY el.id DESC LIMIT 1;`, { type: QueryTypes.SELECT });
  const _data_6 = await sequelize.query(`SELECT * FROM publication WHERE status = 1 ORDER BY id DESC LIMIT 3;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    section_1: section_1,
    section_2: _data_2,
    section_3: _data_3,
    section_4: _data_4,
    section_5: _data_5,
    section_6: _data_6,
  });

};
