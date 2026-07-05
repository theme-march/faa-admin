const { DataTypes } = require('sequelize');
const Sequelize = require("sequelize");

module.exports = sequelize => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      allowNull: false,
      defaultValue: null,
      primaryKey: true,
      autoIncrement: true,
      field: "id"
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "status"
    },
    auto_send_status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "auto_send_status"
    },
    smtp_host: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "smtp_host"
    },
    smtp_port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 465,
      field: "smtp_port"
    },
    smtp_secure: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "smtp_secure"
    },
    smtp_user: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "smtp_user"
    },
    smtp_pass: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "smtp_pass"
    },
    from_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Event Team",
      field: "from_name"
    },
    from_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "from_email"
    },
    reply_to_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      field: "reply_to_email"
    },
    email_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "email_subject"
    },
    email_body: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "email_body"
    },
    invoice_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Entry Pass | Welcome",
      field: "invoice_title"
    },
    contact_details: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "",
      field: "contact_details"
    },
    qr_base_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "https://faa-dubd.org/event/enter?id=",
      field: "qr_base_url"
    },
    logo_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "public/assets/global_assets/images/logo.png",
      field: "logo_path"
    },
    site_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "https://faa-dubd.org",
      field: "site_url"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      field: "created_at"
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('NULL'),
      field: "updated_at"
    },
  };

  const options = {
    tableName: "event_invoice_settings",
    indexes: [],
    createdAt: false,
    updatedAt: false
  };

  return sequelize.define("EventInvoiceSettingModel", attributes, options);
};
