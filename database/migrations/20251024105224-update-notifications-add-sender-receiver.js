"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove old column
    await queryInterface.removeColumn("notifications", "userId");

    // Add new senderId and receiverId columns
    await queryInterface.addColumn("notifications", "senderId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("notifications", "receiverId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert changes
    await queryInterface.removeColumn("notifications", "senderId");
    await queryInterface.removeColumn("notifications", "receiverId");

    await queryInterface.addColumn("notifications", "userId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    });
  },
};
