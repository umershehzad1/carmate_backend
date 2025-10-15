"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the 'duration' column from the 'Advertisements' table
    await queryInterface.removeColumn("Advertisements", "duration");
  },

  async down(queryInterface, Sequelize) {
    // Revert the change (add 'duration' column back if needed)
    await queryInterface.addColumn("Advertisements", "duration", {
      type: Sequelize.INTEGER, // or the original data type you used before
      allowNull: true,
    });
  },
};
