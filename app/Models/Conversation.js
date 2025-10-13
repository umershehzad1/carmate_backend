'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.hasMany(models.Message, {
        as: 'messages',
        foreignKey: 'conversationId',
        onDelete: 'CASCADE'
      });

      Conversation.belongsTo(models.User, {
        as: 'user1',
        foreignKey: 'user1Id'
      });

      Conversation.belongsTo(models.User, {
        as: 'user2',
        foreignKey: 'user2Id'
      });

   
    }
  }

  Conversation.init(
    {
      user1Id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      user2Id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
    
    },
    {
      sequelize,
      modelName: 'Conversation',
      timestamps: true
    }
  );

  return Conversation;
};
