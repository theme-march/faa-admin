const { PaymentSettingModel } = require("../../models");

const DEFAULT_SETTINGS = {
  store_id: "",
  store_passwd: "",
  is_live: 0,
  ssl_enabled: 1,
  cash_enabled: 0,
  cash_payment_notice: "",
  site_url: "",
  status: 0,
};

async function getOrCreateSettings() {
  let settings = await PaymentSettingModel.findOne({ order: [["id", "ASC"]] });

  if (!settings) {
    settings = await PaymentSettingModel.create(DEFAULT_SETTINGS);
  }

  return settings;
}

function buildPaymentConfig(settings) {
  const config = {
    store_id: String(settings?.store_id || "").trim(),
    store_passwd: String(settings?.store_passwd || "").trim(),
    is_live: String(settings?.is_live) === "1",
    ssl_enabled: String(settings?.ssl_enabled ?? "1") === "1",
    cash_enabled: String(settings?.cash_enabled ?? "0") === "1",
    cash_payment_notice: String(settings?.cash_payment_notice || "").trim(),
    site_url: String(settings?.site_url || "").trim(),
    status: String(settings?.status) === "1",
  };

  const missingFields = [];
  if (config.ssl_enabled) {
    if (!config.store_id) missingFields.push("Store ID");
    if (!config.store_passwd) missingFields.push("Store Password");
  }
  if (!config.site_url) missingFields.push("Site URL");

  return {
    ...config,
    is_configured: config.status && (config.cash_enabled || config.ssl_enabled) && missingFields.length === 0,
    missing_fields: missingFields,
  };
}

exports.getOrCreateSettings = getOrCreateSettings;
exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
exports.getPaymentConfig = async () => {
  const settings = await getOrCreateSettings();
  return buildPaymentConfig(settings);
};

exports.public_info = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const config = buildPaymentConfig(settings);

    return res.status(200).json({
      success: true,
      result: {
        ssl_enabled: config.status && config.ssl_enabled,
        cash_enabled: config.status && config.cash_enabled,
        cash_payment_notice: config.cash_payment_notice,
      },
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      message: err.original?.sqlMessage || err.message,
      result: {
        ssl_enabled: false,
        cash_enabled: false,
        cash_payment_notice: "",
      },
    });
  }
};

exports.edit_from = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();

    res.render("payment_settings/index", {
      id: settings.id,
      store_id: settings.store_id,
      store_passwd: settings.store_passwd,
      is_live: settings.is_live,
      ssl_enabled: settings.ssl_enabled,
      cash_enabled: settings.cash_enabled,
      cash_payment_notice: settings.cash_payment_notice,
      site_url: settings.site_url,
      status: settings.status,
    });
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    res.redirect("/dashboard");
  }
};

exports.edit = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();

    await PaymentSettingModel.update(
      {
        store_id: req.body.store_id,
        store_passwd: req.body.store_passwd,
        is_live: req.body.is_live,
        ssl_enabled: req.body.ssl_enabled,
        cash_enabled: req.body.cash_enabled,
        cash_payment_notice: req.body.cash_payment_notice,
        site_url: req.body.site_url,
        status: req.body.status,
      },
      { where: { id: settings.id } }
    );

    req.flash("success", "Payment settings updated successfully!");
    return res.redirect("/payment-settings");
  } catch (err) {
    req.flash("error", err.original?.sqlMessage || err.message);
    return res.redirect("/payment-settings");
  }
};
