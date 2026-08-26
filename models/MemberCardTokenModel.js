const { DataTypes } = require("sequelize");

module.exports = (sequelize) => sequelize.define("MemberCardTokenModel", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  member_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  token_value: { type: DataTypes.STRING(128), allowNull: false },
  is_active: { type: DataTypes.INTEGER(1), allowNull: false, defaultValue: 1 },
  issued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  revoked_at: { type: DataTypes.DATE, allowNull: true },
  last_scanned_at: { type: DataTypes.DATE, allowNull: true },
  created_by: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, {
  tableName: "member_card_tokens",
  createdAt: false,
  updatedAt: false,
  indexes: [
    { unique: true, fields: ["token_hash"] },
    { fields: ["member_id", "is_active"] },
  ],
});
