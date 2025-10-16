"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Subscriptions", "stripeCustomerId", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "stripeSubscriptionId", // optional: position in table
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Subscriptions", "stripeCustomerId");
  },
};
