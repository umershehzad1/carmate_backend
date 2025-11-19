"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Packages", "vehicleCount", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Set null values to 0 before changing to NOT NULL
    await queryInterface.sequelize.query(
      'UPDATE "Packages" SET "vehicleCount" = 0 WHERE "vehicleCount" IS NULL;'
    );
    
    await queryInterface.changeColumn("Packages", "vehicleCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
