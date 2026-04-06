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
        event_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "event_id"
        },
        image: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "image"
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "title"
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
        tableName: "event_image_list",
        comment: "",
        indexes: [],
        createdAt: false,
        updatedAt: false
    };
    return sequelize.define("EventImageModel", attributes, options);
};
