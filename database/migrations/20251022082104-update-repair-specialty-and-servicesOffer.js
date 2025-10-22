"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Temporarily remove the old columns
    await queryInterface.removeColumn("Repairs", "specialty");
    await queryInterface.removeColumn("Repairs", "servicesOffer");

    // Recreate them as ARRAY columns
    await queryInterface.addColumn("Repairs", "specialty", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });

    await queryInterface.addColumn("Repairs", "servicesOffer", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: [],
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to single STRING columns
    await queryInterface.removeColumn("Repairs", "specialty");
    await queryInterface.removeColumn("Repairs", "servicesOffer");

    await queryInterface.addColumn("Repairs", "specialty", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Repairs", "servicesOffer", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
