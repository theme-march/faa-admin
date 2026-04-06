const { DataTypes} = require('sequelize');
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
        event_title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "event_title"
        },
        event_details: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "event_details"
        },
      event_short_details: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "event_short_details"
      },
        event_date: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "event_date"
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
        event_type: {
            type: DataTypes.ENUM('National','International','Classified'),
            allowNull: true,
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            comment: null,
            field: "event_type"
        },
      event_session: {
        type: DataTypes.ENUM('Current Event','Past Event','Upcoming Event'),
        allowNull: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "event_session"
      },
      event_venue: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "event_venue"
      },
      event_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "event_fees"
      },
      membership_renew_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "membership_renew_fees"
      },
      member_single_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "member_single_fees"
      },
      member_spouse_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "member_spouse_fees"
      },
      student_single_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "student_single_fees"
      },
      student_spouse_fees: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "student_spouse_fees"
      },
      t_shirt_gift_status: {
        type: DataTypes.INTEGER(1),
        allowNull: true,
        defaultValue: 0,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "t_shirt_gift_status"
      },
      t_shirt_size_options: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "t_shirt_size_options"
      },
      member_participation_options: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "member_participation_options"
      },
      guest_participation_options: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "guest_participation_options"
      },
      membership_renew_status: {
        type: DataTypes.INTEGER(1),
        allowNull: true,
        defaultValue: 1,
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "membership_renew_status"
      },
      registration_access_mode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "both",
        primaryKey: false,
        autoIncrement: false,
        comment: null,
        field: "registration_access_mode"
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
        tableName: "event_list",
        comment: "",
        indexes: [],
        createdAt: false,
        updatedAt: false
    };
    return sequelize.define("EventModel", attributes, options);
};
