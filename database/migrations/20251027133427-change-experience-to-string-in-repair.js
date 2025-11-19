"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Repairs", "experience", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "Repairs" ALTER COLUMN "experience" TYPE VARCHAR[] USING ARRAY["experience"]::VARCHAR[];`
    );
  },
};
