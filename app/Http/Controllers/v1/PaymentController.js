'use strict';

// Ensure dotenv is loaded
require('dotenv').config();

const { User, Subscription, PaymentLog } = require('../../../Models');
const json = require('../../../Traits/ApiResponser'); // Your custom response helper

// Initialize Stripe with proper error handling
let stripe;
try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY or STRIPE_SECRET environment variable is not set');
    throw new Error('Stripe configuration missing');
  }
  stripe = require('stripe')(stripeSecretKey);
  console.log('✅ Stripe initialized successfully in PaymentController');
} catch (error) {
  console.error('Failed to initialize Stripe:', error.message);
  // Set stripe to null so we can handle it gracefully in methods
  stripe = null;
}

const o = {};
  
/**
 * Check if Stripe is properly initialized
 */
const _checkStripeInitialization = () => {
  if (!stripe) {
    throw new Error('Stripe is not properly configured. Please check STRIPE_SECRET_KEY environment variable.');
  }
};

/**
 * Calculate new expiry date based on plan type
 */
const _calculateNewExpiryDate = (planType) => {
  const now = new Date();
  
  // Default to 30 days if plan type is not recognized
  let daysToAdd = 30;
  
  // Adjust based on plan type
  if (planType && typeof planType === 'string') {
    const plan = planType.toLowerCase();
    if (plan.includes('monthly') || plan.includes('month')) {
      daysToAdd = 30;
    } else if (plan.includes('yearly') || plan.includes('year') || plan.includes('annual')) {
      daysToAdd = 365;
    } else if (plan.includes('weekly') || plan.includes('week')) {
      daysToAdd = 7;
    }
  }
  
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + daysToAdd);
  
  return expiryDate;
};

/**
 * Get user's current payment information
 */
o.getPaymentInfo = async function (req, res) {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      include: [{
        model: Subscription,
        as: 'subscriptions',
        where: { isActive: true },
        required: false
      }]
    });

    if (!user) {
      return json.errorResponse(res, 'User not found', 404);
    }

    const activeSubscription = user.subscriptions?.[0];
    
    const paymentInfo = {
      hasActiveSubscription: !!activeSubscription,
      subscriptionStatus: activeSubscription?.status,
      cardInfo: activeSubscription?.getMaskedCardInfo(),
      isCardExpired: activeSubscription?.isCardExpired(),
      subscriptionExpiry: activeSubscription?.expiryDate,
      needsPaymentUpdate: activeSubscription?.needsPaymentUpdate(),
      stripeConfigured: !!stripe
    };

    return json.successResponse(res, 'Payment information retrieved', paymentInfo);
  } catch (error) {
    console.error('Get payment info error:', error);
    return json.errorResponse(res, 'Failed to retrieve payment information');
  }
};

/**
 * Update payment method
 */
o.updatePaymentMethod = async function (req, res) {
  try {
    _checkStripeInitialization();
    
    const userId = req.user.id;
    const { payment_method_id, save_card = true } = req.body;

    if (!payment_method_id) {
      return json.errorResponse(res, 'Payment method ID is required', 400);
    }

    // Get user's subscription
    const subscription = await Subscription.findOne({
      where: { userId, isActive: true },
      include: [{
        model: User,
        as: 'user'
      }]
    });

    if (!subscription) {
      return json.errorResponse(res, 'No active subscription found', 404);
    }

    // Retrieve payment method from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
    
    if (!paymentMethod) {
      return json.errorResponse(res, 'Invalid payment method', 400);
    }

    // Attach payment method to customer if not already attached
    if (!paymentMethod.customer) {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: subscription.stripeCustomerId,
      });
    }

    // Update default payment method for customer
    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    // Update subscription's default payment method
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      default_payment_method: payment_method_id,
    });

    // Save card details to subscription if requested
    if (save_card) {
      const cardDetails = {
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
        payment_method_id: payment_method_id,
        cardholder_name: paymentMethod.billing_details.name,
        billing_address: paymentMethod.billing_details.address
      };

      await subscription.updateCardDetails(cardDetails);
    }

    let paymentProcessed = false;
    
    // If subscription was past due, try to reactivate it
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      try {
        // Attempt to pay any outstanding invoices
        const invoices = await stripe.invoices.list({
          customer: subscription.stripeCustomerId,
          status: 'open',
          limit: 5
        });

        for (const invoice of invoices.data) {
          const result = await processInvoicePayment(invoice, subscription, userId);
          if (result.status === 'paid') {
            paymentProcessed = true;
          }
        }

        // Update subscription status and expiry date if payment was successful
        if (paymentProcessed) {
          const newExpiryDate = _calculateNewExpiryDate(subscription.plan);
          await subscription.update({ 
            status: 'active',
            expiryDate: newExpiryDate
          });
        } else {
          await subscription.update({ status: 'active' });
        }
      } catch (invoiceError) {
        console.error('Error processing outstanding invoices:', invoiceError);
        // Continue even if invoice payment fails
      }
    }

    return json.successResponse(res, 'Payment method updated successfully', {
      cardInfo: subscription.getMaskedCardInfo(),
      subscriptionStatus: subscription.status,
      expiryDate: subscription.expiryDate,
      paymentProcessed
    });

  } catch (error) {
    console.error('Update payment method error:', error);
    
    // Log the failed attempt
    try {
      await PaymentLog.createLog({
        userId: req.user.id,
        subscriptionId: req.subscription?.id,
        amount: 0,
        status: 'failed',
        failureReason: error.message,
        metadata: { action: 'update_payment_method' }
      });
    } catch (logError) {
      console.error('Failed to log payment error:', logError);
    }

    return json.errorResponse(res, 'Failed to update payment method');
  }
};

