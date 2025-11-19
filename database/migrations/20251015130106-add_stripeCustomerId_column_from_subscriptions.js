"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if stripeCustomerId already exists
    const tableDefinition = await queryInterface.describeTable("Subscriptions");
    if (!tableDefinition.stripeCustomerId) {
      await queryInterface.addColumn("Subscriptions", "stripeCustomerId", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDefinition = await queryInterface.describeTable("Subscriptions");
    if (tableDefinition.stripeCustomerId) {
      await queryInterface.removeColumn("Subscriptions", "stripeCustomerId");
    }
  },
};
