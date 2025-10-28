"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change the column type from ARRAY(STRING) to STRING
    await queryInterface.changeColumn("Insurances", "experience", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert back to ARRAY(STRING) if needed
    await queryInterface.changeColumn("Insurances", "experience", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },
};
