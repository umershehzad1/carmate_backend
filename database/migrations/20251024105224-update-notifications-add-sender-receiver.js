"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists before modifying
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Notifications")) {
      // Remove old column
      await queryInterface.removeColumn("Notifications", "userId");

      // Add new senderId and receiverId columns
      await queryInterface.addColumn("Notifications", "senderId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      });

      await queryInterface.addColumn("Notifications", "receiverId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if table exists before reverting
    const tables = await queryInterface.showAllTables();
    if (tables.includes("Notifications")) {
      // Revert changes
      await queryInterface.removeColumn("Notifications", "senderId");
      await queryInterface.removeColumn("Notifications", "receiverId");

      await queryInterface.addColumn("Notifications", "userId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      });
    }
  },
};
