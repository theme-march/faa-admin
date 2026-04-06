const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");
const { getSettings: getExecutiveCommitteeSettings } = require("../../services/executiveCommitteeSettings");

exports.List = async (req, res, next) => {
  const settings = getExecutiveCommitteeSettings();
  const rows = await sequelize.query(
    `SELECT
      id,
      name,
      designation,
      image,
      bio,
      email,
      phone,
      display_order
    FROM executive_committee
    WHERE status = 1
    ORDER BY display_order ASC, id ASC;`,
    { type: QueryTypes.SELECT }
  );

  return res.status(200).json({
    success: true,
    committee_title: settings.committee_title || "FAA Executive Committee 2025-27",
    result: rows,
  });
};

exports.Details = async (req, res, next) => {
  const details = await sequelize.query(
    `SELECT
      id,
      name,
      designation,
      image,
      bio,
      email,
      phone,
      display_order
    FROM executive_committee
    WHERE status = 1
      AND id = :id
    LIMIT 1;`,
    {
      replacements: { id: req.params.id },
      type: QueryTypes.SELECT,
    }
  );

  return res.status(200).json({
    success: true,
    result: details?.[0] || null,
  });
};
