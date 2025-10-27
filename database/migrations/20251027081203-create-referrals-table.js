"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Referrals", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      customerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      assignedToId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "SET NULL",
      },

      jobType: {
        type: Sequelize.ENUM("repair", "insurance"),
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("new", "inprogress", "completed"),
        allowNull: false,
        defaultValue: "new",
      },

      vehicleName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      requestedDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop ENUMs first to avoid PostgreSQL enum conflicts
    await queryInterface.dropTable("Referrals");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Referrals_jobType";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Referrals_status";'
    );
  },
};
