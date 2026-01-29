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
const PaymentLog = db.PaymentLog;
const createAndEmitNotification = require("../../../Traits/CreateAndEmitNotification");

const o = {};

/**
 * Helper function to log payment attempts
 */
const logPaymentAttempt = async (data) => {
  try {
    await PaymentLog.create({
      userId: data.userId,
      subscriptionId: data.subscriptionId || null,
      stripePaymentIntentId: data.stripePaymentIntentId || null,
      stripeInvoiceId: data.stripeInvoiceId || null,
      stripeCustomerId: data.stripeCustomerId,
      amount: data.amount,
      currency: data.currency || "usd",
      status: data.status,
      paymentMethod: data.paymentMethod || null,
      failureReason: data.failureReason || null,
      attemptCount: data.attemptCount || 1,
      metadata: data.metadata || {}
    });
    console.log(`✅ [PAYMENT LOG] Payment attempt logged for user ${data.userId}`);
  } catch (error) {
    console.error(`❌ [PAYMENT LOG] Failed to log payment attempt:`, error);
  }
};

/**
 * Helper function to extract and store card details from Stripe
 */
const storeCardDetails = async (subscription, stripeSubscription) => {
  try {
    // Get the default payment method from the subscription
    let paymentMethodId = stripeSubscription.default_payment_method;
    
    if (!paymentMethodId && stripeSubscription.latest_invoice) {
      // Try to get payment method from latest invoice
      const invoice = await stripe.invoices.retrieve(stripeSubscription.latest_invoice);
      paymentMethodId = invoice.default_payment_method || invoice.payment_intent?.payment_method;
    }

    if (paymentMethodId) {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (paymentMethod && paymentMethod.card) {
        await subscription.update({
          paymentMethodId: paymentMethodId,
          cardLast4: paymentMethod.card.last4,
          cardBrand: paymentMethod.card.brand,
          cardExpMonth: paymentMethod.card.exp_month,
          cardExpYear: paymentMethod.card.exp_year,
          cardHolderName: paymentMethod.billing_details?.name || null,
        });
        
        console.log(`✅ [CARD DETAILS] Stored card details for subscription ${subscription.id}`);
      }
    }
  } catch (error) {
    console.error(`❌ [CARD DETAILS] Failed to store card details:`, error);
  }
};

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

      // ✅ Store stripeCustomerId in user record for future use
      await user.update({ stripeCustomerId: customerId });
      console.log(`✅ [CHECKOUT] Stored customer ID in user record`);
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

    // ✅ Handle checkout.session object only (this is the initial subscription creation)
    if (session.object === "checkout.session") {
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
      console.error(`❌ [WEBHOOK] Unexpected object type in checkout handler: ${session.object}`);
      throw new Error(`Unexpected webhook object type in checkout handler: ${session.object}`);
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

    // --- CHECK FOR EXISTING SUBSCRIPTION AND UPDATE OR CREATE ---
    console.log(`🔍 [WEBHOOK] Checking for existing subscription for userId: ${userId}...`);
    
    const existingSubscription = await Subscription.findOne({
      where: { userId: parseInt(userId, 10) },
      order: [['createdAt', 'DESC']] // Get the most recent subscription
    });

    let subscription;

    if (existingSubscription) {
      console.log(`📝 [WEBHOOK] Found existing subscription (ID: ${existingSubscription.id}), updating...`);
      console.log(`📝 [WEBHOOK] Old data:`, {
        id: existingSubscription.id,
        plan: existingSubscription.plan,
        price: existingSubscription.price,
        expiryDate: existingSubscription.expiryDate?.toISOString?.(),
        stripeSubscriptionId: existingSubscription.stripeSubscriptionId,
        stripeCustomerId: existingSubscription.stripeCustomerId,
      });

      // Update existing subscription
      const updateData = {
        packageId: parseInt(packageId, 10),
        plan: String(packageData.package).trim(),
        price: `${price}`,
        expiryDate: expiryDate instanceof Date ? expiryDate : new Date(expiryDate),
        stripeSubscriptionId: String(stripeSub.id).trim(),
        stripeCustomerId: String(stripeSub.customer).trim(),
        status: "active",
        isActive: true,
      };

      console.log(`📝 [WEBHOOK] Update data:`, updateData);

      try {
        await existingSubscription.update(updateData, {
          logging: (sql) => console.log(`📝 [SQL]: ${sql}`),
        });

        subscription = existingSubscription;
        console.log(`✅ [WEBHOOK] Subscription updated successfully:`, {
          id: subscription.id,
          userId: subscription.userId,
          packageId: packageId,
          plan: subscription.plan,
          price: subscription.price,
          expiryDate: subscription.expiryDate?.toISOString?.(),
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          stripeCustomerId: subscription.stripeCustomerId,
        });

      } catch (updateErr) {
        console.error("❌ [WEBHOOK] Subscription update failed");
        console.error("❌ Error message:", updateErr.message);
        if (updateErr.errors) {
          console.error("❌ Validation errors:", updateErr.errors);
        }
        console.error("❌ Full error:", updateErr);
        throw updateErr;
      }

    } else {
      console.log(`📝 [WEBHOOK] No existing subscription found, creating new one...`);

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
        subscription = await Subscription.create(subscriptionData, {
        validate: false,
        logging: (sql) => console.log(`📝 [SQL]: ${sql}`),
      });

        console.log(`✅ [WEBHOOK] New subscription created:`, {
          id: subscription.id,
          userId: subscription.userId,
          packageId: subscription.packageId,
          plan: subscription.plan,
          price: subscription.price,
          expiryDate: subscription.expiryDate?.toISOString?.(),
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          stripeCustomerId: subscription.stripeCustomerId,
        });

      // Store card details from Stripe
      await storeCardDetails(subscription, stripeSub);

      // Log successful payment
      await logPaymentAttempt({
        userId: parseInt(userId, 10),
        subscriptionId: subscription.id,
        stripeInvoiceId: session.object === "invoice" ? session.id : null,
        stripeCustomerId: stripeSub.customer,
        amount: price,
        currency: stripeSub.items.data[0]?.price?.currency || "usd",
        status: "succeeded",
        paymentMethod: stripeSub.default_payment_method,
        metadata: {
          type: "subscription_creation",
          packageId: packageId,
          webhookType: session.object
        }
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

    // Store card details from Stripe
    await storeCardDetails(subscription, stripeSub);

    // Log successful payment
    await logPaymentAttempt({
      userId: parseInt(userId, 10),
      subscriptionId: subscription.id,
      stripeInvoiceId: session.object === "invoice" ? session.id : null,
      stripeCustomerId: stripeSub.customer,
      amount: price,
      currency: stripeSub.items.data[0]?.price?.currency || "usd",
      status: "succeeded",
      paymentMethod: stripeSub.default_payment_method,
      metadata: {
        type: existingSubscription ? "subscription_update" : "subscription_creation",
        packageId: packageId,
        webhookType: session.object
      }
    });
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
      const updateResult = await Detailer.update(
        { status: "verified" },
        { where: { userId } }
      );
      console.log(
        `✅ [WEBHOOK] Detailer user ${userId} updated - affected rows: ${updateResult[0]}`
      );
      console.log(`✅ [WEBHOOK] Detailer user ${userId} verified`);
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
    console.log("💳 [INVOICE] Processing invoice payment:", invoice.id);
    console.log("💳 [INVOICE] Invoice details:", {
      id: invoice.id,
      customer: invoice.customer,
      subscription: invoice.subscription,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status
    });
    
    // Get the customer ID from the invoice
    const stripeCustomerId = invoice.customer;
    if (!stripeCustomerId) throw new Error("Invoice has no customer ID");

    console.log(`🔍 [INVOICE] Customer ID: ${stripeCustomerId}`);

    // Get subscription ID from invoice
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      console.log("⚠️ [INVOICE] No subscription ID in invoice - processing as one-time payment");
      await o.handleOneTimePayment(invoice, stripeCustomerId);
      return;
    }

    console.log(`🔍 [INVOICE] Subscription ID: ${subscriptionId}`);

    // Check if we have existing subscription in our database first
    const existingSub = await Subscription.findOne({
      where: { stripeSubscriptionId: subscriptionId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "fullname", "role"]
        }
      ]
    });

    if (existingSub) {
      console.log("🔄 [INVOICE] Found existing subscription - processing renewal");
      console.log(`📍 [INVOICE] Existing subscription details:`, {
        id: existingSub.id,
        userId: existingSub.userId,
        plan: existingSub.plan,
        status: existingSub.status
      });
      
      // Process renewal using existing subscription data
      await o.renewExistingSubscription(existingSub, invoice);
      return;
    }

    // If no existing subscription, retrieve from Stripe and check metadata
    console.log("🔍 [INVOICE] No existing subscription found - retrieving from Stripe");
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    console.log(`✅ [INVOICE] Retrieved Stripe subscription: ${stripeSub.id}`);

    // Get metadata from subscription
    const { userId, packageId } = stripeSub.metadata || {};
    console.log(`📍 [INVOICE] Stripe metadata - userId: ${userId}, packageId: ${packageId}`);

    if (!userId) {
      // Try to find user by customer ID as fallback
      console.log("⚠️ [INVOICE] No userId in metadata, trying to find user by customer ID");
      const user = await User.findOne({
        where: { stripeCustomerId: stripeCustomerId }
      });
      
      if (!user) {
        console.error("❌ [INVOICE] Cannot find user by customer ID or metadata");
        await o.logFailedPayment(invoice, "User not found");
        return;
      }
      
      console.log(`✅ [INVOICE] Found user by customer ID: ${user.id}`);
      await o.createSubscriptionFromInvoice(invoice, stripeSub, user.id, packageId);
    } else {
      console.log("🆕 [INVOICE] First payment - creating new subscription");
      await o.createSubscriptionFromInvoice(invoice, stripeSub, parseInt(userId, 10), packageId ? parseInt(packageId, 10) : null);
    }

    console.log(`✅ [INVOICE] Successfully processed invoice payment`);
  } catch (err) {
    console.error("❌ [INVOICE] Error handling invoice.payment_succeeded:", err.message);
    console.error("❌ [INVOICE] Full error:", err);
    
    // Log the failed payment attempt
    try {
      await o.logFailedPayment(invoice, err.message);
    } catch (logErr) {
      console.error("❌ [INVOICE] Failed to log payment error:", logErr.message);
    }
  }
};

