module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("notifications", {
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
      },

      type: {
        type: Sequelize.ENUM("message", "test_drive", "repair", "admin_alert"),

        allowNull: false,
      },

      messageId: {
        type: Sequelize.INTEGER,

        allowNull: true,

        references: {
          model: "Messages",
          key: "id",
        },
      },

      testDriveRequestId: {
        type: Sequelize.INTEGER,

        allowNull: true,

        references: {
          model: "TestDriveRequests",
          key: "id",
        },
      },

      referralId: {
        type: Sequelize.INTEGER,

        allowNull: true,

        references: {
          model: "Referrals",
          key: "id",
        },
      },

      content: {
        type: Sequelize.STRING,

        allowNull: false,
      },

      isRead: {
        type: Sequelize.BOOLEAN,

        defaultValue: false,
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
    await queryInterface.dropTable("notifications");
  },
};
