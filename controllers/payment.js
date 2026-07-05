const SSLCommerzPayment = require('sslcommerz-lts')
const { sequelize, DonationModel, MemberShipPaymentModel, EventRegisterModel, EventSponsorModel, MemberModel } = require("../models");
const { QueryTypes } = require("sequelize");
const { getPaymentConfig } = require("./payment_settings/PaymentSettings");
const { sendEventRegistrationInvoice } = require("../services/eventInvoiceMailer");
const { sendMembershipPaymentInvoice } = require("../services/membershipInvoiceMailer");

const PAYMENT_SOURCE_PREFIX = {
  membership: "MEM",
  donation: "DON",
  event: "EVT",
  event_sponsor: "ESP",
};

// function getCallbackBaseUrl(req) {
//   const forwardedProto = req.headers["x-forwarded-proto"];
//   const protocol = forwardedProto || req.protocol || "http";
//   return `${protocol}://${req.get("host")}`;
// }

function getCallbackBaseUrl(paymentConfig) {
  return normalizeBaseUrl(paymentConfig.site_url) || "https://faa-dubd.org";
}

function normalizeBaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
}

function buildFrontendRedirectUrl(baseUrl, path, tranId) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const normalizedTranId = String(tranId || "").trim();

  if (!normalizedBaseUrl) {
    return normalizedTranId ? `/${normalizedPath}/${normalizedTranId}` : `/${normalizedPath}`;
  }

  return normalizedTranId
    ? `${normalizedBaseUrl}/${normalizedPath}/${normalizedTranId}`
    : `${normalizedBaseUrl}/${normalizedPath}`;
}

function getRequestedPaymentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "cash") return "cash";
  return "ssl";
}

function normalizeCashReference(value) {
  return String(value || "").trim();
}

function formatTxTranDate(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace("T", " ");
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

function getCashResponse(message) {
  return {
    success: true,
    cash: true,
    message,
  };
}

function createGatewayTranId(source, id) {
  const prefix = PAYMENT_SOURCE_PREFIX[source];
  const normalizedId = Number(id);
  if (!prefix || !Number.isInteger(normalizedId) || normalizedId <= 0) {
    return String(id || "");
  }
  return `${prefix}-${normalizedId}`;
}

function parseGatewayTranId(tranId) {
  const rawValue = String(tranId || "").trim();
  const prefixedMatch = rawValue.match(/^([A-Z]{3})-(\d+)$/i);

  if (prefixedMatch) {
    const prefix = prefixedMatch[1].toUpperCase();
    const internalId = Number(prefixedMatch[2]);
    const source = Object.keys(PAYMENT_SOURCE_PREFIX).find(
      (key) => PAYMENT_SOURCE_PREFIX[key] === prefix
    );

    return {
      rawValue,
      source: source || null,
      internalId: Number.isInteger(internalId) && internalId > 0 ? internalId : null,
    };
  }

  const numericId = Number(rawValue);
  return {
    rawValue,
    source: null,
    internalId: Number.isInteger(numericId) && numericId > 0 ? numericId : null,
  };
}

async function findPaymentBySource(source, internalId) {
  if (!source || !internalId) return null;

  const modelMap = {
    membership: MemberShipPaymentModel,
    donation: DonationModel,
    event: EventRegisterModel,
    event_sponsor: EventSponsorModel,
  };

  const model = modelMap[source];
  if (!model) return null;

  const result = await model.findOne({
    where: { id: internalId },
  });

  if (!result) return null;

  return {
    source,
    result,
    internalId,
  };
}

async function findPaymentStatusByTranId(tranId, expectedSource = "") {
  const parsedTranId = parseGatewayTranId(tranId);
  if (!parsedTranId.internalId) {
    return null;
  }

  if (parsedTranId.source) {
    return findPaymentBySource(parsedTranId.source, parsedTranId.internalId);
  }

  if (expectedSource) {
    const expectedMatch = await findPaymentBySource(expectedSource, parsedTranId.internalId);
    if (expectedMatch) {
      return expectedMatch;
    }
  }

  const orderedSources = ["membership", "donation", "event", "event_sponsor"].filter(
    (source) => source !== expectedSource
  );

  for (const source of orderedSources) {
    const match = await findPaymentBySource(source, parsedTranId.internalId);
    if (match) {
      return match;
    }
  }

  return null;
}

function getUpdateTargetFromRequest(req) {
  const expectedSource = String(req.body?.value_a || "").trim().toLowerCase();
  const parsedTranId = parseGatewayTranId(req.body?.tran_id);

  return {
    expectedSource,
    internalId: parsedTranId.internalId,
    gatewayTranId: parsedTranId.rawValue,
  };
}

exports.sslPaymentMembership = async (req, res, next) => {
  try {
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

    const insertData = {
      member_id: req.body.member_id,
      name: req.body.name,
      organization_name: req.body.organization_name,
      email_address: req.body.email_address,
      phone_number: req.body.phone_number,
      pay_amount: req.body.pay_amount,
      payment_type: paymentType,
      tx_json_response: JSON.stringify({
        payment_for: "membership",
      }),
    }

    if (paymentType === "cash") {
      if (!cashReference) {
        return res.status(200).json({
          success: false,
          message: "Cash TXN/Reference Number is required for cash payment.",
        });
      }
      insertData.tx_status = "CASH_PENDING";
      insertData.tx_tran_id = cashReference;
      insertData.tx_tran_date = formatTxTranDate();
      insertData.tx_json_response = JSON.stringify({
        payment_for: "membership",
        payment_type: "cash",
        cash_txn_reference: cashReference,
        status: "CASH_PENDING",
      });
      const cashRequest = await MemberShipPaymentModel.create(insertData);
      if (cashRequest) {
        return res.status(200).json(
          getCashResponse("Cash payment request submitted successfully.")
        );
      }
    }

    const callbackBaseUrl = getCallbackBaseUrl(paymentConfig);
    const eventRegisterInsert = await MemberShipPaymentModel.create(insertData);
    if (eventRegisterInsert) {
      const data = {
        total_amount: req.body.pay_amount,
        currency: 'BDT',
        tran_id: createGatewayTranId("membership", eventRegisterInsert.id),
        success_url: `${callbackBaseUrl}/payment/success`,
        fail_url: `${callbackBaseUrl}/payment/fail`,
        cancel_url: `${callbackBaseUrl}/payment/cancel`,
        ipn_url: `${callbackBaseUrl}/payment/ipn_url`,
        shipping_method: 'Service',
        product_name: 'Membership Fee',
        product_category: 'Membership',
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
        value_a: "membership",
        value_b: req.body.member_id,
        value_c: "member_ship_payments",
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
    } else {
      return res.status(200).json({
        success: false,
        message: "Server Error !"
      });
    }
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: error.message || "Server Error !",
      error: error
    });
  }
};

