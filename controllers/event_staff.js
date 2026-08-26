const bcrypt = require("bcryptjs");
const { QueryTypes } = require("sequelize");
const {
  sequelize,
  EventModel,
  EventStaffModel,
  EventStaffAssignmentModel,
} = require("../models");

function adminId(req) {
  return Number(req.session?.user?.id || 0) || null;
}

async function eventOptions() {
  return EventModel.findAll({
    attributes: ["id", "event_title", "event_date"],
    where: { status: 1 },
    order: [["event_date", "DESC"]],
    raw: true,
  });
}

exports.adminList = async (req, res, next) => {
  try {
    const staff = await sequelize.query(`
      SELECT es.id, es.name, es.email, es.role, es.status, es.last_login_at, es.created_at,
             GROUP_CONCAT(el.event_title ORDER BY el.event_date DESC SEPARATOR ', ') AS assigned_events
      FROM event_staff es
      LEFT JOIN event_staff_assignments esa ON esa.staff_id = es.id
      LEFT JOIN event_list el ON el.id = esa.event_id
      GROUP BY es.id
      ORDER BY es.id DESC
    `, { type: QueryTypes.SELECT });
    return res.render("event_staff/index", { staff });
  } catch (error) { return next(error); }
};

exports.adminAddForm = async (req, res, next) => {
  try {
    return res.render("event_staff/form", { staff: null, assignedEventIds: [], events: await eventOptions() });
  } catch (error) { return next(error); }
};

exports.adminEditForm = async (req, res, next) => {
  try {
    const staff = await EventStaffModel.findByPk(req.params.id, { raw: true });
    if (!staff) {
      req.flash("error", "Staff account not found.");
      return res.redirect("/event-staff");
    }
    const assignments = await EventStaffAssignmentModel.findAll({ where: { staff_id: staff.id }, raw: true });
    return res.render("event_staff/form", {
      staff,
      assignedEventIds: assignments.map((item) => String(item.event_id)),
      events: await eventOptions(),
    });
  } catch (error) { return next(error); }
};

async function saveAssignments(staffId, eventIds, req, transaction) {
  const ids = [...new Set((Array.isArray(eventIds) ? eventIds : [eventIds]).filter(Boolean).map(Number).filter(Boolean))];
  await EventStaffAssignmentModel.destroy({ where: { staff_id: staffId }, transaction });
  if (ids.length) {
    await EventStaffAssignmentModel.bulkCreate(ids.map((eventId) => ({
      staff_id: staffId,
      event_id: eventId,
      assigned_by: adminId(req),
    })), { transaction });
  }
}

exports.adminCreate = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !email || password.length < 8) {
    req.flash("error", "Name, email and a password of at least 8 characters are required.");
    return res.redirect("/event-staff/add");
  }
  try {
    await sequelize.transaction(async (transaction) => {
      const staff = await EventStaffModel.create({
        name,
        email,
        password_hash: await bcrypt.hash(password, 12),
        role: req.body.role === "event_manager" ? "event_manager" : "entry_staff",
        status: 1,
        created_by: adminId(req),
      }, { transaction });
      await saveAssignments(staff.id, req.body.event_ids, req, transaction);
    });
    req.flash("success", "Staff account created successfully.");
    return res.redirect("/event-staff");
  } catch (error) {
    req.flash("error", error?.name === "SequelizeUniqueConstraintError" ? "This email is already in use." : error.message);
    return res.redirect("/event-staff/add");
  }
};

exports.adminUpdate = async (req, res) => {
  try {
    const staff = await EventStaffModel.findByPk(req.params.id);
    if (!staff) throw new Error("Staff account not found.");
    const updates = {
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      role: req.body.role === "event_manager" ? "event_manager" : "entry_staff",
      updated_at: new Date(),
    };
    const password = String(req.body.password || "");
    if (password) {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      updates.password_hash = await bcrypt.hash(password, 12);
    }
    await sequelize.transaction(async (transaction) => {
      await staff.update(updates, { transaction });
      await saveAssignments(staff.id, req.body.event_ids, req, transaction);
    });
    req.flash("success", "Staff account updated successfully.");
  } catch (error) { req.flash("error", error.message); }
  return res.redirect("/event-staff");
};

exports.adminToggle = async (req, res) => {
  const staff = await EventStaffModel.findByPk(req.params.id);
  if (!staff) {
    req.flash("error", "Staff account not found.");
  } else {
    await staff.update({ status: Number(staff.status) === 1 ? 0 : 1, updated_at: new Date() });
    req.flash("success", `Staff account ${Number(staff.status) === 1 ? "activated" : "disabled"}.`);
  }
  return res.redirect("/event-staff");
};

