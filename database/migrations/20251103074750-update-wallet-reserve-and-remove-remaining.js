"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove the remainingBalance column
    await queryInterface.removeColumn("Wallets", "remainingBalance");

    // 2. Rename reserveFunds -> reserveBalance
    await queryInterface.renameColumn(
      "Wallets",
      "reserveFunds",
      "reserveBalance"
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert rename
    await queryInterface.renameColumn(
      "Wallets",
      "reserveBalance",
      "reserveFunds"
    );

    // Re-add remainingBalance column
    await queryInterface.addColumn("Wallets", "remainingBalance", {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },
};
