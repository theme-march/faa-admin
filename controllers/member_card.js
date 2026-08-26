const QRCode = require("qrcode");
const { QueryTypes } = require("sequelize");
const { sequelize, MemberModel, MemberCardTokenModel, EventStaffAssignmentModel } = require("../models");
const {
  ensureActiveTokensForMembers,
  findActiveToken,
  getMemberQrBaseUrl,
  getOrCreateActiveMemberToken,
  prepareReplacementToken,
  activateReplacementToken,
  cancelReplacementToken,
  restorePreviousToken,
  reissueMemberToken,
} = require("../services/memberCardQr");
const { performEventCheckin } = require("../services/eventCheckin");
const { registrationBelongsToMember } = require("../services/memberIdentity");

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
  const confirmation = String(req.body.confirmation || "").trim();
  if (!member.membership_number || confirmation !== String(member.membership_number).trim()) {
    req.flash("error", "Immediate replacement cancelled. Enter the exact membership number to confirm a lost/stolen card replacement.");
    return res.redirect(`/member/${member.id}/card-qr/history`);
  }
  try {
    await reissueMemberToken(member.id, adminId(req));
    req.flash("success", `A new QR was issued for ${member.membership_number}. Every previous physical-card QR is now invalid.`);
  } catch (error) {
    req.flash("error", error.message);
  }
  return res.redirect(`/member/${member.id}/card-qr/history`);
};

exports.qrHistory = async (req, res, next) => {
  try {
    const member = await MemberModel.findByPk(req.params.id, {
      attributes: ["id", "name", "membership_number", "member_image"],
      raw: true,
    });
    if (!member) {
      req.flash("error", "Member not found.");
      return res.redirect("/members");
    }

    const tokens = await MemberCardTokenModel.findAll({
      where: { member_id: member.id },
      order: [["id", "DESC"]],
      raw: true,
    });
    const audits = await sequelize.query(`
      SELECT a.*, au.name AS actor_name
      FROM member_card_token_audits a
      LEFT JOIN admin_user au ON au.id = a.actor_id
      WHERE a.member_id = :memberId
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 100
    `, { replacements: { memberId: member.id }, type: QueryTypes.SELECT });

    return res.render("member_card/history", { member, tokens, audits });
  } catch (error) { return next(error); }
};

exports.prepareReplacement = async (req, res) => {
  const member = await MemberModel.findByPk(req.params.id);
  if (!member) {
    req.flash("error", "Member not found.");
    return res.redirect("/members");
  }
  try {
    const result = await prepareReplacementToken(member.id, adminId(req));
    req.flash(
      result.created ? "success" : "error",
      result.created
        ? `Replacement QR prepared for ${member.membership_number}. The current physical-card QR is still active.`
        : "A pending replacement already exists. Activate or cancel it from QR History."
    );
  } catch (error) { req.flash("error", error.message); }
  return res.redirect(`/member/${member.id}/card-qr/history`);
};

exports.activateReplacement = async (req, res) => {
  try {
    await activateReplacementToken(Number(req.params.id), Number(req.params.tokenId), adminId(req));
    req.flash("success", "Replacement QR activated. The previous physical-card QR is now invalid.");
  } catch (error) { req.flash("error", error.message); }
  return res.redirect(`/member/${req.params.id}/card-qr/history`);
};

exports.cancelReplacement = async (req, res) => {
  try {
    await cancelReplacementToken(Number(req.params.id), Number(req.params.tokenId), adminId(req));
    req.flash("success", "Pending replacement cancelled. The current physical-card QR remains active.");
  } catch (error) { req.flash("error", error.message); }
  return res.redirect(`/member/${req.params.id}/card-qr/history`);
};

exports.restorePreviousQr = async (req, res) => {
  const member = await MemberModel.findByPk(req.params.id);
  if (!member) {
    req.flash("error", "Member not found.");
    return res.redirect("/members");
  }
  const confirmation = String(req.body.confirmation || "").trim();
  if (!member.membership_number || confirmation !== String(member.membership_number).trim()) {
    req.flash("error", "Restore cancelled. Enter the exact membership number to confirm.");
    return res.redirect(`/member/${member.id}/card-qr/history`);
  }
  try {
    await restorePreviousToken(member.id, Number(req.params.tokenId), adminId(req));
    req.flash("success", "Previous physical-card QR restored. The newer QR is now invalid.");
  } catch (error) { req.flash("error", error.message); }
  return res.redirect(`/member/${member.id}/card-qr/history`);
};

exports.downloadTokenQr = async (req, res) => {
  try {
    const member = await MemberModel.findByPk(req.params.id);
    const token = await MemberCardTokenModel.findOne({
      where: { id: req.params.tokenId, member_id: req.params.id },
    });
    if (!member || !token) return res.status(404).send("Member QR token not found.");
    const isPending = Number(token.is_active) === 0 && !token.revoked_at;
    if (Number(token.is_active) !== 1 && !isPending) {
      return res.status(409).send("Revoked or cancelled QR files cannot be downloaded.");
    }
    const url = `${getMemberQrBaseUrl(req)}${token.token_value}`;
    const png = await QRCode.toBuffer(url, { type: "png", width: 1000, margin: 4, errorCorrectionLevel: "H" });
    const state = isPending ? "PENDING_REPLACEMENT" : "ACTIVE";
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="FAA_${member.membership_number || member.id}_${state}_QR.png"`);
    return res.send(png);
  } catch (error) {
    return res.status(500).send("Unable to download this QR file.");
  }
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
  try {
    const token = await findActiveToken(req.body.token);
    if (!token) return res.status(404).json({ success: false, message: "Invalid or revoked member card QR." });

    const [member, registrationRows] = await Promise.all([
      MemberModel.findByPk(token.member_id, {
        attributes: ["id", "membership_number", "email", "phone_number"],
        raw: true,
      }),
      sequelize.query(`
        SELECT id, member_id, email_address, phone_number
        FROM event_register
        WHERE id = :registrationId
        LIMIT 1
      `, {
        replacements: { registrationId: req.body.registration_id },
        type: QueryTypes.SELECT,
      }),
    ]);

    const registration = registrationRows[0];
    if (!registrationBelongsToMember(registration, member)) {
      return res.status(403).json({ success: false, message: "This registration does not belong to the scanned member." });
    }

    const result = await performEventCheckin({
      registrationId: registration.id,
      qrType: "MEMBER_CARD_QR",
      req,
      requireAuthenticatedStaff: true,
    });
    return res.status(result.status || 200).json(result);
  } catch (error) {
    console.error("Member card check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to confirm event entry right now. Please try again.",
    });
  }
};
