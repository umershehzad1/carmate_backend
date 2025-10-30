"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const stripe = require("../../../../config/Stripe");
const Subscription = db.Subscription;
const Vehicle = db.Vehicle;
const User = db.User;
const Package = db.Package;
const Dealer = db.Dealer;
const Repair = db.Repair;
const Insurance = db.Insurance;

const o = {};

o.createCheckoutSession = async function (req, res, next) {
  try {
    // 'basic' | 'pro' | 'premium'
    const { id: userId, role } = req.decoded;
    const { id } = req.params;
    const plan = await Package.findByPk(id);
    const productId = plan.stripeProductId;

    const product = await stripe.products.retrieve(productId);
    const priceList = await stripe.prices.list({
      product: productId,
      active: true,
    });
    const user = await User.findByPk(userId);
    const priceId = priceList.data[0]?.id;

    if (!priceId)
      return json.errorResponse(res, "No price found for product", 400);

    // ✅ Create Stripe customer if not already created
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullname || "Unknown User",
    });

    // ✅ Create Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      metadata: {
        name: user.name,
        userId: user.id,
        plan: plan.package,
      },
    });

    return json.showOne(res, { checkoutUrl: session.url }, 200);
  } catch (error) {
    console.error("Stripe Subscription Error:", error);
    return json.errorResponse(
      res,
      error.message || "Something went wrong",
      400
    );
  }
};

