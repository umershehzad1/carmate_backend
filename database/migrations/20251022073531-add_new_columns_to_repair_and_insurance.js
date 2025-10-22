"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add columns to Repair
    await queryInterface.addColumn("Repairs", "openingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    await queryInterface.addColumn("Repairs", "closingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    // Add columns to Insurance
    await queryInterface.addColumn("Insurances", "openingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    await queryInterface.addColumn("Insurances", "closingTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns if rolling back
    await queryInterface.removeColumn("Repairs", "openingTime");
    await queryInterface.removeColumn("Repairs", "closingTime");

    await queryInterface.removeColumn("Insurances", "openingTime");
    await queryInterface.removeColumn("Insurances", "closingTime");
  },
};
