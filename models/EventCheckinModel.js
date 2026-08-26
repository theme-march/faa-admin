const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("EventCheckinModel", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  registration_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  member_id: { type: DataTypes.STRING(255), allowNull: true },
  event_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  staff_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  actor_type: { type: DataTypes.ENUM("staff", "admin", "member"), allowNull: false, defaultValue: "staff" },
  actor_name: { type: DataTypes.STRING(255), allowNull: true },
  qr_type: { type: DataTypes.ENUM("EVENT_QR", "MEMBER_CARD_QR", "MANUAL"), allowNull: false },
  checked_in_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.ENUM("active", "reversed"), allowNull: false, defaultValue: "active" },
  reversed_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reversed_at: { type: DataTypes.DATE, allowNull: true },
  reverse_reason: { type: DataTypes.STRING(500), allowNull: true },
  ip_address: { type: DataTypes.STRING(64), allowNull: true },
  user_agent: { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: "event_checkins",
  createdAt: false,
  updatedAt: false,
  indexes: [
    { fields: ["registration_id", "status"] },
    { fields: ["event_id", "checked_in_at"] },
  ],
});
