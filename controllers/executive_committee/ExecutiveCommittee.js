const { sequelize, ExecutiveCommitteeModel } = require("../../models");
const { QueryTypes } = require("sequelize");
const CommonFunction = require("../common_function");
const path = require("path");
const multer = require("multer");
const {
  getSettings: getExecutiveCommitteeSettings,
  saveSettings: saveExecutiveCommitteeSettings,
} = require("../../services/executiveCommitteeSettings");

const uploadDir = "public/executive_committee_images";

const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(
        null,
        "executive_committee_" + Date.now() + path.extname(file.originalname)
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("_file");

exports.list = (req, res, next) => {
  const settings = getExecutiveCommitteeSettings();
  res.render("executive_committee/index", {
    committee_title: settings.committee_title || "",
  });
};

exports.update_settings = (req, res, next) => {
  try {
    saveExecutiveCommitteeSettings({
      committee_title: req.body.committee_title,
    });
    req.flash("success", "Executive committee title updated successfully!");
    return res.redirect("/executive_committee");
  } catch (err) {
    req.flash("error", err?.message || "Failed to update committee title.");
    return res.redirect("/executive_committee");
  }
};

exports.data_list = async (req, res, next) => {
  const offset = Number(req.body.start || 0);
  const limit = Number(req.body.length || 10);
  const search = String(req.body["search[value]"] || "").trim();
  const whereClause = search
    ? ` WHERE name LIKE '%${search.replace(/'/g, "''")}%' OR designation LIKE '%${search.replace(
        /'/g,
        "''"
      )}%' OR email LIKE '%${search.replace(/'/g, "''")}%'`
    : "";

  const query_data = await sequelize.query(
    `SELECT * FROM executive_committee ${whereClause}
     ORDER BY display_order ASC, id DESC
     LIMIT ${offset}, ${limit};`,
    { type: QueryTypes.SELECT }
  );
  const query_data_count = await sequelize.query(
    `SELECT COUNT(*) AS num_of_row FROM executive_committee ${whereClause};`,
    { type: QueryTypes.SELECT }
  );

  query_data.forEach(function (e) {
    e.action = CommonFunction.action_menu_edit_del(e.id, "executive_committee");
  });

  return res.status(200).json({
    success: true,
    recordsTotal: query_data.length,
    recordsFiltered: query_data_count[0]?.num_of_row || 0,
    data: query_data,
  });
};

exports.grid_list = async (req, res, next) => {
  const rows = await sequelize.query(
    `SELECT id, name, designation, image, display_order, status
     FROM executive_committee
     ORDER BY display_order ASC, id DESC;`,
    { type: QueryTypes.SELECT }
  );

  return res.status(200).json({
    success: true,
    result: rows,
  });
};

exports.add_from = async (req, res, next) => {
  res.render("executive_committee/add", {
    name: "",
    designation: "",
    image: "",
    bio: "",
    email: "",
    phone: "",
    display_order: 0,
    status: "1",
  });
};

exports.add = async (req, res, next) => {
  const errorHandler = (err) => {
    req.flash("error", err?.original?.sqlMessage || err.message || String(err));
    return res.redirect("/executive_committee/add");
  };

  uploadMiddleware(req, res, async (err) => {
    if (err) {
      req.flash("error", err.message || "Image upload failed.");
      return res.redirect("/executive_committee/add");
    }

    const image = req.file ? req.file.filename : "";

    try {
      await ExecutiveCommitteeModel.create({
        name: req.body.name,
        designation: req.body.designation,
        image,
        bio: req.body.bio,
        email: req.body.email,
        phone: req.body.phone,
        display_order: Number(req.body.display_order || 0),
        status: Number(req.body.status || 0),
      });
      req.flash("success", "Data add successfully!");
      return res.redirect("/executive_committee/add");
    } catch (createErr) {
      return errorHandler(createErr);
    }
  });
};

exports.edit_from = async (req, res, next) => {
  const id = req.params.id;
  const result = await ExecutiveCommitteeModel.findOne({ where: { id } }).catch(
    (err) => {
      req.flash("error", err?.original?.sqlMessage || err.message || String(err));
      return null;
    }
  );

  if (!result) {
    req.flash("error", "Committee member not found.");
    return res.redirect("/executive_committee");
  }

  return res.render("executive_committee/edit", {
    id: result.id,
    name: result.name || "",
    designation: result.designation || "",
    image: result.image || "",
    bio: result.bio || "",
    email: result.email || "",
    phone: result.phone || "",
    display_order: result.display_order || 0,
    status: String(result.status ?? "1"),
  });
};

exports.edit = async (req, res, next) => {
  const id = req.params.id;

  const errorHandler = (err) => {
    req.flash("error", err?.original?.sqlMessage || err.message || String(err));
    return res.redirect("/executive_committee/edit/" + id);
  };

  uploadMiddleware(req, res, async (err) => {
    if (err) {
      req.flash("error", err.message || "Image upload failed.");
      return res.redirect("/executive_committee/edit/" + id);
    }

    try {
      const update_data = {
        name: req.body.name,
        designation: req.body.designation,
        bio: req.body.bio,
        email: req.body.email,
        phone: req.body.phone,
        display_order: Number(req.body.display_order || 0),
        status: Number(req.body.status || 0),
      };

      if (req.file) {
        update_data.image = req.file.filename;
      }

      await ExecutiveCommitteeModel.update(update_data, {
        where: { id: req.body.id },
      }).catch(errorHandler);

      req.flash("success", "Data update successfully!");
      return res.redirect("/executive_committee/edit/" + id);
    } catch (updateErr) {
      return errorHandler(updateErr);
    }
  });
};

exports.delete = async (req, res, next) => {
  const errorHandler = (err) => {
    return res
      .status(500)
      .json({ success: false, error: err?.original?.sqlMessage || err.message });
  };
  const results = await ExecutiveCommitteeModel.destroy({
    where: { id: req.body.del_id },
  }).catch(errorHandler);

  return res.status(200).json({
    success: true,
    result: results,
  });
};
