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
const Detailer = db.Detailer;
const Repair = db.Repair;
const Insurance = db.Insurance;
const Wallet = db.Wallet;
const createAndEmitNotification = require("../../../Traits/CreateAndEmitNotification");

const o = {};

o.createCheckoutSession = async function (req, res, next) {
  try {
    const { id: userId, role } = req.decoded;
    const { id } = req.params;

    // ✅ Validate inputs
    if (!userId) {
      return json.errorResponse(res, "User ID is required", 400);
    }

    if (!id) {
      return json.errorResponse(res, "Package ID is required", 400);
    }

    console.log(
      `🔍 [CHECKOUT] Starting checkout for userId: ${userId}, packageId: ${id}`
    );

    // --- Fetch package details ---
    console.log(`🔍 [CHECKOUT] Fetching package: ${id}`);
    const plan = await Package.findByPk(id);

    if (!plan) {
      console.error(`❌ [CHECKOUT] Package not found: ${id}`);
      return json.errorResponse(res, "Package not found", 404);
    }

    console.log(`✅ [CHECKOUT] Package found:`, {
      id: plan.id,
      package: plan.package,
      stripeProductId: plan.stripeProductId,
    });

    // --- Fetch Stripe product and price ---
    const productId = plan.stripeProductId;

    if (!productId) {
      console.error(`❌ [CHECKOUT] No Stripe product ID for package: ${id}`);
      return json.errorResponse(res, "No Stripe product configured", 400);
    }

    console.log(`🔍 [CHECKOUT] Retrieving Stripe product: ${productId}`);
    const product = await stripe.products.retrieve(productId);
    console.log(`✅ [CHECKOUT] Stripe product retrieved:`, {
      id: product.id,
      name: product.name,
    });

    console.log(`🔍 [CHECKOUT] Fetching prices for product: ${productId}`);
    const priceList = await stripe.prices.list({
      product: productId,
      active: true,
    });

    if (!priceList.data || priceList.data.length === 0) {
      console.error(
        `❌ [CHECKOUT] No active prices found for product: ${productId}`
      );
      return json.errorResponse(res, "No price found for product", 400);
    }

    const priceId = priceList.data[0].id;
    const amount = priceList.data[0].unit_amount / 100; // Convert from cents to dollars
    console.log(`✅ [CHECKOUT] Price found:`, {
      priceId,
      amount: `$${amount}`,
      currency: priceList.data[0].currency,
    });

    // --- Fetch user details ---
    console.log(`🔍 [CHECKOUT] Fetching user: ${userId}`);
    const user = await User.findByPk(userId);

    if (!user) {
      console.error(`❌ [CHECKOUT] User not found: ${userId}`);
      return json.errorResponse(res, "User not found", 404);
    }

    console.log(`✅ [CHECKOUT] User found:`, {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
    });

    // --- Check if user already has a Stripe customer ---
    console.log(
      `🔍 [CHECKOUT] Checking for existing Stripe customer for userId: ${userId}`
    );
    let customerId;

    // Option 1: Check if user has stripeCustomerId stored in database (if you have this field)
    // If you don't have this field, skip this step
    if (user.stripeCustomerId) {
      console.log(
        `✅ [CHECKOUT] Found existing Stripe customer: ${user.stripeCustomerId}`
      );
      customerId = user.stripeCustomerId;
    } else {
      // Option 2: Create new Stripe customer
      console.log(`📝 [CHECKOUT] Creating new Stripe customer...`);
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullname || "Unknown User",
        metadata: {
          userId: String(userId),
        },
      });

      customerId = customer.id;
      console.log(`✅ [CHECKOUT] New Stripe customer created:`, {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      });

      // ✅ (Optional) Store stripeCustomerId in user record for future use
      // Uncomment if your User model has a stripeCustomerId field
      /*
      user.stripeCustomerId = customerId;
      await user.save();
      console.log(`✅ [CHECKOUT] User updated with stripeCustomerId: ${customerId}`);
      */
    }

    // --- Create Checkout Session ---
    console.log(`📝 [CHECKOUT] Creating Stripe checkout session...`);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_SUCCESS_URL || "https://carmate-nextjs.vercel.app"}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_CANCEL_URL || "https://carmate-nextjs.vercel.app"}`,
      // ✅ Store metadata on checkout session (NOW INCLUDES PACKAGE ID)
      metadata: {
        userId: String(userId),
        packageId: String(id),
        userName: user.fullname,
        userEmail: user.email,
      },
      // ✅ IMPORTANT: Store metadata on subscription so it persists to invoice webhooks (NOW INCLUDES PACKAGE ID)
      subscription_data: {
        metadata: {
          userId: String(userId),
          packageId: String(id),
          userName: user.fullname,
          userEmail: user.email,
        },
      },
      client_reference_id: String(userId),
    });

    console.log(`✅ [CHECKOUT] Checkout session created:`, {
      id: session.id,
      url: session.url,
      customer: session.customer,
      subscription: session.subscription,
    });

    console.log(
      `🎉 [CHECKOUT] Checkout session completed successfully for userId: ${userId}`
    );

    return json.showOne(
      res,
      {
        checkoutUrl: session.url,
        sessionId: session.id,
        customerId: customerId,
      },
      200
    );
  } catch (error) {
    console.error("❌ Stripe Subscription Error:", error);
    console.error("❌ Error Message:", error.message);
    console.error("❌ Error Details:", error);

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

    let userId, packageId;
    let stripeSub;
    let subscriptionId;

    // ✅ Detect object type and extract metadata accordingly
    if (session.object === "invoice") {
      console.log("📌 [WEBHOOK] Processing Invoice object");

      // For invoices, subscription ID is in parent.subscription_details.subscription
      subscriptionId = session.parent?.subscription_details?.subscription;

      if (!subscriptionId) {
        console.error(
          "❌ [WEBHOOK] No subscription ID found in invoice parent"
        );
        throw new Error("No subscription ID found in invoice");
      }

      console.log(
        `🔍 [WEBHOOK] Retrieved subscription ID from invoice: ${subscriptionId}`
      );

      // Retrieve the subscription from the invoice
      stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      console.log("🔍 [WEBHOOK] Retrieved subscription from invoice");

      // Get metadata from subscription
      ({ userId, packageId } = stripeSub.metadata || {});
      console.log(
        `📍 [WEBHOOK] Extracted metadata from subscription - userId: ${userId}, packageId: ${packageId}`
      );
    } else if (session.object === "checkout.session") {
      console.log("📌 [WEBHOOK] Processing Checkout Session object");

      // For checkout sessions, subscription ID is directly in session
      subscriptionId = session.subscription;

      if (!subscriptionId) {
        console.error(
          "❌ [WEBHOOK] No subscription ID found in checkout session"
        );
        throw new Error("No subscription ID found in checkout session");
      }

      console.log(
        `🔍 [WEBHOOK] Retrieved subscription ID from checkout session: ${subscriptionId}`
      );

      // Get metadata directly from checkout session
      ({ userId, packageId } = session.metadata || {});
      console.log(
        `📍 [WEBHOOK] Extracted metadata from checkout session - userId: ${userId}, packageId: ${packageId}`
      );

      // Retrieve subscription for Stripe details
      stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      console.log("🔍 [WEBHOOK] Retrieved subscription from checkout session");
    } else {
      console.error(`❌ [WEBHOOK] Unknown object type: ${session.object}`);
      throw new Error(`Unknown webhook object type: ${session.object}`);
    }

    // ✅ Convert userId and packageId to integers
    userId = parseInt(userId, 10);
    packageId = parseInt(packageId, 10);

    console.log(
      `📍 [WEBHOOK] Final extracted metadata - userId: ${userId}, packageId: ${packageId}`
    );

    if (!userId || !packageId || isNaN(userId) || isNaN(packageId)) {
      console.error("❌ [WEBHOOK] Missing userId or packageId in metadata");
      throw new Error(`Missing userId (${userId}) or packageId (${packageId})`);
    }

    console.log(
      `✅ [WEBHOOK] Metadata validation passed - userId: ${userId}, packageId: ${packageId}`
    );

    // --- Retrieve package using packageId (NOT plan name) ---
    console.log(`🔍 [WEBHOOK] Retrieving package with ID: ${packageId}...`);
    const packageData = await Package.findByPk(packageId);
    if (!packageData) {
      console.error(`❌ [WEBHOOK] Package ${packageId} not found`);
      throw new Error("Package not found");
    }
    console.log(`✅ [WEBHOOK] Package found:`, {
      id: packageData.id,
      package: packageData.package,
      packageCategory: packageData.packageCategory,
      vehicleCount: packageData.vehicleCount,
    });

    // --- Retrieve Stripe subscription details ---
    console.log(`🔄 [WEBHOOK] Using Stripe subscription: ${stripeSub.id}`);
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

    // Extract price from subscription items
    const price = stripeSub.items.data[0]?.price?.unit_amount / 100 || 0;
    console.log(`💰 [WEBHOOK] Price: $${price}`);

    // --- ALWAYS CREATE NEW SUBSCRIPTION ---
    console.log(
      `📝 [WEBHOOK] Creating new subscription for userId: ${userId}...`
    );

    const subscriptionData = {
      userId: parseInt(userId, 10),
      packageId: parseInt(packageId, 10),
      plan: String(packageData.package).trim(),
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
        packageId: newSub.packageId,
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

    // --- Retrieve user ---
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

    // Emit notification to all admins
    try {
      const admins = await User.findAll({ where: { role: "admin" } });

      const io = global.io || null; // Use global.io if available
      for (const admin of admins) {
        await createAndEmitNotification(
          {
            senderId: user.id,
            receiverId: admin.id,
            type: "admin_alert",
            content: `${user.fullname} bought the subscription ${packageData.package}`,
          },
          io
        );
      }
      console.log(`✅ [WEBHOOK] Notifications sent to all admins.`);
    } catch (notifErr) {
      console.error(
        "❌ [WEBHOOK] Error sending notifications to admins:",
        notifErr
      );
    }

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
        }  else {
          console.log(
            `ℹ️ [WEBHOOK] Repair record already exists for userId: ${userId}`
          );
        }
      } else if (newRole === "detailer") {
        console.log(
          `🔍 [WEBHOOK] Checking for existing Detailer record for userId: ${userId}`
        );
        const existingDetailer = await Detailer.findOne({ where: { userId } });
        if (!existingDetailer) {
          console.log(`📝 [WEBHOOK] Creating new Detailer record...`);
          const slug = user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
          const newDetailer = await Detailer.create({
            userId,
            location: user.city || null,
            status: "nonverified",
            slug: slug,
          });
          console.log(`✅ [WEBHOOK] Detailer record created:`, {
            id: newDetailer.id,
            userId: newDetailer.userId,
            slug: newDetailer.slug,
            status: newDetailer.status,
          });
        }  else {
          console.log(
            `ℹ️ [WEBHOOK] Detailer record already exists for userId: ${userId}`
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

      // 🔹🔹🔹 WALLET INITIALIZATION FOR DEALER 🔹🔹🔹
      console.log(`🏦 [WEBHOOK] Initializing wallet for dealer ${userId}...`);
      try {
        const existingWallet = await Wallet.findOne({ where: { userId } });
        if (!existingWallet) {
          console.log(`📝 [WEBHOOK] Creating new Wallet record for dealer...`);
          const newWallet = await Wallet.create({
            userId: parseInt(userId, 10),
            totalBalance: 0,
            spentBalance: 0,
            remainingBalance: 0,
            transactions: [],
          });
          console.log(`✅ [WEBHOOK] Wallet initialized for dealer ${userId}:`, {
            id: newWallet.id,
            userId: newWallet.userId,
            totalBalance: newWallet.totalBalance,
            spentBalance: newWallet.spentBalance,
            remainingBalance: newWallet.remainingBalance,
            transactions: newWallet.transactions,
          });
        } else {
          console.log(
            `ℹ️ [WEBHOOK] Wallet already exists for dealer ${userId}`
          );
        }
      } catch (walletErr) {
        console.error(
          `❌ [WEBHOOK] Error initializing wallet for dealer ${userId}:`,
          walletErr.message
        );
        // Don't throw - wallet initialization failure shouldn't break the entire flow
      }
      // 🔹🔹🔹 END WALLET INITIALIZATION 🔹🔹🔹
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
    } else if (user.role === "detailer") {
      console.log(`📝 [WEBHOOK] Updating Detailer record...`);
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
      `🎉 [WEBHOOK] Webhook processing completed successfully for user ${userId}`
    );
  } catch (error) {
    console.error("❌ [WEBHOOK] Webhook processing error:", error.message);
    console.error("❌ [WEBHOOK] Error details:", error);
    // Re-throw to prevent false success responses
    throw error;
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

    // Delete subscription
    await subscription.destroy();

    // Update user role from dealer to user
    await User.update({ role: "user" }, { where: { id: user.id } });

    // Delete dealer record where dealerId is userId
    await Dealer.destroy({
      where: { userId: user.id },
    });

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