// New method to create subscription from invoice (first payment)
o.createSubscriptionFromInvoice = async (invoice, stripeSub, userId, packageId) => {
  try {
    console.log(`📝 [INVOICE-CREATE] Creating subscription for userId: ${userId}, packageId: ${packageId}`);

    // Validate inputs
    if (!userId || isNaN(userId)) {
      console.error("❌ [INVOICE-CREATE] Invalid userId");
      throw new Error(`Invalid userId: ${userId}`);
    }

    // If packageId is missing, try to determine from subscription or use default
    let packageData = null;
    if (packageId && !isNaN(packageId)) {
      console.log(`🔍 [INVOICE-CREATE] Retrieving package with ID: ${packageId}...`);
      packageData = await Package.findByPk(packageId);
    }
    
    if (!packageData) {
      console.log(`⚠️ [INVOICE-CREATE] Package ${packageId} not found, trying to find by Stripe product`);
      
      // Try to find package by Stripe product ID
      const productId = stripeSub.items?.data?.[0]?.price?.product;
      if (productId) {
        packageData = await Package.findOne({
          where: { stripeProductId: productId }
        });
        console.log(`🔍 [INVOICE-CREATE] Found package by product ID: ${packageData?.id}`);
      }
    }
    
    if (!packageData) {
      console.log(`⚠️ [INVOICE-CREATE] No package found, using default values`);
      packageData = {
        id: null,
        package: "Unknown Plan",
        packageCategory: "dealer",
        vehicleCount: 0
      };
    } else {
      console.log(`✅ [INVOICE-CREATE] Package found:`, {
        id: packageData.id,
        package: packageData.package,
        packageCategory: packageData.packageCategory,
        vehicleCount: packageData.vehicleCount,
      });
    }

    // Compute expiry date
    let expiryDate;
    console.log(`🕐 [INVOICE-CREATE] Computing expiry date...`);
    if (stripeSub.current_period_end) {
      expiryDate = new Date(stripeSub.current_period_end * 1000);
      console.log(`📅 [INVOICE-CREATE] Using current_period_end: ${expiryDate.toISOString()}`);
    } else {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      console.log(`📅 [INVOICE-CREATE] Default fallback (now + 1 month): ${expiryDate.toISOString()}`);
    }

    if (isNaN(expiryDate.getTime())) {
      console.error("❌ [INVOICE-CREATE] Invalid expiryDate:", expiryDate);
      throw new Error("Invalid expiryDate value");
    }
    console.log(`✅ [INVOICE-CREATE] Final expiryDate: ${expiryDate.toISOString()}`);

    // Extract price from invoice
    const price = (invoice.amount_paid / 100) || 0;
    console.log(`💰 [INVOICE-CREATE] Price: ${price}`);

    // Create new subscription
    console.log(`📝 [INVOICE-CREATE] Creating new subscription for userId: ${userId}...`);

    const subscriptionData = {
      userId: parseInt(userId, 10),
      plan: String(packageData.package).trim(),
      price: `$${price}`,
      expiryDate: expiryDate instanceof Date ? expiryDate : new Date(expiryDate),
      stripeSubscriptionId: String(stripeSub.id).trim(),
      stripeCustomerId: String(stripeSub.customer).trim(),
      status: "active",
      isActive: true,
    };

    console.log(`📝 [INVOICE-CREATE] Subscription data:`, subscriptionData);

    const newSub = await Subscription.create(subscriptionData, {
      validate: false,
      logging: (sql) => console.log(`📝 [SQL]: ${sql}`),
    });

    console.log(`✅ [INVOICE-CREATE] New subscription created:`, {
      id: newSub.id,
      userId: newSub.userId,
      plan: newSub.plan,
      expiryDate: newSub.expiryDate,
      stripeSubscriptionId: newSub.stripeSubscriptionId,
    });

    // Store card details
    await o.storeCardDetails(newSub, stripeSub);

    // Log successful payment
    await o.logPaymentAttempt({
      userId: parseInt(userId, 10),
      subscriptionId: newSub.id,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: stripeSub.customer,
      amount: price.toString(),
      currency: invoice.currency || "cad",
      status: "succeeded",
      paymentMethod: stripeSub.default_payment_method,
      metadata: {
        type: "subscription_creation_from_invoice",
        packageId: packageData.id,
        invoiceId: invoice.id
      }
    });

    // Update user role and create role-specific records if package data is available
    if (packageData.id) {
      await o.updateUserRoleAndRecords(userId, packageData);
    }

    console.log(`✅ [INVOICE-CREATE] Subscription creation completed for user ${userId}`);
    
  } catch (error) {
    console.error("❌ [INVOICE-CREATE] Error creating subscription from invoice:", error);
    throw error;
  }
};

