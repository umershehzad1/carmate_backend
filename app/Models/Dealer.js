'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Dealer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
       Dealer.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });
       Dealer.hasMany(models.Vehicle, {
        foreignKey: 'dealerId',
        as: 'vehicle',
        onDelete: 'CASCADE',
      });
    }
  }
  Dealer.init({
    name: DataTypes.STRING,
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onDelete: 'CASCADE',
    },
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    location: DataTypes.STRING,
    status: {type: DataTypes.ENUM('nonverified', 'verified'), defaultValue: 'nonverified'},
    image: DataTypes.STRING,
      analytics: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {
          totalViews: 0,
          totalClicks: 0,
          conversionRate: 0,
          competitorInsights: 0
        }
      },
     
     
    reviews: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        totalReview: 0,
        userReviews: []
      },
    },

  }, {
    sequelize,
    modelName: 'Dealer',
  });
  return Dealer;
};