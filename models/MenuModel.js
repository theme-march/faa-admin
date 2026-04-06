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
        menu_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "menu_name"
        },
        parent_id: {
            type: DataTypes.INTEGER(10),
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "parent_id"
        },
        order_by: {
            type: DataTypes.INTEGER(1),
            allowNull: true,
            defaultValue: 1,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "order_by"
        },
        menu_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "menu_url"
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
        tableName: "menu_list",
        comment: "",
        indexes: [],
        createdAt: false,
        updatedAt: false
    };
    return sequelize.define("MenuModel", attributes, options);
};
