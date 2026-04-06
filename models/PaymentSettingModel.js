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
    store_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "store_id"
    },
    store_passwd: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "store_passwd"
    },
    is_live: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 0,
      field: "is_live"
    },
    ssl_enabled: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "ssl_enabled"
    },
    cash_enabled: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 0,
      field: "cash_enabled"
    },
    cash_payment_notice: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: "cash_payment_notice"
    },
    site_url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "site_url"
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 0,
      field: "status"
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
    tableName: "payment_settings",
    indexes: [],
    createdAt: false,
    updatedAt: false
  };

  return sequelize.define("PaymentSettingModel", attributes, options);
};