exports.sslPayment = async (req, res, next) => {
  try {
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

    const insertData = {
      member_id: req.body.member_id,
      name: req.body.name,
      organization_name: req.body.organization_name,
      email_address: req.body.email_address,
      phone_number: req.body.phone_number,
      donation_type: String(req.body.donation_type || "normal").toLowerCase() === "program" ? "program" : "normal",
      program_id: req.body.program_id ? Number(req.body.program_id) : null,
      pay_amount: req.body.pay_amount,
      payment_type: paymentType,
      tx_json_response: JSON.stringify({
        payment_for: "donation",
      }),
    }

    if (paymentType === "cash") {
      if (!cashReference) {
        return res.status(200).json({
          success: false,
          message: "Cash TXN/Reference Number is required for cash payment.",
        });
      }
      insertData.tx_status = "CASH_PENDING";
      insertData.tx_tran_id = cashReference;
      insertData.tx_tran_date = formatTxTranDate();
      insertData.tx_json_response = JSON.stringify({
        payment_for: "donation",
        payment_type: "cash",
        cash_txn_reference: cashReference,
        status: "CASH_PENDING",
      });
      const cashRequest = await DonationModel.create(insertData);
      if (cashRequest) {
        return res.status(200).json(
          getCashResponse("Cash payment request submitted successfully.")
        );
      }
    }

    // const callbackBaseUrl = getCallbackBaseUrl(req);
    const callbackBaseUrl = getCallbackBaseUrl(paymentConfig);
    const eventRegisterInsert = await DonationModel.create(insertData);
    if (eventRegisterInsert) {
      const data = {
        total_amount: req.body.pay_amount,
        currency: 'BDT',
        tran_id: createGatewayTranId("donation", eventRegisterInsert.id),
        success_url: `${callbackBaseUrl}/payment/success`,
        fail_url: `${callbackBaseUrl}/payment/fail`,
        cancel_url: `${callbackBaseUrl}/payment/cancel`,
        ipn_url: `${callbackBaseUrl}/payment/ipn_url`,
        shipping_method: 'Service',
        product_name: 'Donation.',
        product_category: 'Donation',
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
        value_a: "donation",
        value_b: req.body.member_id || "",
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
    } else {
      return res.status(200).json({
        success: false,
        message: "Server Error !"
      });
    }
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: error.message || "Server Error !",
      error: error
    });
  }
};

