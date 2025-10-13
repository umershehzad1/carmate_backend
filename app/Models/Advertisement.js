'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Advertisement extends Model {
    static associate(models) {
      // Each sponsored ad belongs to a dealer (User with role 'dealer')
      Advertisement.belongsTo(models.User, {
        foreignKey: 'dealerId',
        as: 'dealer',
        onDelete: 'CASCADE'
      });

      // Optionally link to a vehicle
      Advertisement.belongsTo(models.Vehicle, {
        foreignKey: 'vehicleId',
        as: 'vehicle'
      });
    }
  }

  Advertisement.init(
    {
      dealerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' } // user table ID
      },
      vehicleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Vehicles', key: 'id' }
      },
      status: {
        type: DataTypes.ENUM('running', 'stopped'),
        defaultValue: 'running',
        allowNull: false
      },
      adType: {
        type: DataTypes.ENUM('featured', 'sponsored'),
        defaultValue: 'featured',
        allowNull: false
      },
      views: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      leads: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      amountSpent: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0
      },
      dailyBudget: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0
      },
      duration: {
        type: DataTypes.INTEGER, // in days
        defaultValue: 0
      },
      startDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Advertisement',
      timestamps: true
    }
  );

  return Advertisement;
};
