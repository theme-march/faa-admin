const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("MemberCardTokenAuditModel", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  member_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  token_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  action: { type: DataTypes.STRING(50), allowNull: false },
  actor_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  note: { type: DataTypes.STRING(500), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "member_card_token_audits",
  createdAt: false,
  updatedAt: false,
  indexes: [
    { fields: ["member_id", "created_at"] },
    { fields: ["token_id"] },
  ],
});
