"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove columns from Dealers table
    await Promise.all([
      queryInterface.removeColumn("Dealers", "name").catch(() => {}),
      queryInterface.removeColumn("Dealers", "email").catch(() => {}),
      queryInterface.removeColumn("Dealers", "phone").catch(() => {}),

      // Remove columns from Repairs table
      queryInterface.removeColumn("Repairs", "name").catch(() => {}),
      queryInterface.removeColumn("Repairs", "email").catch(() => {}),
      queryInterface.removeColumn("Repairs", "phone").catch(() => {}),

      // Remove columns from Insurances table
      queryInterface.removeColumn("Insurances", "name").catch(() => {}),
      queryInterface.removeColumn("Insurances", "email").catch(() => {}),
      queryInterface.removeColumn("Insurances", "phone").catch(() => {}),
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Re-add columns if rolled back
    await Promise.all([
      // Dealers
      queryInterface.addColumn("Dealers", "name", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Dealers", "email", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Dealers", "phone", {
        type: Sequelize.STRING,
        allowNull: true,
      }),

      // Repairs
      queryInterface.addColumn("Repairs", "name", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Repairs", "email", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Repairs", "phone", {
        type: Sequelize.STRING,
        allowNull: true,
      }),

      // Insurances
      queryInterface.addColumn("Insurances", "name", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Insurances", "email", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Insurances", "phone", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
    ]);
  },
};
