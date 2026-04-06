const { sequelize, EventRegisterModel, EventSponsorModel, DonationModel, MemberModel } = require("../../models");
const { QueryTypes, Op } = require('sequelize');
const SSLCommerzPayment = require("sslcommerz-lts");
const { getPaymentConfig } = require("../payment_settings/PaymentSettings");

function getCallbackBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function getRequestedPaymentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "cash") return "cash";
  return "ssl";
}

function normalizeCashReference(value) {
  return String(value || "").trim();
}

function generateEntryPasscode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function parseValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTxTranDate(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function resolveCategoryMembershipMeta(categoryTitle, categoryName = "") {
  const fallbackDuration = 365;
  const fallback = {
    membership_type: String(categoryName || "").toLowerCase().includes("lifetime")
      ? "lifetime"
      : "time_limited",
    membership_duration_days: fallbackDuration,
  };

  if (!categoryTitle) return fallback;

  try {
    const parsed = typeof categoryTitle === "string" ? JSON.parse(categoryTitle) : categoryTitle;
    const membershipType =
      String(parsed?.membership_type || "").toLowerCase() === "lifetime"
        ? "lifetime"
        : fallback.membership_type;
    const parsedDays = Number(parsed?.membership_duration_days);
    const durationDays =
      Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : fallbackDuration;
    return {
      membership_type: membershipType,
      membership_duration_days: durationDays,
    };
  } catch (error) {
    return fallback;
  }
}

async function getMemberExpiryMeta(memberId) {
  if (!memberId) return null;
  const member = await MemberModel.findOne({
    where: { id: memberId },
    attributes: [
      "id",
      "admin_approval",
      "is_pay",
      "approved_at",
      "created_at",
      "membership_category_id",
    ],
  });

  if (!member) return null;

  const memberRow = member.get ? member.get({ plain: true }) : member;
  const isApproved = Number(memberRow.admin_approval) === 1;
  const isPaid = Number(memberRow.is_pay) === 1;
  const categoryRows = await sequelize.query(
    `
      SELECT category_name, category_title
      FROM category_list
      WHERE id = :category_id
      LIMIT 1
    `,
    {
      replacements: { category_id: memberRow.membership_category_id || null },
      type: QueryTypes.SELECT,
    }
  );
  const category = categoryRows?.[0] || {};
  const categoryMeta = resolveCategoryMembershipMeta(category.category_title, category.category_name);

  const paymentRows = await sequelize.query(
    `
      SELECT
        MAX(
          COALESCE(
            mp.tx_tran_date,
            mp.created_at,
            er.tx_tran_date,
            er.created_at
          )
        ) AS last_payment_raw
      FROM member_list ml
      LEFT JOIN member_ship_payments mp
        ON ml.id = mp.member_id
        AND mp.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN event_register er
        ON ml.id = er.member_id
        AND er.tx_status IN ('VALID', 'CASH_RECEIVED')
      WHERE ml.id = :member_id
      GROUP BY ml.id
    `,
    {
      replacements: { member_id: memberId },
      type: QueryTypes.SELECT,
    }
  );

  const lastPaymentRaw = paymentRows?.[0]?.last_payment_raw || null;
  const approvedDate =
    parseValidDate(memberRow.approved_at) ||
    (isApproved ? parseValidDate(lastPaymentRaw) || parseValidDate(memberRow.created_at) : null);

  if (
    isApproved &&
    !memberRow.approved_at &&
    approvedDate
  ) {
    await MemberModel.update(
      { approved_at: approvedDate },
      { where: { id: memberId } }
    ).catch(() => {});
  }

  if (categoryMeta.membership_type === "lifetime") {
    return {
      is_expired: false,
      is_approved: isApproved,
      is_paid: isPaid,
      approved_date: approvedDate,
      expire_date: null,
    };
  }

  if (!approvedDate) {
    return {
      is_expired: false,
      is_approved: isApproved,
      is_paid: isPaid,
      approved_date: null,
      expire_date: null,
    };
  }

  const durationMs = Number(categoryMeta.membership_duration_days || 365) * 24 * 60 * 60 * 1000;
  const expireDate = new Date(approvedDate.getTime() + durationMs);
  return {
    is_expired: expireDate.getTime() < Date.now(),
    is_approved: isApproved,
    is_paid: isPaid,
    approved_date: approvedDate,
    expire_date: expireDate,
  };
}

function getPaymentConfigError(paymentConfig, paymentType) {
  if (!paymentConfig.status) {
    return "Payment system is inactive. Please contact admin.";
  }

  if (paymentType === "cash") {
    if (!paymentConfig.cash_enabled) {
      return "Cash payment is currently unavailable.";
    }
    return null;
  }

  if (!paymentConfig.ssl_enabled) {
    return "SSL payment is currently unavailable.";
  }

  if (!paymentConfig.store_id || !paymentConfig.store_passwd || !paymentConfig.site_url) {
    return `SSL payment setup is incomplete. Missing: ${paymentConfig.missing_fields.join(", ")}.`;
  }

  return null;
}

exports.EventSponsorSave  = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err
    });
  };

  const paymentType = getRequestedPaymentType(req.body.payment_type);
  const cashReference = normalizeCashReference(req.body.cash_txn_reference);
  const paymentConfig = await getPaymentConfig();
  const paymentConfigError = getPaymentConfigError(paymentConfig, paymentType);
  if (paymentConfigError) {
    return res.status(200).json({
      success: false,
      message: paymentConfigError,
    });
  }

  const eventDetails = await EventSponsorModel.findOne({
    where: {
      event_id: req.body.event_id,
      email: req.body.email || req.body.email_address,
      [Op.or]: [
        { is_pay: 1 },
        { tx_status: "CASH_PENDING" },
        {
          tx_status: {
            [Op.notIn]: ["FAILED", "CANCELLED", "UNATTEMPTED", "EXPIRED"]
          }
        }
      ]
    }
  }).catch(errorHandler);

  if(eventDetails === null){
    try {
      const payload = {
        event_id: req.body.event_id,
        member_id: req.body.member_id || null,
        organization_name: req.body.organization_name,
        distributor_name: req.body.full_name || req.body.name || "",
        email: req.body.email || req.body.email_address,
        phone_number: req.body.phone_number,
        address: req.body.address || "",
        approximately_amount: req.body.pay_amount,
        payment_type: paymentType,
      };

      if (paymentType === "cash") {
        if (!cashReference) {
          return res.status(200).json({
            success: false,
            message: "Cash TXN/Reference Number is required for cash payment.",
          });
        }
        payload.tx_status = "CASH_PENDING";
        payload.tx_tran_id = cashReference;
        payload.tx_tran_date = formatTxTranDate();
        payload.tx_json_response = JSON.stringify({
          payment_type: "cash",
          cash_txn_reference: cashReference,
          status: "CASH_PENDING",
        });
      }

      const eventRegisterInsert = await EventSponsorModel.create(payload).catch(errorHandler);
      if (!eventRegisterInsert) {
        return res.status(200).json({
          success: false,
          message: "Server Error !"
        });
      }

      if (paymentType === "cash") {
        return res.status(200).json({
          success: true,
          cash: true,
          result: eventRegisterInsert,
          message: "Cash payment request submitted successfully.",
        });
      }

      const callbackBaseUrl = getCallbackBaseUrl(req);
      const data = {
        total_amount: req.body.pay_amount,
        currency: 'BDT',
        tran_id: eventRegisterInsert.id,
        success_url: `${callbackBaseUrl}/payment/success`,
        fail_url: `${callbackBaseUrl}/payment/fail`,
        cancel_url: `${callbackBaseUrl}/payment/cancel`,
        ipn_url: `${callbackBaseUrl}/payment/ipn_url`,
        shipping_method: 'Service',
        product_name: 'EventSponsorRegistration',
        product_category: 'EventSponsorRegistration',
        product_profile: 'general',
        cus_name: req.body.full_name || req.body.name,
        cus_email: req.body.email || req.body.email_address,
        cus_add1: '',
        cus_add2: '',
        cus_city: '',
        cus_state: '',
        cus_postcode: '',
        cus_country: 'Bangladesh',
        cus_phone: req.body.phone_number,
        cus_fax: '',
        ship_name: req.body.full_name || req.body.name,
        ship_add1: '',
        ship_add2: '',
        ship_city: '',
        ship_state: '',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        value_a: "event_sponsor",
        value_b: eventRegisterInsert.id,
      };

      const sslcz = new SSLCommerzPayment(
        paymentConfig.store_id,
        paymentConfig.store_passwd,
        paymentConfig.is_live
      );
      return sslcz.init(data).then((apiResponse) => {
        return res.status(200).json({
          success: true,
          url: apiResponse.GatewayPageURL,
          result: eventRegisterInsert,
        });
      });
    } catch (error) {
      return res.status(200).json({
        success: false,
        error: error
      });
    }
  }else{
    return res.status(200).json({
      success: false,
      message: "You already have a sponsor registration for this event."
    });
  }
};