// Helper method to log payment attempts
o.logPaymentAttempt = async (paymentData) => {
  try {
    const {
      userId,
      subscriptionId,
      stripeInvoiceId,
      stripeCustomerId,
      amount,
      currency = "cad",
      status,
      paymentMethod,
      failureReason,
      metadata = {}
    } = paymentData;

    console.log(`📝 [PAYMENT-LOG] Logging payment attempt:`, {
      userId,
      subscriptionId,
      stripeInvoiceId,
      amount,
      status
    });

    const paymentLog = await PaymentLog.create({
      userId: userId || null,
      subscriptionId: subscriptionId || null,
      stripePaymentIntentId: stripeInvoiceId, // Using invoice ID as payment intent
      stripeChargeId: stripeInvoiceId, // Using invoice ID as charge ID
      amount: parseFloat(amount) || 0,
      currency: currency.toUpperCase(),
      status: status,
      paymentMethod: paymentMethod || null,
      failureReason: failureReason || null,
      attemptCount: 1,
      metadata: {
        stripeCustomerId,
        stripeInvoiceId,
        ...metadata
      }
    });

    console.log(`✅ [PAYMENT-LOG] Payment logged with ID: ${paymentLog.id}`);
    return paymentLog;
    
  } catch (error) {
    console.error("❌ [PAYMENT-LOG] Error logging payment:", error);
    throw error;
  }
};

