const { sequelize, YoutubeVideoModel } = require("../../models");
const { QueryTypes } = require("sequelize");
const CommonFunction = require("../common_function");

exports.list = (req, res, next) => {
  res.render("youtube_video/index", {});
};

exports.data_list = async (req, res, next) => {
  const offset = Number(req.body.start || 0);
  const limit = Number(req.body.length || 10);
  const search = (req.body["search[value]"] || "").trim();
  let whereClause = "";

  if (search) {
    const escapedSearch = search.replace(/'/g, "''");
    whereClause = ` WHERE title LIKE '%${escapedSearch}%' OR youtube_url LIKE '%${escapedSearch}%'`;
  }

  const query_data = await sequelize.query(
    `SELECT * FROM youtube_video${whereClause} ORDER BY id DESC LIMIT ${offset}, ${limit};`,
    { type: QueryTypes.SELECT }
  );
  const query_data_count = await sequelize.query(
    `SELECT COUNT(*) AS num_of_row FROM youtube_video${whereClause};`,
    { type: QueryTypes.SELECT }
  );

  query_data.forEach(function (e) {
    e.action = CommonFunction.action_menu_edit_del(e.id, "youtube_video");
  });

  return res.status(200).json({
    success: true,
    recordsTotal: query_data.length,
    recordsFiltered: query_data_count[0]?.num_of_row || 0,
    data: query_data,
  });
};

exports.add_from = async (req, res, next) => {
  res.render("youtube_video/add", {
    title: "",
    youtube_url: "",
    status: "1",
  });
};

exports.add = async (req, res, next) => {
  try {
    await YoutubeVideoModel.create({
      title: req.body.title,
      youtube_url: req.body.youtube_url,
      status: req.body.status,
    });

    req.flash("success", "YouTube video added successfully!");
    return res.redirect("/youtube_video/add");
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    return res.redirect("/youtube_video/add");
  }
};

exports.edit_from = async (req, res, next) => {
  const id = req.params.id;

  try {
    const result = await YoutubeVideoModel.findOne({ where: { id } });

    res.render("youtube_video/edit", {
      title: result?.title || "",
      youtube_url: result?.youtube_url || "",
      status: result?.status ?? 1,
      id: result?.id,
    });
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    res.redirect("/youtube_video");
  }
};

exports.edit = async (req, res, next) => {
  const id = req.params.id;

  try {
    await YoutubeVideoModel.update(
      {
        title: req.body.title,
        youtube_url: req.body.youtube_url,
        status: req.body.status,
      },
      { where: { id: req.body.id } }
    );

    req.flash("success", "YouTube video updated successfully!");
    return res.redirect(`/youtube_video/edit/${id}`);
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    return res.redirect(`/youtube_video/edit/${id}`);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await YoutubeVideoModel.destroy({
      where: { id: req.body.del_id },
    });

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.original?.sqlMessage || err.message,
    });
  }
};
