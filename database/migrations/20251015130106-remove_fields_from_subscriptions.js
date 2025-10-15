"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.removeColumn("Subscriptions", "type"),
      queryInterface.removeColumn("Subscriptions", "description"),
      queryInterface.removeColumn("Subscriptions", "features"),
      queryInterface.removeColumn("Subscriptions", "carListing"),
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Restore removed columns if migration is reverted
    await Promise.all([
      queryInterface.addColumn("Subscriptions", "type", {
        type: Sequelize.ENUM("dealer", "repair", "insurance"),
        allowNull: false,
      }),
      queryInterface.addColumn("Subscriptions", "description", {
        type: Sequelize.TEXT,
        allowNull: true,
      }),
      queryInterface.addColumn("features", "features", {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      }),
      queryInterface.addColumn("Subscriptions", "carListing", {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      }),
    ]);
  },
};