o.handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log(
      "🔍 [WEBHOOK] Session received:",
      JSON.stringify(session, null, 2)
    );

    let { userId, plan } = session.metadata;

    // ✅ Convert userId to integer
    userId = parseInt(userId, 10);

    console.log(
      `📍 [WEBHOOK] Extracted metadata - userId: ${userId}, plan: ${plan}`
    );

    if (!userId || !plan) {
      console.error("❌ [WEBHOOK] Missing userId or plan in metadata");
      throw new Error(`Missing userId (${userId}) or plan (${plan})`);
    }

    // --- Retrieve Stripe subscription details ---
    console.log(
      `🔄 [WEBHOOK] Retrieving Stripe subscription: ${session.subscription}`
    );
    const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
    console.log(`✅ [WEBHOOK] Stripe subscription retrieved:`, {
      id: stripeSub.id,
      customer: stripeSub.customer,
      current_period_end: stripeSub.current_period_end,
      status: stripeSub.status,
    });

    // --- Compute expiry date ---
    let expiryDate;
    console.log(`🕐 [WEBHOOK] Computing expiry date...`);
    if (stripeSub.current_period_end) {
      expiryDate = new Date(stripeSub.current_period_end * 1000);
      console.log(
        `📅 [WEBHOOK] Using current_period_end: ${expiryDate.toISOString()}`
      );
    } else if (stripeSub.start_date) {
      expiryDate = new Date(stripeSub.start_date * 1000);
      console.log(`📅 [WEBHOOK] Using start_date: ${expiryDate.toISOString()}`);
      if (stripeSub.plan?.interval === "month") {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        console.log(`📅 [WEBHOOK] Added 1 month: ${expiryDate.toISOString()}`);
      } else if (stripeSub.plan?.interval === "year") {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        console.log(`📅 [WEBHOOK] Added 1 year: ${expiryDate.toISOString()}`);
      } else {
        expiryDate.setDate(expiryDate.getDate() + 30);
        console.log(`📅 [WEBHOOK] Added 30 days: ${expiryDate.toISOString()}`);
      }
    } else {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      console.log(
        `📅 [WEBHOOK] Default fallback (now + 1 month): ${expiryDate.toISOString()}`
      );
    }

    if (isNaN(expiryDate.getTime())) {
      console.error("❌ [WEBHOOK] Invalid expiryDate:", expiryDate);
      throw new Error("Invalid expiryDate value");
    }
    console.log(`✅ [WEBHOOK] Final expiryDate: ${expiryDate.toISOString()}`);

    const price = stripeSub.items.data[0].price.unit_amount / 100;
    console.log(`💰 [WEBHOOK] Price: $${price}`);

    // --- ALWAYS CREATE NEW SUBSCRIPTION ---
    console.log(
      `📝 [WEBHOOK] Creating new subscription for userId: ${userId}...`
    );

    const subscriptionData = {
      userId: parseInt(userId, 10),
      plan: String(plan).trim(),
      price: `$${price}`,
      expiryDate:
        expiryDate instanceof Date ? expiryDate : new Date(expiryDate),
      stripeSubscriptionId: String(stripeSub.id).trim(),
      stripeCustomerId: String(stripeSub.customer).trim(),
    };

    console.log(`📝 [WEBHOOK] Subscription data:`, subscriptionData);

    try {
      const newSub = await Subscription.create(subscriptionData, {
        validate: false,
        logging: (sql) => console.log(`📝 [SQL]: ${sql}`),
      });

      console.log(`✅ [WEBHOOK] New subscription created:`, {
        id: newSub.id,
        userId: newSub.userId,
        plan: newSub.plan,
        price: newSub.price,
        expiryDate: newSub.expiryDate?.toISOString?.(),
        stripeSubscriptionId: newSub.stripeSubscriptionId,
        stripeCustomerId: newSub.stripeCustomerId,
      });
    } catch (createErr) {
      console.error("❌ [WEBHOOK] Subscription creation failed");
      console.error("❌ Error message:", createErr.message);
      if (createErr.errors) {
        console.error("❌ Validation errors:", createErr.errors);
      }
      console.error("❌ Full error:", createErr);
      throw createErr;
    }

    // --- Retrieve user and package ---
    console.log(`🔍 [WEBHOOK] Retrieving user ${userId}...`);
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`❌ [WEBHOOK] User ${userId} not found`);
      throw new Error("User not found");
    }
    console.log(`✅ [WEBHOOK] User found:`, {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      currentRole: user.role,
    });

    console.log(`🔍 [WEBHOOK] Retrieving package with name: ${plan}...`);
    const packageData = await Package.findOne({ where: { package: plan } });
    if (!packageData) {
      console.error(`❌ [WEBHOOK] Package ${plan} not found`);
      throw new Error("Package not found");
    }
    console.log(`✅ [WEBHOOK] Package found:`, {
      id: packageData.id,
      package: packageData.package,
      packageCategory: packageData.packageCategory,
      vehicleCount: packageData.vehicleCount,
    });

    const newRole = packageData.packageCategory;
    console.log(`🎯 [WEBHOOK] New role from package: ${newRole}`);

    // --- Update user role based on package ---
    if (newRole && user.role !== newRole) {
      console.log(
        `🔄 [WEBHOOK] Role change detected: ${user.role} → ${newRole}`
      );
      user.role = newRole;
      await user.save();
      console.log(`✅ [WEBHOOK] User role updated in database`);

      // Create corresponding role-specific record if not existing
      if (newRole === "dealer") {
        console.log(
          `🔍 [WEBHOOK] Checking for existing Dealer record for userId: ${userId}`
        );
        const existingDealer = await Dealer.findOne({ where: { userId } });
        if (!existingDealer) {
          console.log(`📝 [WEBHOOK] Creating new Dealer record...`);
          const slug = user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
          const newDealer = await Dealer.create({
            userId,
            location: user.city || null,
            status: "nonverified",
            slug: slug,
            availableCarListing: packageData.vehicleCount || 0,
          });
          console.log(`✅ [WEBHOOK] Dealer record created:`, {
            id: newDealer.id,
            userId: newDealer.userId,
            slug: newDealer.slug,
            status: newDealer.status,
            availableCarListing: newDealer.availableCarListing,
          });
        } else {
          console.log(
            `ℹ️ [WEBHOOK] Dealer record already exists for userId: ${userId}`
          );
        }
      } else if (newRole === "repair") {
        console.log(
          `🔍 [WEBHOOK] Checking for existing Repair record for userId: ${userId}`
        );
        const existingRepair = await Repair.findOne({ where: { userId } });
        if (!existingRepair) {
          console.log(`📝 [WEBHOOK] Creating new Repair record...`);
          const slug = user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
          const newRepair = await Repair.create({
            userId,
            location: user.city || null,
            status: "nonverified",
            slug: slug,
          });
          console.log(`✅ [WEBHOOK] Repair record created:`, {
            id: newRepair.id,
            userId: newRepair.userId,
            slug: newRepair.slug,
            status: newRepair.status,
          });
        } else {
          console.log(
            `ℹ️ [WEBHOOK] Repair record already exists for userId: ${userId}`
          );
        }
      } else if (newRole === "insurance") {
        console.log(
          `🔍 [WEBHOOK] Checking for existing Insurance record for userId: ${userId}`
        );
        const existingInsurance = await Insurance.findOne({
          where: { userId },
        });
        if (!existingInsurance) {
          console.log(`📝 [WEBHOOK] Creating new Insurance record...`);
          const slug = user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
          const newInsurance = await Insurance.create({
            userId,
            location: user.city || null,
            status: "nonverified",
            slug: slug,
          });
          console.log(`✅ [WEBHOOK] Insurance record created:`, {
            id: newInsurance.id,
            userId: newInsurance.userId,
            slug: newInsurance.slug,
            status: newInsurance.status,
          });
        } else {
          console.log(
            `ℹ️ [WEBHOOK] Insurance record already exists for userId: ${userId}`
          );
        }
      }

      console.log(`✅ [WEBHOOK] User role updated to '${newRole}'`);
    } else {
      console.log(
        `ℹ️ [WEBHOOK] User role unchanged (already ${user.role}) or newRole is invalid`
      );
    }

    // --- Update role-specific records after role assignment ---
    console.log(
      `🔄 [WEBHOOK] Updating role-specific records for role: ${user.role}`
    );

    if (user.role === "dealer") {
      console.log(`📝 [WEBHOOK] Updating Dealer record...`);

      // ✅ Check if dealer already exists to increment or set
      const existingDealer = await Dealer.findOne({ where: { userId } });
      let newAvailableCarListing = packageData.vehicleCount || 0;

      if (existingDealer && existingDealer.availableCarListing) {
        console.log(
          `📝 [WEBHOOK] Dealer exists with ${existingDealer.availableCarListing} available listings`
        );
        console.log(
          `📝 [WEBHOOK] Adding ${packageData.vehicleCount} from new package`
        );
        newAvailableCarListing =
          existingDealer.availableCarListing + (packageData.vehicleCount || 0);
        console.log(
          `📝 [WEBHOOK] New total availableCarListing: ${newAvailableCarListing}`
        );
      }

      const updateResult = await Dealer.update(
        {
          availableCarListing: newAvailableCarListing,
          status: "verified",
        },
        { where: { userId } }
      );
      console.log(
        `✅ [WEBHOOK] Dealer ${userId} updated - affected rows: ${updateResult[0]}`
      );
      console.log(
        `✅ [WEBHOOK] Dealer ${userId} verified with ${newAvailableCarListing} total available listings`
      );
    } else if (user.role === "repair") {
      console.log(`📝 [WEBHOOK] Updating Repair record...`);
      const updateResult = await Repair.update(
        { status: "verified" },
        { where: { userId } }
      );
      console.log(
        `✅ [WEBHOOK] Repair user ${userId} updated - affected rows: ${updateResult[0]}`
      );
      console.log(`✅ [WEBHOOK] Repair user ${userId} verified`);
    } else if (user.role === "insurance") {
      console.log(`📝 [WEBHOOK] Updating Insurance record...`);
      const updateResult = await Insurance.update(
        { status: "verified" },
        { where: { userId } }
      );
      console.log(
        `✅ [WEBHOOK] Insurance user ${userId} updated - affected rows: ${updateResult[0]}`
      );
      console.log(`✅ [WEBHOOK] Insurance user ${userId} verified`);
    }

    console.log(
      `🎉 [WEBHOOK] Checkout session completed successfully for user ${userId}`
    );
  } catch (error) {
    console.error(
      "❌ [WEBHOOK] Checkout session handling error:",
      error.message
    );
    console.error("❌ [WEBHOOK] Error details:", error);
  }
};

