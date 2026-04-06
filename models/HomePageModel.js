const {
  DataTypes
} = require('sequelize');
const Sequelize = require("sequelize");

module.exports = sequelize => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      allowNull: false,
      defaultValue: null,
      primaryKey: true,
      autoIncrement: true,
      comment: null,
      field: "id"
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "title"
    },
    details: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "details"
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "url"
    },
    section: {
      type: DataTypes.ENUM('AboutUs','MilestoneProgram'),
      allowNull: true,
      defaultValue: null,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "section"
    },
    order_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      autoIncrement: false,
      comment: null,
      field: "order_by"
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "status"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "created_at"
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('NULL'),
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "updated_at"
    },
  };
  const options = {
    tableName: "home_page",
    comment: "",
    indexes: [],
    createdAt: false,
    updatedAt: false
  };
  return sequelize.define("HomePageModel", attributes, options);
};
