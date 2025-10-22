"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Drop the old columns (removes incompatible string type)
    await queryInterface.removeColumn("Insurances", "experience");
    await queryInterface.removeColumn("Insurances", "keyBenifits");
    await queryInterface.removeColumn("Insurances", "speciality");

    // 2. Add them again as ARRAY columns
    await queryInterface.addColumn("Insurances", "experience", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });

    await queryInterface.addColumn("Insurances", "keyBenifits", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });

    await queryInterface.addColumn("Insurances", "speciality", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Rollback: remove the ARRAY columns and restore as STRING
    await queryInterface.removeColumn("Insurances", "experience");
    await queryInterface.removeColumn("Insurances", "keyBenifits");
    await queryInterface.removeColumn("Insurances", "speciality");

    await queryInterface.addColumn("Insurances", "experience", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Insurances", "keyBenifits", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("Insurances", "speciality", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
