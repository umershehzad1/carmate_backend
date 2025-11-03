"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Advertisements", "pauseReason", {
      type: Sequelize.ENUM("user", "budget", "system", "none"),
      allowNull: false,
      defaultValue: "none",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Advertisements", "pauseReason");
  },
};
