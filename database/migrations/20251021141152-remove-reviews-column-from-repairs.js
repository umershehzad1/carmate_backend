"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Repairs", "reviews");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Repairs", "reviews", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {
        totalReview: 0,
        userReviews: [],
      },
    });
  },
};