o.handleInvoicePaid = async (invoice) => {
  try {
    // Get the customer ID from the invoice
    const stripeCustomerId = invoice.customer;
    if (!stripeCustomerId) throw new Error("Invoice has no customer ID");

    // Find the subscription in your database using customer ID
    const existingSub = await Subscription.findOne({
      where: { stripeCustomerId },
    });

    if (!existingSub) {
      console.warn(
        `⚠️ No subscription found in DB for customer ${stripeCustomerId}`
      );
      return;
    }

    const subscriptionId = existingSub.stripeSubscriptionId;

    // Retrieve subscription details from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = stripeSub.metadata.userId || existingSub.userId;

    // Always extend from current time
    let expiryDate = new Date();
    const interval = stripeSub.plan?.interval || "month";
    const count = stripeSub.plan?.interval_count || 1;

    if (interval === "month") {
      expiryDate.setMonth(expiryDate.getMonth() + count);
    } else if (interval === "year") {
      expiryDate.setFullYear(expiryDate.getFullYear() + count);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30 * count);
    }

    // Update subscription expiry in DB
    await existingSub.update({ expiryDate, stripeCustomerId });

    console.log(
      `🔁 Subscription renewed for user ${userId}, new expiry: ${expiryDate.toISOString()}`
    );
  } catch (err) {
    console.error("❌ Error handling invoice.payment_succeeded:", err.message);
  }
};

