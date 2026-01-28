'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PaymentLog extends Model {
    static associate(models) {
      PaymentLog.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
      
      PaymentLog.belongsTo(models.Subscription, {
        foreignKey: 'subscriptionId',
        as: 'subscription'
      });
    }

    // Helper method to create a payment log
    static async createLog({
      userId,
      subscriptionId,
      stripePaymentIntentId,
      stripeChargeId,
      amount,
      currency = 'CAD',
      status = 'pending',
      paymentMethod,
      failureReason,
      attemptCount = 1,
      metadata = {}
    }) {
      return await this.create({
        userId,
        subscriptionId,
        stripePaymentIntentId,
        stripeChargeId,
        amount,
        currency,
        status,
        paymentMethod,
        failureReason,
        attemptCount,
        metadata
      });
    }

    // Helper method to update payment status
    async updateStatus(status, additionalData = {}) {
      const updateData = { status, ...additionalData };
      
      if (status === 'failed') {
        updateData.attemptCount = this.attemptCount + 1;
      }
      
      return await this.update(updateData);
    }

    // Get payment logs for a user
    static async getLogsForUser(userId, options = {}) {
      const { limit = 50, offset = 0, status } = options;
      
      const whereClause = { userId };
      if (status) {
        whereClause.status = status;
      }

      return await this.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: sequelize.models.Subscription,
            as: 'subscription',
            attributes: ['id', 'planType', 'status']
          }
        ]
      });
    }

    // Get failed payment attempts for a subscription
    static async getFailedAttempts(subscriptionId) {
      return await this.findAll({
        where: {
          subscriptionId,
          status: 'failed'
        },
        order: [['createdAt', 'DESC']]
      });
    }
  }

  PaymentLog.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    subscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'subscriptions',
        key: 'id'
      }
    },
    stripePaymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stripeChargeId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'CAD'
    },
    status: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'canceled', 'requires_action'),
      allowNull: false,
      defaultValue: 'pending'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PaymentLog',
    tableName: 'payment_logs',
    timestamps: true
  });

  return PaymentLog;
};