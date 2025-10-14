module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Subscriptions", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      userId: {
        type: Sequelize.INTEGER,

        allowNull: false,

        unique: true,

        references: {
          model: "Users",
          key: "id",
        },
      },

      type: {
        type: Sequelize.ENUM("dealer", "repair", "insurance"),

        allowNull: false,
      },

      plan: {
        type: Sequelize.ENUM("basic", "pro", "premium"),

        allowNull: false,
      },

      price: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,

        allowNull: true,
      },

      features: {
        type: Sequelize.JSON,

        allowNull: false,

        defaultValue: [],
      },

      expiryDate: {
        type: Sequelize.DATE,

        allowNull: true,
      },

      carListing: {
        type: Sequelize.INTEGER,

        allowNull: true,
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
    await queryInterface.dropTable("Subscriptions");
  },
};