/**
 * Process payment for an invoice
 */
const processInvoicePayment = async (invoice, subscription, userId) => {
  try {
    _checkStripeInitialization();
    
    // Create payment log entry
    const paymentLog = await PaymentLog.createLog({
      userId,
      subscriptionId: subscription.id,
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: 'pending',
      metadata: {
        invoiceId: invoice.id,
        action: 'invoice_payment'
      }
    });

    // Attempt to pay the invoice
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    // Update payment log based on result
    if (paidInvoice.status === 'paid') {
      await paymentLog.updateStatus('succeeded', {
        stripeChargeId: paidInvoice.charge
      });
      
      // Update subscription expiry date when payment succeeds
      const newExpiryDate = _calculateNewExpiryDate(subscription.plan);
      await subscription.update({
        status: 'active',
        expiryDate: newExpiryDate
      });
      
    } else {
      await paymentLog.updateStatus('failed', {
        failureReason: `Invoice payment failed with status: ${paidInvoice.status}`
      });
    }

    return paidInvoice;
  } catch (error) {
    console.error('Invoice payment error:', error);
    throw error;
  }
};

/**
 * Get payment logs for user
 */
o.getPaymentLogs = async function (req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const offset = (page - 1) * limit;
    
    const logs = await PaymentLog.getLogsForUser(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    });

    return json.successResponse(res, 'Payment logs retrieved', {
      logs: logs.rows,
      pagination: {
        total: logs.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(logs.count / limit)
      }
    });
  } catch (error) {
    console.error('Get payment logs error:', error);
    return json.errorResponse(res, 'Failed to retrieve payment logs');
  }
};

/**
 * Get all payment logs (admin only)
 */
o.getAllPaymentLogs = async function (req, res) {
  try {
    const { page = 1, limit = 50, status, userId } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (userId) whereClause.userId = parseInt(userId);

    const logs = await PaymentLog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullname', 'role']
        },
        {
          model: Subscription,
          as: 'subscription',
          attributes: ['id', 'plan', 'status', 'expiryDate']
        }
      ]
    });

    return json.successResponse(res, 'All payment logs retrieved', {
      logs: logs.rows,
      pagination: {
        total: logs.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(logs.count / limit)
      }
    });
  } catch (error) {
    console.error('Get all payment logs error:', error);
    return json.errorResponse(res, 'Failed to retrieve payment logs');
  }
};

/**
 * Retry failed payment
 */
o.retryPayment = async function (req, res) {
  try {
    _checkStripeInitialization();
    
    const userId = req.user.id;
    const { subscription_id } = req.body;

    const subscription = await Subscription.findOne({
      where: { 
        id: subscription_id,
        userId,
        isActive: true 
      }
    });

    if (!subscription) {
      return json.errorResponse(res, 'Subscription not found', 404);
    }

    // Get latest invoice for the subscription
    const invoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId,
      status: 'open',
      limit: 1
    });

    if (invoices.data.length === 0) {
      return json.errorResponse(res, 'No pending invoices found', 400);
    }

    const invoice = invoices.data[0];
    
    // Process the payment
    const result = await processInvoicePayment(invoice, subscription, userId);

    if (result.status === 'paid') {
      // Expiry date is already updated in processInvoicePayment
      return json.successResponse(res, 'Payment processed successfully', {
        subscriptionStatus: 'active',
        expiryDate: subscription.expiryDate
      });
    } else {
      return json.errorResponse(res, 'Payment failed', 402);
    }

  } catch (error) {
    console.error('Retry payment error:', error);
    return json.errorResponse(res, 'Failed to process payment');
  }
};

/**
 * Create setup intent for adding new payment method
 */
o.createSetupIntent = async function (req, res) {
  try {
    _checkStripeInitialization();
    
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      include: [{
        model: Subscription,
        as: 'subscriptions',
        where: { isActive: true },
        required: false
      }]
    });

    if (!user) {
      return json.errorResponse(res, 'User not found', 404);
    }

    let customerId = user.subscriptions?.[0]?.stripeCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString()
        }
      });
      customerId = customer.id;
    }

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return json.successResponse(res, 'Setup intent created', {
      client_secret: setupIntent.client_secret,
      customer_id: customerId
    });

  } catch (error) {
    console.error('Create setup intent error:', error);
    return json.errorResponse(res, 'Failed to create setup intent');
  }
};

/**
 * Create payment intent for subscription renewal
 */
o.createPaymentIntent = async function (req, res) {
  try {
    _checkStripeInitialization();
    
    const userId = req.user.id;
    const { amount, currency = 'CAD' } = req.body;

    if (!amount || amount <= 0) {
      return json.errorResponse(res, 'Valid amount is required', 400);
    }

    const user = await User.findByPk(userId, {
      include: [{
        model: Subscription,
        as: 'subscriptions',
        where: { isActive: true },
        required: false
      }]
    });

    if (!user) {
      return json.errorResponse(res, 'User not found', 404);
    }

    let customerId = user.subscriptions?.[0]?.stripeCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString()
        }
      });
      customerId = customer.id;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: {
        userId: userId.toString(),
        type: 'subscription_renewal'
      }
    });

    // Log the payment attempt
    await PaymentLog.createLog({
      userId,
      subscriptionId: user.subscriptions?.[0]?.id,
      stripePaymentIntentId: paymentIntent.id,
      amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      metadata: {
        type: 'subscription_renewal',
        paymentIntentId: paymentIntent.id
      }
    });

    return json.successResponse(res, 'Payment intent created', {
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    return json.errorResponse(res, 'Failed to create payment intent');
  }
};

module.exports = o;