// Helper method to store card details
o.storeCardDetails = async (subscription, stripeSub) => {
  try {
    if (!stripeSub.default_payment_method) {
      console.log(`⚠️ [CARD-DETAILS] No default payment method for subscription ${stripeSub.id}`);
      return;
    }

    console.log(`🔍 [CARD-DETAILS] Retrieving payment method: ${stripeSub.default_payment_method}`);
    const paymentMethod = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method);
    
    if (paymentMethod.card) {
      await subscription.updateCardDetails({
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
        payment_method_id: paymentMethod.id,
        cardholder_name: paymentMethod.billing_details?.name,
        billing_address: paymentMethod.billing_details?.address
      });
      
      console.log(`✅ [CARD-DETAILS] Card details stored: **** **** **** ${paymentMethod.card.last4}`);
    }
    
  } catch (error) {
    console.log(`⚠️ [CARD-DETAILS] Could not store card details: ${error.message}`);
  }
};

// New method to renew existing subscription
o.renewExistingSubscription = async (existingSub, invoice) => {
  try {
    console.log(`🔄 [RENEWAL] Renewing subscription ${existingSub.id}`);
    console.log(`🔄 [RENEWAL] Current expiry: ${existingSub.expiryDate}`);

    // Get the Stripe subscription to get current period end
    const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
    
    // Calculate new expiry date based on subscription interval
    let expiryDate = new Date();
    if (stripeSub.current_period_end) {
      expiryDate = new Date(stripeSub.current_period_end * 1000);
      console.log(`📅 [RENEWAL] Using current_period_end: ${expiryDate.toISOString()}`);
    } else {
      const interval = stripeSub.plan?.interval || "month";
      const count = stripeSub.plan?.interval_count || 1;
      
      if (interval === "month") {
        expiryDate.setMonth(expiryDate.getMonth() + count);
      } else if (interval === "year") {
        expiryDate.setFullYear(expiryDate.getFullYear() + count);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Default to 1 month
      }
      console.log(`📅 [RENEWAL] Calculated expiry (${interval}): ${expiryDate.toISOString()}`);
    }

    // Update subscription
    await existingSub.update({
      expiryDate: expiryDate,
      status: "active",
      isActive: true,
      updatedAt: new Date()
    });

    console.log(`✅ [RENEWAL] Updated subscription expiry to: ${expiryDate.toISOString()}`);

    // Store card details if available
    if (stripeSub.default_payment_method) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(stripeSub.default_payment_method);
        if (paymentMethod.card) {
          await existingSub.updateCardDetails({
            last4: paymentMethod.card.last4,
            brand: paymentMethod.card.brand,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
            payment_method_id: paymentMethod.id,
            cardholder_name: paymentMethod.billing_details?.name,
            billing_address: paymentMethod.billing_details?.address
          });
          console.log(`✅ [RENEWAL] Updated card details`);
        }
      } catch (cardErr) {
        console.log(`⚠️ [RENEWAL] Could not update card details: ${cardErr.message}`);
      }
    }

    // Log successful payment
    await o.logPaymentAttempt({
      userId: existingSub.userId,
      subscriptionId: existingSub.id,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer,
      amount: (invoice.amount_paid / 100).toString(),
      currency: invoice.currency || "cad",
      status: "succeeded",
      paymentMethod: stripeSub.default_payment_method,
      metadata: {
        type: "subscription_renewal",
        invoiceId: invoice.id,
        subscriptionId: stripeSub.id
      }
    });

    console.log(`✅ [RENEWAL] Subscription renewal completed for user ${existingSub.userId}`);
    
  } catch (error) {
    console.error("❌ [RENEWAL] Error renewing subscription:", error);
    throw error;
  }
};

