const Sequelize = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("AdminLogin", {
      name: Sequelize.STRING(255),
      username: Sequelize.STRING(255),
      password: Sequelize.STRING(255),
      status: Sequelize.INTEGER,
      created_at: {
        type: 'TIMESTAMP',
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: 'DATETIME',
        allowNull: true,
        defaultValue: Sequelize.literal('NULL'),
      }
    }, {
      tableName: "admin_user",
      createdAt: false,
      updatedAt: false
    });
};
