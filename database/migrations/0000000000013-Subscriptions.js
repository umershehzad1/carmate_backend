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

        references: {
          model: "Users",
          key: "id",
        },
        
        onDelete: "CASCADE",
      },

      plan: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      price: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      stripeSubscriptionId: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      stripeCustomerId: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      expiryDate: {
        type: Sequelize.DATE,

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