// Default participation options used when DB columns are null/missing
const DEFAULT_MEMBER_PARTICIPATION = "Single|2000\nWith Spouse|4000";
const DEFAULT_GUEST_PARTICIPATION = "Student- BBA/MBA|500\nStudent- EMBA/MPF|2000";
const DEFAULT_TSHIRT_OPTIONS = 'S|T- Shirt: S - Length 26" chest 36".\nM|T- Shirt: M - Length 27" chest 38".\nL|T- Shirt: L - Length 28" chest: 40".\nXL|T- Shirt: XL - Length 29" chest 42"\n2XL|T- Shirt: 2XL - Length 30" chest 44"\n3XL|T- Shirt: 3XL - Length 31" chest 46"\n4XL|T- Shirt: 4XL - Length 32" chest 48"\n5XL|T- Shirt: 5XL - Length 33" chest 50"';

exports.Details = async (req, res, next) => {
  const _data = await sequelize.query(`SELECT el.* FROM event_list el WHERE status = 1 AND id=${req.params.id};`, { type: QueryTypes.SELECT });
  const _media_data = await sequelize.query(`SELECT * FROM event_image_list WHERE event_id = ${req.params.id};`, { type: QueryTypes.SELECT });

  // Ensure dynamic option fields always have a value (handles old DB rows without these columns)
  if (_data && _data[0]) {
    const ev = _data[0];
    if (!ev.member_participation_options) {
      ev.member_participation_options = DEFAULT_MEMBER_PARTICIPATION;
    }
    if (!ev.guest_participation_options) {
      ev.guest_participation_options = DEFAULT_GUEST_PARTICIPATION;
    }
    if (!ev.t_shirt_size_options) {
      ev.t_shirt_size_options = DEFAULT_TSHIRT_OPTIONS;
    }
    if (ev.t_shirt_gift_status === undefined || ev.t_shirt_gift_status === null) {
      ev.t_shirt_gift_status = 0;
    }
    if (!ev.registration_access_mode) {
      ev.registration_access_mode = "both";
    }
    if (!ev.membership_renew_status && ev.membership_renew_status !== 0) {
      ev.membership_renew_status = 1;
    }
  }

  return res.status(200).json({
    success: true,
    result: _data,
    media: _media_data,
  });
};

