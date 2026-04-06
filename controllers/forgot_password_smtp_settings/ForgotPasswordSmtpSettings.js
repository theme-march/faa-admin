const {
  getSettings,
  saveSettings,
} = require("../../services/forgotPasswordSmtpSettings");

exports.edit_form = async (req, res) => {
  try {
    const settings = getSettings();
    return res.render("forgot_password_smtp_settings/index", settings);
  } catch (err) {
    req.flash("error", err.message || "Could not load forgot password SMTP settings.");
    return res.redirect("/dashboard");
  }
};

exports.edit = async (req, res) => {
  try {
    saveSettings(req.body || {});
    req.flash("success", "Forgot password SMTP settings updated successfully.");
    return res.redirect("/forgot-password-smtp-settings");
  } catch (err) {
    req.flash("error", err.message || "Could not update forgot password SMTP settings.");
    return res.redirect("/forgot-password-smtp-settings");
  }
};
