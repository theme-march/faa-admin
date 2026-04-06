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
        type: DataTypes.TEXT,
        allowNull: false,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "details"
      },
        cover_image: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "cover_image"
        },
        file: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "file"
        },
        type: {
          type: DataTypes.ENUM('News','Publication'),
          allowNull: true,
          defaultValue: null,
          primaryKey: false,
          autoIncrement: false,
          comment: null,
          field: "type"
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
        tableName: "publication",
        comment: "",
        indexes: [],
        createdAt: false,
        updatedAt: false
    };
    return sequelize.define("PublicationModel", attributes, options);
};