exports.adminCheckins = async (req, res, next) => {
  try {
    const checkins = await sequelize.query(`
      SELECT ec.*, er.full_name, ml.membership_number, el.event_title
      FROM event_checkins ec
      LEFT JOIN event_register er ON er.id = ec.registration_id
      LEFT JOIN member_list ml ON CAST(ml.id AS CHAR) = CAST(ec.member_id AS CHAR)
        OR CAST(ml.membership_number AS CHAR) = CAST(ec.member_id AS CHAR)
      LEFT JOIN event_list el ON el.id = ec.event_id
      ORDER BY ec.checked_in_at DESC
      LIMIT 1000
    `, { type: QueryTypes.SELECT });
    return res.render("event_staff/checkins", { checkins });
  } catch (error) { return next(error); }
};

exports.loginForm = (req, res) => res.render("event_staff/login", {
  layout: false,
  returnTo: String(req.query.returnTo || "/staff"),
});

exports.login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const returnToRaw = String(req.body.returnTo || "/staff");
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/staff";
  const staff = await EventStaffModel.findOne({ where: { email, status: 1 } });
  if (!staff || !(await bcrypt.compare(String(req.body.password || ""), staff.password_hash))) {
    req.flash("error", "Invalid email or password, or the staff account is disabled.");
    return res.redirect(`/staff/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  req.session.eventStaff = { id: staff.id, name: staff.name, email: staff.email, role: staff.role };
  await staff.update({ last_login_at: new Date() });
  return res.redirect(returnTo);
};

exports.logout = (req, res) => {
  delete req.session.eventStaff;
  return res.redirect("/staff/login");
};

exports.portal = async (req, res, next) => {
  try {
    const events = await sequelize.query(`
      SELECT el.id, el.event_title, el.event_date, el.event_venue
      FROM event_staff_assignments esa
      INNER JOIN event_list el ON el.id = esa.event_id
      WHERE esa.staff_id = :staffId AND el.status = 1
      ORDER BY el.event_date DESC
    `, { replacements: { staffId: req.session.eventStaff.id }, type: QueryTypes.SELECT });
    const recent = await sequelize.query(`
      SELECT ec.id, ec.checked_in_at, ec.qr_type, er.full_name, el.event_title
      FROM event_checkins ec
      LEFT JOIN event_register er ON er.id = ec.registration_id
      LEFT JOIN event_list el ON el.id = ec.event_id
      WHERE ec.staff_id = :staffId AND ec.status = 'active'
      ORDER BY ec.checked_in_at DESC LIMIT 20
    `, { replacements: { staffId: req.session.eventStaff.id }, type: QueryTypes.SELECT });
    return res.render("event_staff/portal", { layout: false, staff: req.session.eventStaff, events, recent });
  } catch (error) { return next(error); }
};

exports.reverseCheckin = async (req, res) => {
  if (req.session.eventStaff.role !== "event_manager") {
    req.flash("error", "Only an Event Manager can reverse a check-in.");
    return res.redirect("/staff");
  }
  const reason = String(req.body.reason || "Corrected by Event Manager").trim().slice(0, 500);
  try {
    await sequelize.transaction(async (transaction) => {
      const rows = await sequelize.query(`
        SELECT ec.id, ec.registration_id, ec.event_id
        FROM event_checkins ec
        INNER JOIN event_staff_assignments esa
          ON esa.event_id = ec.event_id AND esa.staff_id = :staffId
        WHERE ec.id = :id AND ec.status = 'active' LIMIT 1
      `, {
        replacements: { id: req.params.id, staffId: req.session.eventStaff.id },
        type: QueryTypes.SELECT, transaction,
      });
      const checkin = rows[0];
      if (!checkin) throw new Error("Active assigned-event check-in not found.");
      await sequelize.query(`
        UPDATE event_checkins SET status = 'reversed', reversed_by = :staffId,
          reversed_at = NOW(), reverse_reason = :reason WHERE id = :id AND status = 'active'
      `, {
        replacements: { id: checkin.id, staffId: req.session.eventStaff.id, reason },
        type: QueryTypes.UPDATE, transaction,
      });
      await sequelize.query(`UPDATE event_register SET enter_date_time = NULL WHERE id = :registrationId`, {
        replacements: { registrationId: checkin.registration_id }, type: QueryTypes.UPDATE, transaction,
      });
    });
    req.flash("success", "Check-in reversed successfully.");
  } catch (error) { req.flash("error", error.message); }
  return res.redirect("/staff");
};