exports.Save  = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err
    });
  };

  const paymentType = getRequestedPaymentType(req.body.payment_type);
  const cashReference = normalizeCashReference(req.body.cash_txn_reference);
  const paymentConfig = await getPaymentConfig();
  const paymentConfigError = getPaymentConfigError(paymentConfig, paymentType);
  if (paymentConfigError) {
    return res.status(200).json({
      success: false,
      message: paymentConfigError,
    });
  }

  const eventId = Number(req.body.event_id);
  const eventRows = await sequelize.query(
    `SELECT id, status, registration_access_mode FROM event_list WHERE id = :event_id LIMIT 1;`,
    {
      replacements: { event_id: eventId || 0 },
      type: QueryTypes.SELECT,
    }
  );
  const eventRow = eventRows?.[0] || null;
  if (!eventRow || Number(eventRow.status) !== 1) {
    return res.status(200).json({
      success: false,
      message: "Event not found or unavailable.",
    });
  }

  const registrationAccessMode = String(eventRow.registration_access_mode || "both").trim().toLowerCase();
  const memberId = Number(req.body.member_id) || null;
  const isLoggedInPayload = !!memberId;

  if (registrationAccessMode === "login_only" && !isLoggedInPayload) {
    return res.status(200).json({
      success: false,
      message: "This event is only for logged-in members.",
    });
  }
  if (registrationAccessMode === "guest_only" && isLoggedInPayload) {
    return res.status(200).json({
      success: false,
      message: "This event is only for guest users.",
    });
  }

  if (registrationAccessMode === "login_only" && memberId) {
    const expiryMeta = await getMemberExpiryMeta(memberId);
    if (!expiryMeta?.is_approved) {
      return res.status(200).json({
        success: false,
        message: "Your membership is not approved yet. Please contact admin.",
      });
    }
    if (!expiryMeta?.is_paid) {
      return res.status(200).json({
        success: false,
        message: "Your membership payment is pending. Please complete membership payment first.",
      });
    }
    if (expiryMeta?.is_expired) {
      return res.status(200).json({
        success: false,
        message: "Your membership is expired. Please renew membership first.",
      });
    }
  }