o.handleInvoiceFailed = async (invoice) => {
  try {
    // Get subscription ID from invoice
    const customerId = invoice.customer;

    if (!customerId) {
      throw new Error("Invoice has no subscription ID");
    }

    // Log the failed payment
    console.log(`⚠️ Subscription payment failed for user, subscription`);

    // Optionally, log invoice info for debugging
    console.log("Invoice details:", {
      id: invoice.id,
      amount_due: invoice.amount_due,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
    });
  } catch (err) {
    console.error("❌ Error handling invoice.payment_failed:", err.message);
  }
};

/**
 * ✅ Handle Stripe customer.subscription.deleted webhook
 */
o.handleSubscriptionDeleted = async (subscription) => {
  try {
    const { userId } = subscription.metadata || {};
    if (!userId) return;
    await Subscription.destroy({ where: { userId } });

    return json.successResponse(res, "Subscription cancelled", 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.cancelSubscription = async function (req, res, next) {
  try {
    const user = req.decoded;

    const subscription = await Subscription.findOne({
      where: { userId: user.id },
    });
    if (!subscription) {
      return json.errorResponse(res, "No subscription found", 404);
    }

    if (subscription.stripeSubscriptionId) {
      console.log(
        "Cancelling subscription:",
        subscription.stripeSubscriptionId
      );

      // Cancel immediately
      const cancelled = await stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId
      );

      console.log("Stripe response:", cancelled.status);

      if (cancelled.status !== "canceled") {
        return json.errorResponse(res, "Stripe cancellation failed", 400);
      }
    }

    await subscription.destroy();

    return json.successResponse(
      res,
      "Subscription cancelled successfully",
      200
    );
  } catch (error) {
    console.error("Stripe cancellation error:", error);
    return json.errorResponse(res, error.message, 400);
  }
};

o.getUserSubscription = async function (req, res, next) {
  try {
    const userId = req.decoded.id;

    const subscription = await Subscription.findOne({
      where: { userId },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!subscription) {
      return json.errorResponse(res, "Subscription Not Found", 404);
    }

    return json.showOne(res, subscription, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllSubscriptions = async function (req, res, next) {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const { Op } = require("sequelize");

    // Validate and convert to integers
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const offset = (pageNum - 1) * limitNum;

    const searchWhere = search
      ? {
          fullname: {
            [Op.iLike]: `%${search}%`,
          },
        }
      : {};

    const { count, rows } = await Subscription.findAndCountAll({
      include: [
        {
          model: User,
          as: "user",
          where: searchWhere,
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    // Calculate statistics using raw query - ALWAYS get total stats (not affected by search)
    let statsQuery = `
      SELECT 
        COALESCE(SUM(CAST(REPLACE("Subscriptions"."price", '$', '') AS DECIMAL)), 0)::DECIMAL as "totalRevenue",
        COALESCE(AVG(CAST(REPLACE("Subscriptions"."price", '$', '') AS DECIMAL)), 0)::DECIMAL as "averageOrderValue",
        COUNT("Subscriptions"."id") as "totalOrders"
      FROM "Subscriptions"
    `;

    const stats = await Subscription.sequelize.query(statsQuery, {
      type: require("sequelize").QueryTypes.SELECT,
    });

    const totalPages = Math.ceil(count / limitNum);

    const response = {
      data: rows,
      pagination: {
        total: count,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
      stats: {
        totalRevenue: parseFloat(stats[0]?.totalRevenue) || 0,
        averageOrderValue: parseFloat(stats[0]?.averageOrderValue) || 0,
        totalOrders: parseInt(stats[0]?.totalOrders) || 0,
      },
    };

    json.showOne(res, response, 200);
  } catch (error) {
    console.error("Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.checkActiveSubscription = async function (req, res, next) {
  try {
    const userId = req.decoded.id;

    if (!userId) {
      throw new Error("userId is required");
    }

    const subscription = await Subscription.findOne({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: db.User,
          as: "user",
        },
      ],
    });

    if (!subscription) {
      return json.errorResponse(res, "No subscription found", 404);
    }

    // Check if subscription is still active
    const isActive = new Date(subscription.expiryDate) > new Date();

    const response = {
      subscription,
      isActive,
      status: isActive ? "ACTIVE" : "EXPIRED",
    };

    return json.showOne(res, response, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