// New method to handle one-time payments
o.handleOneTimePayment = async (invoice, stripeCustomerId) => {
  try {
    console.log(`💰 [ONE-TIME] Processing one-time payment: ${invoice.id}`);
    
    // Find user by Stripe customer ID
    const user = await User.findOne({
      where: { stripeCustomerId: stripeCustomerId }
    });

    if (!user) {
      console.error(`❌ [ONE-TIME] User not found for customer: ${stripeCustomerId}`);
      await o.logFailedPayment(invoice, "User not found for one-time payment");
      return;
    }

    console.log(`✅ [ONE-TIME] Found user: ${user.id} (${user.email})`);

    // Log the one-time payment
    await o.logPaymentAttempt({
      userId: user.id,
      subscriptionId: null, // No subscription for one-time payments
      stripeInvoiceId: invoice.id,
      stripeCustomerId: stripeCustomerId,
      amount: (invoice.amount_paid / 100).toString(),
      currency: invoice.currency || "cad",
      status: "succeeded",
      paymentMethod: invoice.default_payment_method,
      metadata: {
        type: "one_time_payment",
        invoiceId: invoice.id,
        description: invoice.description || "One-time payment"
      }
    });

    console.log(`✅ [ONE-TIME] One-time payment logged for user ${user.id}`);
    
  } catch (error) {
    console.error("❌ [ONE-TIME] Error handling one-time payment:", error);
    throw error;
  }
};

