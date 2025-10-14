module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Messages", {
      id: {
        type: Sequelize.INTEGER,

        allowNull: false,

        primaryKey: true,

        autoIncrement: true,
      },

      senderId: {
        type: Sequelize.INTEGER,

        allowNull: false,
      },

      receiverId: {
        type: Sequelize.INTEGER,

        allowNull: false,
      },

      conversationId: {
        type: Sequelize.INTEGER,

        allowNull: false,
      },

      content: {
        type: Sequelize.TEXT,

        allowNull: false,
      },

      isRead: {
        type: Sequelize.BOOLEAN,

        defaultValue: false,
      },

      sentAt: {
        type: Sequelize.DATE,

        defaultValue: {},
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
    await queryInterface.dropTable("Messages");
  },
};

