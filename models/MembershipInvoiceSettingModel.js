const { DataTypes } = require("sequelize");
const Sequelize = require("sequelize");

module.exports = (sequelize) => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      allowNull: false,
      defaultValue: null,
      primaryKey: true,
      autoIncrement: true,
      field: "id",
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "status",
    },
    auto_send_status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "auto_send_status",
    },
    smtp_host: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "mail.privateemail.com",
      field: "smtp_host",
    },
    smtp_port: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: 465,
      field: "smtp_port",
    },
    smtp_secure: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "smtp_secure",
    },
    smtp_user: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "event.registration@faa-dubd.org",
      field: "smtp_user",
    },
    smtp_pass: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'uDTN"t6{K2hp',
      field: "smtp_pass",
    },
    from_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Membership Team",
      field: "from_name",
    },
    from_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "event.registration@faa-dubd.org",
      field: "from_email",
    },
    reply_to_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "event.registration@faa-dubd.org",
      field: "reply_to_email",
    },
    email_subject: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Membership Payment Invoice",
      field: "email_subject",
    },
    email_body: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      defaultValue:
        "Hello {{full_name}},\r\n\r\nThank you for completing your membership payment. Your invoice is attached.\r\n\r\nBest regards,\r\nMembership Team",
      field: "email_body",
    },
    invoice_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Membership Payment Invoice",
      field: "invoice_title",
    },
    invoice_subtitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "Official payment receipt",
      field: "invoice_subtitle",
    },
    contact_details: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "Bangladesh | 01678141350 | Rahman.mushfique@gmail.com",
      field: "contact_details",
    },
    logo_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "public/global_assets/images/banner-logo.jpg",
      field: "logo_path",
    },
    site_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "https://faa-dubd.org",
      field: "site_url",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      field: "created_at",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal("NULL"),
      field: "updated_at",
    },
  };

  return sequelize.define(
    "MembershipInvoiceSettingModel",
    attributes,
    {
      tableName: "membership_invoice_settings",
      indexes: [],
      createdAt: false,
      updatedAt: false,
    }
  );
};