exports.sslPaymentValidate = async (req, res, next) => {
  const paymentConfig = await getPaymentConfig();
  const redirectBaseUrl = normalizeBaseUrl(paymentConfig.site_url) || "/";

  try {
    if (req.body.status) {
      let updateData = {}
      const updateTarget = getUpdateTargetFromRequest(req);
      if (!updateTarget.internalId) {
        return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
      }
      if (req.body.status === "VALID") {
        updateData = {
          is_pay: 1,
          tx_status: req.body.status,
          tx_tran_date: req.body.tran_date,
          tx_tran_id: updateTarget.gatewayTranId,
          tx_val_id: req.body.val_id,
          tx_amount: req.body.amount,
          tx_store_amount: req.body.store_amount,
          tx_bank_tran_id: req.body.bank_tran_id,
          payment_type: req.body.card_issuer,
          card_brand: req.body.card_brand,
          card_no: req.body.card_no,
          tx_json_response: JSON.stringify(req.body)
        }
      } else {
        updateData = {
          tx_status: req.body.status,
          tx_tran_date: req.body.tran_date,
          tx_tran_id: updateTarget.gatewayTranId,
          tx_amount: req.body.amount,
          tx_store_amount: req.body.store_amount,
          tx_bank_tran_id: req.body.bank_tran_id,
          payment_type: req.body.card_issuer,
          card_brand: req.body.card_brand,
          card_no: req.body.card_no,
          tx_json_response: JSON.stringify(req.body)
        }
      }
      let update_date = null;
      if (req.body.value_a === "event") {
        update_date = await EventRegisterModel.update(updateData, { where: { id: updateTarget.internalId } });
        const eventDetails = await EventRegisterModel.findOne({ where: { id: updateTarget.internalId } });
        if (eventDetails && eventDetails.member_id) {
          if (Number(eventDetails.membership_renew_fees) !== 0) {
            if (req.body.status === "VALID") {
              await MemberModel.update(
                {
                  is_pay: 1,
                  amount: eventDetails.membership_renew_fees,
                  approved_at: new Date(),
                },
                { where: { id: eventDetails.member_id } }
              );
            }
          }
        }
        if (req.body.status === "VALID") {
          sendEventRegistrationInvoice(updateTarget.internalId).catch((emailError) => {
            console.log("Event invoice email send failed:", emailError.message);
          });
        }
      } else if (req.body.value_a === "membership") {
        update_date = await MemberShipPaymentModel.update(updateData, { where: { id: updateTarget.internalId } });
        if (req.body.status === "VALID") {
          await MemberModel.update(
            {
              is_pay: 1,
              admin_approval: 1,
              amount: req.body.amount,
              approved_at: new Date(),
            },
              { where: { id: req.body.value_b } }
            );
            sendMembershipPaymentInvoice(updateTarget.internalId).catch((emailError) => {
              console.log("Membership invoice email send failed:", emailError.message);
            });
        }
      } else if (req.body.value_a === "event_sponsor") {
        update_date = await EventSponsorModel.update(updateData, { where: { id: updateTarget.internalId } });
      } else if (req.body.value_a === "donation") {
        update_date = await DonationModel.update(updateData, { where: { id: updateTarget.internalId } });
      } else {
        const paymentSource = await findPaymentStatusByTranId(
          req.body.tran_id,
          updateTarget.expectedSource
        );

        if (paymentSource?.source === "membership") {
          update_date = await MemberShipPaymentModel.update(updateData, { where: { id: updateTarget.internalId } });
          if (req.body.status === "VALID") {
            await MemberModel.update(
              {
                is_pay: 1,
                admin_approval: 1,
                amount: req.body.amount,
                approved_at: new Date(),
              },
              { where: { id: req.body.value_b } }
            );
            sendMembershipPaymentInvoice(updateTarget.internalId).catch((emailError) => {
              console.log("Membership invoice email send failed:", emailError.message);
            });
          }
        } else if (paymentSource?.source === "event") {
          update_date = await EventRegisterModel.update(updateData, { where: { id: updateTarget.internalId } });
        } else if (paymentSource?.source === "event_sponsor") {
          update_date = await EventSponsorModel.update(updateData, { where: { id: updateTarget.internalId } });
        } else {
          update_date = await DonationModel.update(updateData, { where: { id: updateTarget.internalId } });
        }
      }

      if (update_date) {
        if (req.body.status === "VALID") {
          return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "success", req.body.tran_id));
        } else if (req.body.status === "FAILED") {
          return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
        } else if (req.body.status === "CANCELLED") {
          return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "cancel", req.body.tran_id));
        } else if (req.body.status === "UNATTEMPTED") {
          return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
        } else if (req.body.status === "EXPIRED") {
          return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
        }
      }
    } else {
      return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
    }
  } catch (error) {
    console.log(error)
    return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, "fail", req.body.tran_id));
  }
}

exports.redirectFrontendPaymentPage = async (req, res, next, pageName) => {
  try {
    const paymentConfig = await getPaymentConfig();
    const redirectBaseUrl = normalizeBaseUrl(paymentConfig.site_url) || "/";
    const tranId = req.query.tran_id || req.query.tr_id || req.query.id || "";
    return res.redirect(buildFrontendRedirectUrl(redirectBaseUrl, pageName, tranId));
  } catch (error) {
    console.log(error);
    return res.redirect("/");
  }
}

exports.sslPaymentStatus = async (req, res, next) => {
  if (req.query.tr_id) {
    const paymentDetails = await findPaymentStatusByTranId(
      req.query.tr_id,
      String(req.query.source || "").trim().toLowerCase()
    );
    if (paymentDetails?.result) {
      return res.status(200).json({
        success: true,
        source: paymentDetails.source,
        result: paymentDetails.result,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "Data not found",
      });
    }
  } else {
    return res.status(200).json({
      success: true,
      message: "tr_id is empty",
    });
  }
}
