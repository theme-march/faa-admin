const QRCode = require("qrcode");
const { QueryTypes } = require("sequelize");
const { sequelize, MemberModel, MemberCardTokenModel, EventStaffAssignmentModel } = require("../models");
const { ensureActiveTokensForMembers, findActiveToken, getMemberQrBaseUrl, getOrCreateActiveMemberToken, reissueMemberToken } = require("../services/memberCardQr");
const { performEventCheckin } = require("../services/eventCheckin");

function adminId(req) { return Number(req.session?.user?.id || 0) || null; }

exports.downloadQr = async (req, res) => {
  const member = await MemberModel.findByPk(req.params.id);
  if (!member) return res.status(404).send("Member not found.");
  const token = await getOrCreateActiveMemberToken(member.id, adminId(req));
  const url = `${getMemberQrBaseUrl(req)}${token.token_value}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 1000, margin: 4, errorCorrectionLevel: "H" });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `attachment; filename="FAA_${member.membership_number || member.id}_QR.png"`);
  return res.send(png);
};

exports.reissueQr = async (req, res) => {
  const member = await MemberModel.findByPk(req.params.id);
  if (!member) {
    req.flash("error", "Member not found.");
    return res.redirect("/members");
  }
  await reissueMemberToken(member.id, adminId(req));
  req.flash("success", `A new card QR was issued for ${member.membership_number}. The old QR is now invalid.`);
  return res.redirect("/members");
};

exports.generateAll = async (req, res) => {
  const members = await MemberModel.findAll({
    where: { admin_approval: 1, status: 1 },
    attributes: ["id"],
    raw: true,
  });
  const existingCount = await MemberCardTokenModel.count({
    where: { member_id: members.map((member) => member.id), is_active: 1 },
    distinct: true,
    col: "member_id",
  });
  await ensureActiveTokensForMembers(members.map((member) => member.id), adminId(req));
  const created = Math.max(members.length - Number(existingCount || 0), 0);
  req.flash("success", `${created} new permanent member QR token(s) generated. Existing active QR tokens were kept unchanged.`);
  return res.redirect("/members");
};

exports.verify = async (req, res, next) => {
  try {
    const token = await findActiveToken(req.params.token);
    if (!token) {
      return res.status(404).render("member_card/verify", {
        layout: false, member: null, registrations: [], staff: req.session?.eventStaff || null,
        message: "This member card QR is invalid or has been revoked.", tokenValue: "",
      });
    }
    await token.update({ last_scanned_at: new Date() });
    const rows = await sequelize.query(`
      SELECT ml.id, ml.name, ml.membership_number, ml.member_image, ml.session, ml.organization_name,
             ml.email, ml.phone_number,
             ml.admin_approval, ml.is_pay, ml.status, cl.category_name
      FROM member_list ml
      LEFT JOIN category_list cl ON cl.id = ml.membership_category_id
      WHERE ml.id = :memberId LIMIT 1
    `, { replacements: { memberId: token.member_id }, type: QueryTypes.SELECT });
    const member = rows[0];
    if (!member) throw new Error("The member linked to this QR no longer exists.");

    const registrations = await sequelize.query(`
      SELECT er.id AS registration_id, er.event_id, er.full_name, er.is_pay, er.tx_status,
             er.enter_date_time, el.event_title, el.event_date, el.event_venue
      FROM event_register er
      INNER JOIN event_list el ON el.id = er.event_id
      WHERE (CAST(er.member_id AS CHAR) = CAST(:memberId AS CHAR)
             OR CAST(er.member_id AS CHAR) = :membershipNumber
             OR (:email <> '' AND LOWER(COALESCE(er.email_address, '')) = LOWER(:email))
             OR (:phoneNumber <> '' AND REPLACE(COALESCE(er.phone_number, ''), ' ', '') = REPLACE(:phoneNumber, ' ', '')))
        AND (er.is_pay = 1 OR UPPER(COALESCE(er.tx_status, '')) IN ('VALID','VALIDATED','SUCCESS','CASH_RECEIVED'))
      ORDER BY el.event_date DESC, er.id DESC
    `, {
      replacements: {
        memberId: member.id,
        membershipNumber: member.membership_number || "",
        email: member.email || "",
        phoneNumber: member.phone_number || "",
      },
      type: QueryTypes.SELECT,
    });

    let assigned = new Set();
    if (req.session?.eventStaff?.id) {
      const assignments = await EventStaffAssignmentModel.findAll({
        where: { staff_id: req.session.eventStaff.id }, attributes: ["event_id"], raw: true,
      });
      assigned = new Set(assignments.map((item) => String(item.event_id)));
    }
    registrations.forEach((row) => { row.can_check_in = assigned.has(String(row.event_id)); });

    return res.render("member_card/verify", {
      layout: false, member, registrations, staff: req.session?.eventStaff || null,
      message: "", tokenValue: req.params.token,
    });
  } catch (error) { return next(error); }
};

exports.checkin = async (req, res) => {
  const token = await findActiveToken(req.body.token);
  if (!token) return res.status(404).json({ success: false, message: "Invalid or revoked member card QR." });
  const registrationRows = await sequelize.query(`
    SELECT id FROM event_register
    WHERE id = :registrationId
      AND (CAST(member_id AS CHAR) = CAST(:memberId AS CHAR)
           OR CAST(member_id AS CHAR) = (SELECT membership_number FROM member_list WHERE id = :memberId LIMIT 1)
           OR (COALESCE((SELECT email FROM member_list WHERE id = :memberId LIMIT 1), '') <> ''
               AND LOWER(COALESCE(email_address, '')) = LOWER((SELECT email FROM member_list WHERE id = :memberId LIMIT 1)))
           OR (COALESCE((SELECT phone_number FROM member_list WHERE id = :memberId LIMIT 1), '') <> ''
               AND REPLACE(COALESCE(phone_number, ''), ' ', '') = REPLACE((SELECT phone_number FROM member_list WHERE id = :memberId LIMIT 1), ' ', '')))
    LIMIT 1
  `, {
    replacements: { registrationId: req.body.registration_id, memberId: token.member_id },
    type: QueryTypes.SELECT,
  });
  if (!registrationRows[0]) return res.status(403).json({ success: false, message: "This registration does not belong to the scanned member." });
  const result = await performEventCheckin({
    registrationId: registrationRows[0].id,
    qrType: "MEMBER_CARD_QR",
    req,
    requireAuthenticatedStaff: true,
  });
  return res.status(result.status || 200).json(result);
};
