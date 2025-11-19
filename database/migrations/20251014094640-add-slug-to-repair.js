"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add slug to Repairs table
    await queryInterface.addColumn("Repairs", "slug", {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
    });
    
    // Add slug to Dealers table if not exists
    const dealersTable = await queryInterface.describeTable("Dealers");
    if (!dealersTable.slug) {
      await queryInterface.addColumn("Dealers", "slug", {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true,
      });
    }
    
    // Add slug to Insurances table if not exists
    const insurancesTable = await queryInterface.describeTable("Insurances");
    if (!insurancesTable.slug) {
      await queryInterface.addColumn("Insurances", "slug", {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if columns exist before removing
    const repairsTable = await queryInterface.describeTable("Repairs");
    if (repairsTable.slug) {
      await queryInterface.removeColumn("Repairs", "slug");
    }
    
    const dealersTable = await queryInterface.describeTable("Dealers");
    if (dealersTable.slug) {
      await queryInterface.removeColumn("Dealers", "slug");
    }
    
    const insurancesTable = await queryInterface.describeTable("Insurances");
    if (insurancesTable.slug) {
      await queryInterface.removeColumn("Insurances", "slug");
    }
  },
};
