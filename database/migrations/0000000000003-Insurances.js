module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Insurances", {
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

      experience: {
        type: Sequelize.STRING,
      },

      keyBenifits: {
        type: Sequelize.STRING,
      },

      speciality: {
        type: Sequelize.STRING,
      },

      aboutUs: {
        type: Sequelize.STRING,
      },

      status: {
        type: Sequelize.ENUM("nonverified", "verified"),

        defaultValue: "nonverified",
      },

      image: {
        type: Sequelize.STRING,
      },

      reviews: {
        type: Sequelize.JSON,

        allowNull: true,

        defaultValue: { totalReview: 0, userReviews: [] },
      },

      analytics: {
        type: Sequelize.JSONB,

        allowNull: true,

        defaultValue: {
          quoteRequests: 0,
          policiesSold: 0,
          costPerLead: 0,
          roi: 0,
        },
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
    await queryInterface.dropTable("Insurances");
  },
};
