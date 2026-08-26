const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("EventStaffAssignmentModel", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  staff_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  event_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  assigned_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "event_staff_assignments",
  createdAt: false,
  updatedAt: false,
  indexes: [{ unique: true, fields: ["staff_id", "event_id"] }],
});
