'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
       Subscription.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  Subscription.init(
    {
       userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      type: {
        type: DataTypes.ENUM('dealer', 'repair', 'insurance'),
        allowNull: false,
      },
      plan: {
        type: DataTypes.ENUM('basic', 'pro', 'premium'),
        allowNull: false,
      },
      price: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      features: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      carListing: {
        type: DataTypes.INTEGER,
        allowNull: true, // only for dealers
        validate: {
          min: 0,
        },
      },
    },
    {
      sequelize,
      modelName: 'Subscription',
      timestamps: true,

      validate: {
        validPlanCombination() {
          // Restrict invalid plan-type combinations
          if (this.type === 'repair' && this.plan === 'premium') {
            throw new Error('Repair type cannot have a premium plan.');
          }
          if (this.type === 'insurance' && this.plan === 'premium') {
            throw new Error('Insurance type cannot have a premium plan.');
          }

          // Restrict carListing to dealer only
          if (this.type !== 'dealer' && this.carListing !== null && this.carListing !== undefined) {
            throw new Error('Only dealer subscriptions can have a carListing value.');
          }
        },
      },
    }
  );

  return Subscription;
};
