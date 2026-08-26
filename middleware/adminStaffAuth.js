function requireAdmin(req, res, next) {
  if (req.session?.user && req.cookies?.MessengerPharmaAdminUser) return next();
  req.flash("error", "Admin login is required.");
  return res.redirect("/login");
}

const { EventStaffModel } = require("../models");

async function requireStaff(req, res, next) {
  if (req.session?.eventStaff?.id) {
    const staff = await EventStaffModel.findOne({
      where: { id: req.session.eventStaff.id, status: 1 },
      attributes: ["id", "name", "email", "role"],
      raw: true,
    });
    if (staff) {
      req.session.eventStaff = staff;
      return next();
    }
    delete req.session.eventStaff;
  }
  const returnTo = encodeURIComponent(req.originalUrl || "/staff");
  if (req.is("application/json") || req.get("accept")?.includes("application/json")) {
    return res.status(401).json({ success: false, message: "Staff login is required." });
  }
  return res.redirect(`/staff/login?returnTo=${returnTo}`);
}

module.exports = { requireAdmin, requireStaff };
