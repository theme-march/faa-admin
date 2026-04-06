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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "title"
    },
    youtube_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: "youtube_url"
    },
    status: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: 1,
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
    tableName: "youtube_video",
    indexes: [],
    createdAt: false,
    updatedAt: false
  };

  return sequelize.define("YoutubeVideoModel", attributes, options);
};