let eventDetails = await EventRegisterModel.findOne({
    where: {
      event_id: req.body.event_id,
      email_address: req.body.email_address,
      [Op.or]: [
        { is_pay: 1 },
        { tx_status: "CASH_PENDING" },
        {
          tx_status: {
            [Op.notIn]: ["FAILED", "CANCELLED", "UNATTEMPTED", "EXPIRED"]
          }
        }
      ]
    }
  }).catch(errorHandler);

  if(eventDetails === null){
    try {
      const payload = {
        ...req.body,
        payment_type: paymentType,
        entry_passcode: generateEntryPasscode(),
      };

      if (paymentType === "cash") {
        if (!cashReference) {
          return res.status(200).json({
            success: false,
            message: "Cash TXN/Reference Number is required for cash payment.",
          });
        }
        payload.tx_status = "CASH_PENDING";
        payload.tx_tran_id = cashReference;
        payload.tx_tran_date = formatTxTranDate();
        payload.tx_json_response = JSON.stringify({
          payment_type: "cash",
          cash_txn_reference: cashReference,
          status: "CASH_PENDING",
        });
      }

      const eventRegisterInsert = await EventRegisterModel.create(payload).catch(errorHandler);
      if(eventRegisterInsert){
        if (paymentType === "cash") {
          return res.status(200).json({
            success: true,
            cash: true,
            message: "Cash payment request submitted successfully.",
          });
        }

        const callbackBaseUrl = getCallbackBaseUrl(req);
        const data = {
          total_amount: req.body.pay_amount,
          currency: 'BDT',
          tran_id: eventRegisterInsert.id,
          success_url: `${callbackBaseUrl}/payment/success`,
          fail_url: `${callbackBaseUrl}/payment/fail`,
          cancel_url: `${callbackBaseUrl}/payment/cancel`,
          ipn_url: `${callbackBaseUrl}/payment/ipn_url`,
          shipping_method: 'Service',
          product_name: 'EventRegistration',
          product_category: 'EventRegistration',
          product_profile: 'general',
          cus_name: req.body.name,
          cus_email: req.body.email_address,
          cus_add1: '',
          cus_add2: '',
          cus_city: '',
          cus_state: '',
          cus_postcode: '',
          cus_country: 'Bangladesh',
          cus_phone: req.body.phone_number,
          cus_fax: '',
          ship_name: req.body.name,
          ship_add1: '',
          ship_add2: '',
          ship_city: '',
          ship_state: '',
          ship_postcode: 1000,
          ship_country: 'Bangladesh',
          value_a: "event",
          value_b: req.body.member_id,
        };
        const sslcz = new SSLCommerzPayment(
          paymentConfig.store_id,
          paymentConfig.store_passwd,
          paymentConfig.is_live
        )
        sslcz.init(data).then(apiResponse => {
          let GatewayPageURL = apiResponse.GatewayPageURL
          return res.status(200).json({
            success: true,
            url: GatewayPageURL,
          });
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "Server Error !"
        });
      }
    } catch (error) {
      return res.status(200).json({
        success: false,
        error: error
      });
    }
  }else{
    return res.status(200).json({
      success: false,
      message: "You already have a registration for this event."
    });
  }
};

exports.List = async (req, res, next) => {
  const _data = await sequelize.query(`SELECT el.* FROM event_list el WHERE status = 1 ORDER BY el.id;`, { type: QueryTypes.SELECT });

  return res.status(200).json({
    success: true,
    result: _data,
  });
};
