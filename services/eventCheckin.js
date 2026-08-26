const { sequelize, EventCheckinModel, EventRegisterModel, EventStaffAssignmentModel, EventStaffModel } = require("../models");

function getRequestActor(req) {
  if (req.session?.eventStaff?.id) {
    return {
      type: "staff",
      id: Number(req.session.eventStaff.id),
      name: String(req.session.eventStaff.name || "Event Staff"),
    };
  }
  if (req.session?.user?.id) {
    return {
      type: "admin",
      id: Number(req.session.user.id),
      name: String(req.session.user.name || req.session.user.username || "Admin"),
    };
  }
  return { type: "member", id: null, name: "Member self-service" };
}

async function performEventCheckin({ registrationId, qrType, req, requireAuthenticatedStaff = true }) {
  const actor = getRequestActor(req);
  if (requireAuthenticatedStaff && actor.type === "member") {
    return { success: false, status: 401, message: "Staff login is required to take entry." };
  }

  return sequelize.transaction(async (transaction) => {
    const registration = await EventRegisterModel.findByPk(registrationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!registration) {
      return { success: false, status: 404, message: "Event registration was not found." };
    }
    if (Number(registration.is_pay) !== 1) {
      return { success: false, status: 400, message: "Payment is pending for this registration." };
    }

    if (actor.type === "staff") {
      const activeStaff = await EventStaffModel.findOne({
        where: { id: actor.id, status: 1 },
        transaction,
      });
      if (!activeStaff) {
        return { success: false, status: 401, message: "This staff account is disabled or no longer available." };
      }
      const assignment = await EventStaffAssignmentModel.findOne({
        where: { staff_id: actor.id, event_id: registration.event_id },
        transaction,
      });
      if (!assignment) {
        return { success: false, status: 403, message: "This event is not assigned to your staff account." };
      }
    }

    if (registration.enter_date_time) {
      const prior = await EventCheckinModel.findOne({
        where: { registration_id: registration.id, status: "active" },
        order: [["id", "DESC"]],
        transaction,
      });
      return {
        success: false,
        status: 409,
        alreadyEntered: true,
        message: "This participant has already entered the event.",
        checkedInAt: registration.enter_date_time,
        checkedInBy: prior?.actor_name || null,
      };
    }

    const checkedInAt = new Date();
    await registration.update({ enter_date_time: checkedInAt }, { transaction });
    const audit = await EventCheckinModel.create({
      registration_id: registration.id,
      member_id: registration.member_id || null,
      event_id: registration.event_id,
      staff_id: actor.type === "staff" ? actor.id : null,
      actor_type: actor.type,
      actor_name: actor.name,
      qr_type: qrType,
      checked_in_at: checkedInAt,
      status: "active",
      ip_address: String(req.ip || req.socket?.remoteAddress || "").slice(0, 64),
      user_agent: String(req.get?.("user-agent") || "").slice(0, 500),
    }, { transaction });

    return {
      success: true,
      status: 200,
      message: "Event entry recorded successfully.",
      checkedInAt,
      checkinId: audit.id,
      checkedInBy: actor.name,
    };
  });
}

module.exports = { getRequestActor, performEventCheckin };
