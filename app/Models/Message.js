'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.User, {
        as: 'sender',
        foreignKey: 'senderId'
      });

      Message.belongsTo(models.User, {
        as: 'receiver',
        foreignKey: 'receiverId'
      });

      Message.belongsTo(models.Conversation, {
        as: 'conversation',
        foreignKey: 'conversationId',
        onDelete: 'CASCADE'
      });
      Message.hasMany(models.Notifications, {
  foreignKey: 'messageId',
  as: 'notifications'
});

    }
  }

  Message.init(
    {
      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      receiverId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      conversationId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      sentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'Message',
      timestamps: true
    }
  );

  return Message;
};
