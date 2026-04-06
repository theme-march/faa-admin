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
    register_member_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "register_member_id"
    },
    member_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      comment: null,
      field: "member_id"
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: null,
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
    tableName: "member_approval_list",
    comment: "",
    indexes: [],
    createdAt: false,
    updatedAt: false
  };
  return sequelize.define("MemberApprovalModel", attributes, options);
};
