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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "name",
    },
    designation: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "designation",
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "image",
    },
    bio: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: "bio",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "email",
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "phone",
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "display_order",
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      field: "status",
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

  const options = {
    tableName: "executive_committee",
    indexes: [],
    createdAt: false,
    updatedAt: false,
  };

  return sequelize.define("ExecutiveCommitteeModel", attributes, options);
};

