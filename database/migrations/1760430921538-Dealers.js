module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Dealers", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      name: {
        type: Sequelize.STRING,
      },

      userId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "Users",
          key: "id",
        },
      },

      email: {
        type: Sequelize.STRING,
      },

      phone: {
        type: Sequelize.STRING,
      },

      location: {
        type: Sequelize.STRING,
      },

      status: {
        type: Sequelize.ENUM("nonverified", "verified"),
        defaultValue: "nonverified",
      },

      image: {
        type: Sequelize.STRING,
      },

      analytics: {
        type: Sequelize.JSONB,

        allowNull: true,

        defaultValue: {
          totalViews: 0,
          totalClicks: 0,
          conversionRate: 0,
          competitorInsights: 0,
        },
      },

      reviews: {
        type: Sequelize.JSON,

        allowNull: true,

        defaultValue: { totalReview: 0, userReviews: [] },
      },

      createdAt: {
        type: Sequelize.DATE,

        allowNull: false,
      },

      updatedAt: {
        type: Sequelize.DATE,

        allowNull: false,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Dealers");
  },
};
