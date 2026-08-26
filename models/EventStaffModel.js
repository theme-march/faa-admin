const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("EventStaffModel", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM("entry_staff", "event_manager"), allowNull: false, defaultValue: "entry_staff" },
  status: { type: DataTypes.INTEGER(1), allowNull: false, defaultValue: 1 },
  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "event_staff",
  createdAt: false,
  updatedAt: false,
  indexes: [{ unique: true, fields: ["email"] }],
});
