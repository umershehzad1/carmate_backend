"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the 'analytics' column if it exists
    await queryInterface.removeColumn("Insurances", "analytics");

    // Add the new 'faqs' column
    await queryInterface.addColumn("Insurances", "faqs", {
      type: Sequelize.ARRAY(Sequelize.JSON),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert changes: remove 'faqs' and add 'analytics' back
    await queryInterface.removeColumn("Insurances", "faqs");

    await queryInterface.addColumn("Insurances", "analytics", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {
        quoteRequests: 0,
        policiesSold: 0,
        costPerLead: 0,
        roi: 0,
      },
    });
  },
};
