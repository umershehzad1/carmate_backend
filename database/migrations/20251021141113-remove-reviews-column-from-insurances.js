"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Insurances", "reviews");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Insurances", "reviews", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {
        totalReview: 0,
        userReviews: [],
      },
    });
  },
};
