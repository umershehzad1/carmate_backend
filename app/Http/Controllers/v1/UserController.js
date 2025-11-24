"use strict";

const db = require("../../../Models/index");
const User = db.User;
const Dealer = db.Dealer;
const Repair = db.Repair;
const Insurance = db.Insurance;

const Advertisement = db.Advertisement;
const Subscription = db.Subscription;
const Wallet = db.Wallet;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const ejs = require("ejs");
const path = require("path");

let fs = require("fs");
let config = {};
config.app = require("../../../../config/app");
config.services = require("../../../../config/services");
const { JWT_EXPIRES_IN } = require("../../../../config/constants");

const json = require("../../../Traits/ApiResponser");
const email = require("../../../Traits/SendEmail");
const { username } = require("../../../../config/mail");
const { Sequelize } = require("sequelize");
const cloudinary = require("../../../Traits/Cloudinary");

/*
|--------------------------------------------------------------------------
| User Controller
|--------------------------------------------------------------------------
|
| This controller handles signup users and login for the application using
| facebook & google Oauth2. The controller uses a trait
| to conveniently provide its functionality to your applications.
|
*/

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    config.app.key,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

let o = {};

o.signup = async (req, res, next) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });

    if (user) {
      return json.errorResponse(res, "User Already Exist!", 409);
    }

    // Generate unique username from email and random string
    let baseUsername = req.body.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let usernameExists = true;
    let counter = 0;

    // Keep checking until we find a unique username
    while (usernameExists) {
      const existingUser = await User.findOne({ where: { username } });
      if (!existingUser) {
        usernameExists = false;
      } else {
        counter++;
        // Append random string or counter to make it unique
        const randomSuffix = Math.floor(Math.random() * 10000);
        username = `${baseUsername}${randomSuffix}`;
      }
    }

    let password = bcrypt.hashSync(req.body.password, 5);

    let newUser = new User({
      email: req.body.email,
      username: username,
      fullname: req.body.fullname,
      password: password,
    });

    newUser = await newUser.save();

    let newUserInfo = newUser;

    // Remove sensitive information
    delete newUserInfo.password;

    newUserInfo.token = createToken(newUser);

    json.successResponse(res, "Sign Up Successfully", 201);
  } catch (err) {
    console.error("Signup Error:", err);
    const errorMessage = err.message || err.toString() || "Signup failed";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.googleSignup = async function (req, res, next) {
  try {
    let user = await User.findOne({ where: { email: req.body.email } });

    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        email: req.body.email,
        fullname: req.body.name,
      });
      user = await user.save();
    }

    // Generate token for both new and existing users
    const token = createToken(user);

    return json.showOne(res, { user: user, token }, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.login = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { email: req.body.email },
      include: [
        {
          model: Dealer,
          as: "dealer",
          required: false,
          attributes: { exclude: ["userId"] },
        },
        {
          model: Repair,
          as: "repair",
          required: false,
        },
        {
          model: Insurance,
          as: "insurance",
          required: false,
        },
      ],
    });

    if (!user) {
      return json.errorResponse(res, "User Not found", 404);
    }

    const validUser = bcrypt.compareSync(req.body.password, user.password);
    console.log("req body", req.body);

    if (!validUser) {
      return json.errorResponse(res, "Wrong password", 401);
    }

    let newUserInfo = user.toJSON();
    // Remove sensitive information
    delete newUserInfo.password;

    const token = createToken(user);

    json.showOne(res, { user: newUserInfo, token }, 200);
  } catch (err) {
    console.error("Login Error:", err);
    const errorMessage = err.message || err.toString() || "Login failed";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.me = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.decoded.id },
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dealer,
          as: "dealer",
          required: false, // LEFT JOIN - returns user even if no dealer record
          attributes: { exclude: ["userId"] },
        },
        {
          model: Repair,
          as: "repair",
          required: false,
        },
        {
          model: Insurance,
          as: "insurance",
          required: false,
        },
        {
          model: Wallet,
          as: "wallet",
          required: false,
        },
        {
          model: Subscription,
          as: "subscription",
          required: false,
        },
      ],
    });

    if (!user) {
      return json.notFound(res, "User not found");
    }

    // Log for debugging
    console.log("User data:", JSON.stringify(user, null, 2));

    return json.showOne(res, user);
  } catch (err) {
    console.error("Get User Error:", err);
    console.error("Error details:", err.message);
    const errorMessage = err.message || err.toString() || "Failed to fetch user";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.edit = async (req, res, next) => {
  try {
    // Build the properties object dynamically
    const properties = {};
    if (req.body.fullname) properties.fullname = req.body.fullname;
    if (req.body.phone) properties.phone = req.body.phone;
    if (req.body.username) properties.username = req.body.username;
    if (req.body.email) properties.email = req.body.email;

    // Handle image upload to Cloudinary using buffer
    if (req.file && req.file.buffer) {
      try {
        const result = await cloudinary.uploader.upload(
          `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
          {
            resource_type: "image",
            folder: "user",
          }
        );
        properties.image = result.secure_url;
      } catch (error) {
        return json.errorResponse(
          res,
          "Image upload failed: " + (error.message || error)
        );
      }
    }

    // Find the user first
    const user = await User.findByPk(req.decoded.id);
    if (!user) return json.errorResponse(res, "User not found");

    // Update user
    await user.update(properties);

    json.showOne(res, user);
  } catch (err) {
    console.error("Edit User Error:", err);
    const errorMessage = err.message || err.toString() || "Failed to update user";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.forgetPassword = async (req, res, next) => {
  try {
    console.log("body", req.body);

    const user = await User.findOne({ where: { email: req.body.email } });

    if (!user) {
      return json.errorResponse(res, "Email Not Found", 404);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    user.resetPasswordCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    await user.save();

    const html = await ejs.renderFile(
      path.join(
        __dirname,
        "../../../../resources/views/emails/forgot-password-email.ejs"
      ),
      { resetPasswordCode: user.resetPasswordCode }
    );

    email.send(user.email, "Forget Password?", html);

    json.showOne(res, "Otp Sent to your email.", 200);
  } catch (err) {
    console.error("Forget Password Error:", err);
    const errorMessage = err.message || err.toString() || "Failed to send OTP";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.updatePassword = async function (req, res, next) {
  try {
    const { password } = req.body;

    const user = await User.findByPk(req.decoded.id);
    if (!user) return json.errorResponse(res, "User not found");

    user.password = bcrypt.hashSync(password, 5);
    await user.save();

    json.successResponse(res, "Password Updated Successfully", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};
o.verifyResetPasswordCode = async function (req, res, next) {
  try {
    const { email, code } = req.body;

    // Validate required fields
    if (!email || !code) {
      return json.errorResponse(res, "Email and code are required", 400);
    }

    // Find user by email and reset password code
    const user = await User.findOne({
      where: {
        email: email,
        resetPasswordCode: code,
      },
    });

    if (!user) {
      return json.errorResponse(res, "Invalid code!", 404);
    }

    // Check if code has expired
    const isExpired = user.resetPasswordExpires <= new Date();
    if (isExpired) {
      return json.errorResponse(res, "The code has been expired!", 410);
    }

    user.resetPasswordCode = null;
    await user.save();
    // Code is valid
    json.showOne(
      res,
      {
        success: true,
        message: "Reset password code verified successfully.",
      },
      200
    );
  } catch (err) {
    console.error("Verify Reset Password Code Error:", err);
    const errorMessage = err.message || err.toString() || "Verification failed";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.resetPassword = async function (req, res, next) {
  try {
    let success = false;

    let user = await User.findOne({
      where: {
        email: req.body.email,
      },
    });
    console.log(user);

    // Fix: Check if user exists (not email)
    if (user) {
      user.password = bcrypt.hashSync(req.body.password, 5);
      await user.save();
      success = true;
    }

    json.showOne(
      res,
      {
        success: success,
        message: success
          ? "Password reset successfully."
          : "User not found with this email.",
      },
      success ? 200 : 404
    );
  } catch (err) {
    console.error("Reset Password Error:", err);
    const errorMessage = err.message || err.toString() || "Password reset failed";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.getAllUsers = async function (req, res, next) {
  try {
    const users = await User.findAll();
    json.showAll(res, users, 200);
  } catch (error) {
    console.error("Get All Users Error:", error);
    const errorMessage = error.message || error.toString() || "Failed to fetch users";
    return json.errorResponse(res, errorMessage, 500);
  }
};

o.updateRole = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    console.log(req.body);
    console.log("Role", role);

    // Step 1: Find user
    const user = await User.findByPk(id);
    if (!user) {
      return json.errorResponse(res, "User not found", 404);
    }

    // Step 2: Update user status
    user.role = role;
    await user.save();

    // Step 3: Create role-specific record if not already existing
    if (role === "dealer") {
      const existingDealer = await Dealer.findOne({
        where: { userId: user.id },
      });
      if (!existingDealer) {
        await Dealer.create({
          userId: user.id,
          location: user.city || null, // optional: use user's city if available
          status: "nonverified",
          slug: user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
        });
      }
    } else if (role === "repair") {
      const existingRepair = await Repair.findOne({
        where: { userId: user.id },
      });
      if (!existingRepair) {
        await Repair.create({
          userId: user.id,
          location: user.city || null,
          status: "nonverified",
          slug: user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
        });
      }
    } else if (role === "insurance") {
      const existingInsurance = await Insurance.findOne({
        where: { userId: user.id },
      });
      if (!existingInsurance) {
        await Insurance.create({
          userId: user.id,
          location: user.city || null,
          status: "nonverified",
          slug: user.fullname
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, ""),
        });
      }
    }

    return json.successResponse(
      res,
      `User role changed to '${role}' successfully.`,
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

// Admin: update another user's email and/or password
o.adminUpdateUser = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    const user = await User.findByPk(id);
    if (!user) return json.errorResponse(res, "User not found", 404);

    // If email provided, ensure it's not used by another user
    if (email) {
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.id !== user.id) {
        return json.errorResponse(res, "Email already in use", 409);
      }
    }

    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = bcrypt.hashSync(password, 5);

    await user.update(updates);

    // Do not return password in response
    const userSafe = user.toJSON ? user.toJSON() : Object.assign({}, user);
    if (userSafe.password) delete userSafe.password;

    return json.showOne(res, userSafe, 200);
  } catch (error) {
    console.error("Admin Update User Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAdminUsers = async function (req, res, next) {
  try {
    const { role } = req.params;
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.perPage || req.query.limit, 10) || 10;
    const offset = (page - 1) * perPage;

    // Fetch paginated users and total count for the role
    const { count, rows } = await User.findAndCountAll({
      where: { role },
      include: [
        { model: Dealer, as: "dealer" },
        { model: Repair, as: "repair" },
        { model: Insurance, as: "insurance" },
      ],
      limit: perPage,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    const users = rows;

    // Build pagination meta
    const total = count || 0;
    const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0;

    // Initialize stats object
    const stats = {};

    // For stats we need ALL user ids of this role (not only current page)
    const allUsersForRole = await User.findAll({
      where: { role },
      attributes: ["id"],
      raw: true,
    });

    const allIds = allUsersForRole.map((u) => u.id);

    // If no users, return early with empty stats
    if (allIds.length === 0) {
      json.showAll(
        res,
        {
          users,
          pagination: { total, page, perPage, totalPages },
          ...stats,
        },
        200
      );
      return;
    }

    // ---------- Dealer Stats ----------
    if (role === "dealer") {
      const dealerIds = allIds;

      const ads = await Advertisement.findAll({
        where: { dealerId: dealerIds },
        attributes: [
          [Sequelize.fn("COUNT", Sequelize.col("id")), "totalAds"],
          [Sequelize.fn("SUM", Sequelize.col("amountSpent")), "totalAdRevenue"],
        ],
        raw: true,
      });

      const subscriptions = await Subscription.findAll({
        where: { userId: dealerIds },
        attributes: [[Sequelize.fn("COUNT", Sequelize.col("id")), "subscriptionCount"]],
        raw: true,
      });

      stats.dealerStats = {
        totalAds: Number(ads[0]?.totalAds || 0),
        totalAdRevenue: Number(ads[0]?.totalAdRevenue || 0),
        subscriptionCount: Number(subscriptions[0]?.subscriptionCount || 0),
      };
    }

    // ---------- Repair Stats ----------
    else if (role === "repair") {
      const repairIds = allIds;

      const subs = await Subscription.findAll({
        where: { userId: repairIds },
        attributes: [
          [
            Sequelize.literal(
              `SUM(CAST(REPLACE(REPLACE(CAST("price" AS TEXT), '$', ''), ',', '') AS NUMERIC))`
            ),
            "totalSubscriptionRevenue",
          ],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "subscriptionCount"],
        ],
        raw: true,
      });

      stats.repairStats = {
        totalSubscriptionRevenue: Number(subs[0]?.totalSubscriptionRevenue || 0),
        subscriptionCount: Number(subs[0]?.subscriptionCount || 0),
      };
    }

    // ---------- Insurance Stats ----------
    else if (role === "insurance") {
      const insuranceIds = allIds;

      const subs = await Subscription.findAll({
        where: { userId: insuranceIds },
        attributes: [
          [
            Sequelize.literal(
              `SUM(CAST(REPLACE(REPLACE(CAST("price" AS TEXT), '$', ''), ',', '') AS NUMERIC))`
            ),
            "totalSubscriptionRevenue",
          ],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "subscriptionCount"],
        ],
        raw: true,
      });

      stats.insuranceStats = {
        totalSubscriptionRevenue: Number(subs[0]?.totalSubscriptionRevenue || 0),
        subscriptionCount: Number(subs[0]?.subscriptionCount || 0),
      };
    }

    // Send response with paginated users and stats
    json.showAll(
      res,
      {
        users,
        pagination: { total, page, perPage, totalPages },
        ...stats,
      },
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getUserById = async function (req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [
        {
          model: Dealer,
          as: "dealer",
          attributes: { exclude: ["userId"] }, // optional: exclude foreign key
        },
        {
          model: Repair,
          as: "repair",
        },
        {
          model: Insurance,
          as: "insurance",
        },
        {
          model: Wallet,
          as: "wallet",
        },
      ],
    });
    json.showOne(res, user, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAdminStats = async function (req, res, next) {
  try {
    // 1️⃣ Count users by role
    const [dealers, repairs, insurances] = await Promise.all([
      User.count({ where: { role: "dealer" } }),
      User.count({ where: { role: "repair" } }),
      User.count({ where: { role: "insurance" } }),
    ]);

    // 2️⃣ Total subscription revenue
    const totalSubsRevenueResult = await Subscription.findAll({
      attributes: [
        [
          Sequelize.literal(`
            SUM(
              CAST(
                REPLACE(REPLACE(CAST("price" AS TEXT), '$', ''), ',', '') AS NUMERIC
              )
            )
          `),
          "totalSubscriptionRevenue",
        ],
      ],
      raw: true,
    });

    const totalSubscriptionRevenue = Number(
      totalSubsRevenueResult[0]?.totalSubscriptionRevenue || 0
    );

    // 3️⃣ Dealer ad stats
    const dealerAdsResult = await Advertisement.findAll({
      attributes: [
        [Sequelize.fn("COUNT", Sequelize.col("id")), "totalAds"],
        [
          Sequelize.literal(`
            SUM(
              CAST(
                REPLACE(REPLACE(CAST("amountSpent" AS TEXT), '$', ''), ',', '') AS NUMERIC
              )
            )
          `),
          "totalAdRevenue",
        ],
      ],
      raw: true,
    });

    const totalAds = Number(dealerAdsResult[0]?.totalAds || 0);
    const totalAdRevenue = Number(dealerAdsResult[0]?.totalAdRevenue || 0);

    // 4️⃣ Activity chart (monthly subscription count for last 12 months)
    const { range = "year" } = req.query;
    const now = new Date();
    let startDate;

    if (range === "week") {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
    } else if (range === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // year - last 12 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    const activityData = await Subscription.findAll({
      attributes: [
        [
          Sequelize.fn("TO_CHAR", Sequelize.col("createdAt"), "YYYY-MM"),
          "yearMonth",
        ],
        [Sequelize.fn("TO_CHAR", Sequelize.col("createdAt"), "Mon"), "month"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "value"],
      ],
      where: {
        createdAt: {
          [Sequelize.Op.gte]: startDate,
        },
      },
      group: [
        Sequelize.fn("TO_CHAR", Sequelize.col("createdAt"), "YYYY-MM"),
        Sequelize.fn("TO_CHAR", Sequelize.col("createdAt"), "Mon"),
      ],
      order: [
        [Sequelize.fn("TO_CHAR", Sequelize.col("createdAt"), "YYYY-MM"), "ASC"],
      ],
      raw: true,
    });

    // Format activity data to ensure all months are present
    const formattedActivityData = [];
    if (range === "year") {
      // Generate all 12 months
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const yearMonth = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString("en-US", { month: "short" });

        const existingData = activityData.find(
          (d) => d.yearMonth === yearMonth
        );
        formattedActivityData.push({
          month: monthName,
          value: existingData ? parseInt(existingData.value) : 0,
        });
      }
    } else if (range === "month") {
      // Generate days of current month
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      const dailyData = await Subscription.findAll({
        attributes: [
          [Sequelize.fn("DATE", Sequelize.col("createdAt")), "date"],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "value"],
        ],
        where: {
          createdAt: {
            [Sequelize.Op.gte]: startDate,
          },
        },
        group: [Sequelize.fn("DATE", Sequelize.col("createdAt"))],
        order: [[Sequelize.fn("DATE", Sequelize.col("createdAt")), "ASC"]],
        raw: true,
      });

      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(now.getFullYear(), now.getMonth(), i);
        const dateStr = date.toISOString().split("T")[0];
        const existingData = dailyData.find((d) => d.date === dateStr);
        formattedActivityData.push({
          month: i.toString(),
          value: existingData ? parseInt(existingData.value) : 0,
        });
      }
    } else if (range === "week") {
      // Generate last 7 days
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyData = await Subscription.findAll({
        attributes: [
          [Sequelize.fn("DATE", Sequelize.col("createdAt")), "date"],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "value"],
        ],
        where: {
          createdAt: {
            [Sequelize.Op.gte]: startDate,
          },
        },
        group: [Sequelize.fn("DATE", Sequelize.col("createdAt"))],
        order: [[Sequelize.fn("DATE", Sequelize.col("createdAt")), "ASC"]],
        raw: true,
      });

      for (let i = 6; i >= 0; i--) {
        const date = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - i
        );
        const dateStr = date.toISOString().split("T")[0];
        const dayName = dayNames[date.getDay()];
        const existingData = dailyData.find((d) => d.date === dateStr);
        formattedActivityData.push({
          month: dayName,
          value: existingData ? parseInt(existingData.value) : 0,
        });
      }
    }

    // 5️⃣ Dashboard summary cards
    const stats = [
      { label: "Total Dealers", value: dealers },
      { label: "Total Repairs", value: repairs },
      { label: "Total Insurances", value: insurances },
      {
        label: "Total Subscription Revenue",
        value: `$${totalSubscriptionRevenue.toLocaleString()}`,
      },
      { label: "Total Ads Posted", value: totalAds },
      {
        label: "Total Ad Revenue",
        value: `$${totalAdRevenue.toLocaleString()}`,
      },
    ];

    json.showAll(res, { stats, activityData: formattedActivityData }, 200);
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
