'use strict';

const { User, Subscription } = require('../../Models');

class CheckSubscriptionExpiry {
  /**
   * Check if user's subscription is expired and restrict access accordingly
   */
  async handle(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user with subscription details
      const user = await User.findByPk(userId, {
        include: [{
          model: Subscription,
          as: 'subscriptions',
          where: { isActive: true },
          required: false
        }]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user role requires subscription
      const rolesRequiringSubscription = ['dealer', 'detailer', 'repair', 'insurance'];
      
      if (!rolesRequiringSubscription.includes(user.role)) {
        // User doesn't need subscription, continue
        return next();
      }

      // Check if user has active subscription
      const activeSubscription = user.subscriptions?.find(sub => 
        sub.isActive && !sub.isExpired()
      );

      if (!activeSubscription) {
        // No active subscription found
        return res.status(403).json({
          success: false,
          message: 'Subscription required',
          code: 'SUBSCRIPTION_REQUIRED',
          data: {
            userRole: user.role,
            hasExpiredSubscription: user.subscriptions?.some(sub => sub.isExpired()),
            redirectTo: '/payment/update-card'
          }
        });
      }

      // Check if subscription needs payment update
      if (activeSubscription.needsPaymentUpdate()) {
        return res.status(402).json({
          success: false,
          message: 'Payment update required',
          code: 'PAYMENT_UPDATE_REQUIRED',
          data: {
            subscriptionStatus: activeSubscription.status,
            cardInfo: activeSubscription.getMaskedCardInfo(),
            isCardExpired: activeSubscription.isCardExpired(),
            redirectTo: '/payment/update-card'
          }
        });
      }

      // Add subscription info to request for use in controllers
      req.subscription = activeSubscription;
      
      next();
    } catch (error) {
      console.error('CheckSubscriptionExpiry middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Middleware specifically for dashboard access
   */
  async handleDashboardAccess(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await User.findByPk(userId, {
        include: [{
          model: Subscription,
          as: 'subscriptions',
          required: false
        }]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user role requires subscription for dashboard access
      const rolesRequiringSubscription = ['dealer', 'detailer', 'repair', 'insurance'];
      
      if (!rolesRequiringSubscription.includes(user.role)) {
        return next();
      }

      // Find active subscription
      const activeSubscription = user.subscriptions?.find(sub => 
        sub.isActive && !sub.isExpired() && !sub.needsPaymentUpdate()
      );

      if (!activeSubscription) {
        // Block dashboard access, redirect to payment page
        return res.status(403).json({
          success: false,
          message: 'Dashboard access restricted. Please update your payment information.',
          code: 'DASHBOARD_ACCESS_RESTRICTED',
          data: {
            userRole: user.role,
            availableSubscriptions: user.subscriptions?.map(sub => ({
              id: sub.id,
              plan: sub.plan,
              status: sub.status,
              expiryDate: sub.expiryDate,
              isExpired: sub.isExpired(),
              needsPaymentUpdate: sub.needsPaymentUpdate(),
              cardInfo: sub.getMaskedCardInfo()
            })),
            redirectTo: '/payment/update-card'
          }
        });
      }

      req.subscription = activeSubscription;
      next();
    } catch (error) {
      console.error('Dashboard access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = CheckSubscriptionExpiry;