// New method to log failed payments
o.logFailedPayment = async (invoice, reason) => {
  try {
    console.log(`❌ [FAILED-LOG] Logging failed payment: ${invoice.id}`);
    
    await o.logPaymentAttempt({
      userId: null, // May not have user ID
      subscriptionId: null,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer,
      amount: (invoice.amount_paid / 100).toString(),
      currency: invoice.currency || "cad",
      status: "failed",
      failureReason: reason,
      paymentMethod: invoice.default_payment_method,
      metadata: {
        type: "failed_payment",
        invoiceId: invoice.id,
        error: reason
      }
    });

    console.log(`✅ [FAILED-LOG] Failed payment logged`);
    
  } catch (error) {
    console.error("❌ [FAILED-LOG] Error logging failed payment:", error);
  }
};

// Extract user role update logic into separate method
o.updateUserRoleAndRecords = async (userId, packageData) => {
  try {
    console.log(`🔍 [ROLE-UPDATE] Retrieving user ${userId}...`);
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`❌ [ROLE-UPDATE] User ${userId} not found`);
      throw new Error("User not found");
    }

    const newRole = packageData.packageCategory;
    console.log(`🎯 [ROLE-UPDATE] New role from package: ${newRole}`);

    // Update user role based on package
    if (newRole && user.role !== newRole) {
      console.log(`🔄 [ROLE-UPDATE] Role change detected: ${user.role} → ${newRole}`);
      user.role = newRole;
      await user.save();
      console.log(`✅ [ROLE-UPDATE] User role updated in database`);

      // Create corresponding role-specific record if not existing
      await this.createRoleSpecificRecord(userId, newRole, user);
    }

    // Update role-specific records after role assignment
    await this.updateRoleSpecificRecords(userId, user.role, packageData);

    // Emit notification to all admins
    await this.notifyAdmins(user, packageData);

  } catch (error) {
    console.error("❌ [ROLE-UPDATE] Error updating user role:", error);
    throw error;
  }
};

// Helper method to create role-specific records
o.createRoleSpecificRecord = async (userId, newRole, user) => {
  try {
    if (newRole === "dealer") {
      const existingDealer = await Dealer.findOne({ where: { userId } });
      if (!existingDealer) {
        console.log(`📝 [ROLE-CREATE] Creating new Dealer record...`);
        const slug = user.fullname.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        await Dealer.create({
          userId,
          location: user.city || null,
          status: "nonverified",
          slug: slug,
          availableCarListing: 0,
        });
        console.log(`✅ [ROLE-CREATE] Dealer record created`);
      }
    } else if (newRole === "repair") {
      const existingRepair = await Repair.findOne({ where: { userId } });
      if (!existingRepair) {
        console.log(`📝 [ROLE-CREATE] Creating new Repair record...`);
        const slug = user.fullname.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        await Repair.create({
          userId,
          location: user.city || null,
          status: "nonverified",
          slug: slug,
        });
        console.log(`✅ [ROLE-CREATE] Repair record created`);
      }
    } else if (newRole === "detailer") {
      const existingDetailer = await Detailer.findOne({ where: { userId } });
      if (!existingDetailer) {
        console.log(`📝 [ROLE-CREATE] Creating new Detailer record...`);
        const slug = user.fullname.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        await Detailer.create({
          userId,
          location: user.city || null,
          status: "nonverified",
          slug: slug,
        });
        console.log(`✅ [ROLE-CREATE] Detailer record created`);
      }
    } else if (newRole === "insurance") {
      const existingInsurance = await Insurance.findOne({ where: { userId } });
      if (!existingInsurance) {
        console.log(`📝 [ROLE-CREATE] Creating new Insurance record...`);
        const slug = user.fullname.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        await Insurance.create({
          userId,
          location: user.city || null,
          status: "nonverified",
          slug: slug,
        });
        console.log(`✅ [ROLE-CREATE] Insurance record created`);
      }
    }
  } catch (error) {
    console.error("❌ [ROLE-CREATE] Error creating role-specific record:", error);
    throw error;
  }
};

