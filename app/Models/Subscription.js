"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
      Subscription.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
      });

      Subscription.hasMany(models.PaymentLog, {
        foreignKey: "subscriptionId",
        as: "paymentLogs",
        onDelete: "SET NULL",
      });
    }

    // Check if subscription is expired
    isExpired() {
      if (!this.expiryDate) return false;
      return new Date() > new Date(this.expiryDate);
    }

    // Check if subscription needs payment update
    needsPaymentUpdate() {
      return this.status === 'past_due' || this.status === 'unpaid' || this.isExpired();
    }

    // Update card details
    async updateCardDetails(cardDetails) {
      const {
        last4,
        brand,
        exp_month,
        exp_year,
        payment_method_id,
        cardholder_name,
        billing_address
      } = cardDetails;

      return await this.update({
        cardLast4: last4,
        cardBrand: brand,
        cardExpMonth: exp_month,
        cardExpYear: exp_year,
        paymentMethodId: payment_method_id,
        cardHolderName: cardholder_name,
        billingAddress: billing_address
      });
    }

    // Get masked card info for display
    getMaskedCardInfo() {
      if (!this.cardLast4 || !this.cardBrand) {
        return null;
      }

      return {
        last4: this.cardLast4,
        brand: this.cardBrand,
        expMonth: this.cardExpMonth,
        expYear: this.cardExpYear,
        holderName: this.cardHolderName,
        maskedNumber: `**** **** **** ${this.cardLast4}`
      };
    }

    // Check if card is expired
    isCardExpired() {
      if (!this.cardExpMonth || !this.cardExpYear) return false;
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      return (this.cardExpYear < currentYear) || 
             (this.cardExpYear === currentYear && this.cardExpMonth < currentMonth);
    }
  }

  Subscription.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      plan: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stripeSubscriptionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      stripeCustomerId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cardLast4: {
        type: DataTypes.STRING(4),
        allowNull: true,
        comment: "Last 4 digits of the card",
      },
      cardBrand: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "Card brand (visa, mastercard, etc.)",
      },
      cardExpMonth: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Card expiration month",
      },
      cardExpYear: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Card expiration year",
      },
      cardHolderName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Name on the card",
      },
      paymentMethodId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Stripe payment method ID",
      },
      billingAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Billing address details",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "Whether subscription is currently active",
      },
      status: {
        type: DataTypes.ENUM(
          "active",
          "expired",
          "canceled",
          "past_due",
          "unpaid"
        ),
        allowNull: false,
        defaultValue: "active",
        comment: "Current subscription status",
      },
    },
    {
      sequelize,
      modelName: "Subscription",
      timestamps: true,
    }
  );

  return Subscription;
};
