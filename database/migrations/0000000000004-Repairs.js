module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Repairs", {
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

      specialty: {
        type: Sequelize.STRING,
      },

      servicesOffer: {
        type: Sequelize.STRING,
      },

      AboutUs: {
        type: Sequelize.STRING,
      },

      gallery: {
        type: Sequelize.ARRAY(Sequelize.STRING),

        allowNull: true,

        defaultValue: [],
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

      CustomerInsigts: {
        type: Sequelize.JSONB,

        allowNull: true,

        defaultValue: {
          totalJobsCompleted: 0,
          AverageJobValue: 0,
          TotalAppointments: 0,
          AppointmentsConversionRate: 0,
        },
      },

      LeadToAppointments: {
        type: Sequelize.JSONB,

        allowNull: true,

        defaultValue: {
          incomingLeads: 0,
          quoteRequests: 0,
          bookedAppointments: 0,
        },
      },

      MostInDemandServices: {
        type: Sequelize.JSONB,

        allowNull: true,

        defaultValue: {
          totalJobsCompleted: "NIL",
          AverageJobValue: "NIL",
          TotalAppointments: "NIL",
          AppointmentsConversionRate: "NIL",
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
    await queryInterface.dropTable("Repairs");
  },
};