// Helper method to update role-specific records
o.updateRoleSpecificRecords = async (userId, userRole, packageData) => {
  try {
    console.log(`🔄 [ROLE-RECORDS] Updating role-specific records for role: ${userRole}`);

    if (userRole === "dealer") {
      const existingDealer = await Dealer.findOne({ where: { userId } });
      let newAvailableCarListing = packageData.vehicleCount || 0;

      if (existingDealer && existingDealer.availableCarListing) {
        newAvailableCarListing = existingDealer.availableCarListing + (packageData.vehicleCount || 0);
      }

      await Dealer.update(
        {
          availableCarListing: newAvailableCarListing,
          status: "verified",
        },
        { where: { userId } }
      );
      console.log(`✅ [ROLE-RECORDS] Dealer verified with ${newAvailableCarListing} total available listings`);

      // Initialize wallet for dealer
      const existingWallet = await Wallet.findOne({ where: { userId } });
      if (!existingWallet) {
        await Wallet.create({
          userId: parseInt(userId, 10),
          totalBalance: 0,
          spentBalance: 0,
          remainingBalance: 0,
          transactions: [],
        });
        console.log(`✅ [ROLE-RECORDS] Wallet initialized for dealer ${userId}`);
      }
    } else if (userRole === "repair") {
      await Repair.update({ status: "verified" }, { where: { userId } });
      console.log(`✅ [ROLE-RECORDS] Repair user ${userId} verified`);
    } else if (userRole === "detailer") {
      await Detailer.update({ status: "verified" }, { where: { userId } });
      console.log(`✅ [ROLE-RECORDS] Detailer user ${userId} verified`);
    } else if (userRole === "insurance") {
      await Insurance.update({ status: "verified" }, { where: { userId } });
      console.log(`✅ [ROLE-RECORDS] Insurance user ${userId} verified`);
    }
  } catch (error) {
    console.error("❌ [ROLE-RECORDS] Error updating role-specific records:", error);
    throw error;
  }
};

// Helper method to notify admins
o.notifyAdmins = async (user, packageData) => {
  try {
    const admins = await User.findAll({ where: { role: "admin" } });
    const io = global.io || null;
    
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
    console.log(`✅ [NOTIFY] Notifications sent to all admins.`);
  } catch (error) {
    console.error("❌ [NOTIFY] Error sending notifications to admins:", error);
  }
};

o.handleInvoiceFailed = async (invoice) => {
  try {
    // Get subscription ID from invoice
    const customerId = invoice.customer;

    if (!customerId) {
      throw new Error("Invoice has no customer ID");
    }

    // Find the subscription in your database using customer ID
    const existingSub = await Subscription.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (existingSub) {
      // Update subscription status
      await existingSub.update({
        status: "past_due",
        isActive: false
      });

      // Log failed payment
      await logPaymentAttempt({
        userId: existingSub.userId,
        subscriptionId: existingSub.id,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: customerId,
        amount: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency,
        status: "failed",
        failureReason: invoice.status_transitions?.finalized_at ? "Payment failed" : "Payment attempt failed",
        attemptCount: invoice.attempt_count || 1,
        metadata: {
          type: "subscription_payment_failed",
          invoiceId: invoice.id,
          subscriptionId: existingSub.stripeSubscriptionId,
          failureCode: invoice.last_finalization_error?.code || null
        }
      });
    }

    // Log the failed payment
    console.log(`⚠️ Subscription payment failed for customer ${customerId}`);

    // Optionally, log invoice info for debugging
    console.log("Invoice details:", {
      id: invoice.id,
      amount_due: invoice.amount_due,
      status: invoice.status,
      attempt_count: invoice.attempt_count,
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
        {
          model: db.PaymentLog,
          as: "paymentLogs",
          limit: 5,
          order: [["createdAt", "DESC"]],
        }
      ],
    });

    if (!subscription) {
      return json.errorResponse(res, "No subscription found", 404);
    }

    // Check if subscription is still active
    const now = new Date();
    const expiryDate = new Date(subscription.expiryDate);
    const isActive = expiryDate > now;

    // Update subscription status if needed
    if (!isActive && subscription.status === "active") {
      await subscription.update({
        status: "expired",
        isActive: false
      });
    } else if (isActive && subscription.status !== "active") {
      await subscription.update({
        status: "active",
        isActive: true
      });
    }

    const response = {
      subscription: {
        ...subscription.toJSON(),
        cardDetails: {
          last4: subscription.cardLast4,
          brand: subscription.cardBrand,
          expMonth: subscription.cardExpMonth,
          expYear: subscription.cardExpYear,
          holderName: subscription.cardHolderName,
          paymentMethodId: subscription.paymentMethodId
        }
      },
      isActive,
      status: isActive ? "ACTIVE" : "EXPIRED",
      daysUntilExpiry: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
    };

    return json.showOne(res, response, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
