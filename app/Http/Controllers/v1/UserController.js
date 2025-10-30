"use strict";

const db = require("../../../Models/index");
const User = db.User;
const Dealer = db.Dealer;
const Repair = db.Repair;
const Insurance = db.Insurance;

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

    const usernameExist = await User.findOne({
      where: { username: req.body.username },
    });

    if (usernameExist) {
      return json.errorResponse(res, "Username Already Exist!", 409);
    }

    let password = bcrypt.hashSync(req.body.password, 5);

    let newUser = new User({
      email: req.body.email,
      username: req.body.username,
      fullname: req.body.fullname,
      password: password,
    });

    newUser = await newUser.save();

    let newUserInfo = newUser;

    // Remove sensitive information
    delete newUserInfo.password;

    newUserInfo.token = createToken(newUser);

    json.showOne(res, newUserInfo, 201);
  } catch (err) {
    return json.errorResponse(res, err);
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
    });

    if (!user) {
      return json.errorResponse(res, "User Not found", 404);
    }

    const validUser = bcrypt.compareSync(req.body.password, user.password);
    console.log("req body", req.body);

    if (!validUser) {
      return json.errorResponse(res, "Wrong password", 401);
    }

    let newUserInfo = user;
    // Remove sensitive information
    delete newUserInfo.password;

    const token = createToken(user);

    json.showOne(res, { user: newUserInfo, token }, 200);
  } catch (err) {
    return json.errorResponse(res, err);
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
        // {
        //   model: Subscription,
        //   as: "subscription",
        // },
        // Add other associations as needed
      ],
    });

    if (!user) {
      return json.notFound(res, "User not found");
    }

    return json.showOne(res, user);
  } catch (err) {
    return json.errorResponse(res, err);
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

    // Handle image upload
    if (req.file) {
      // Construct full URL with server address
      const serverAddress = process.env.APP_URL;
      properties.image = `${serverAddress}/uploads/user/${req.file.filename}`;
    }

    // Find the user first
    const user = await User.findByPk(req.decoded.id);
    if (!user) return json.errorResponse(res, "User not found");

    // Update user
    await user.update(properties);

    json.showOne(res, user);
  } catch (err) {
    console.error(err);
    return json.errorResponse(res, err);
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
    console.error(err);
    return json.errorResponse(res, err);
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
    return json.errorResponse(res, err);
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
    return json.errorResponse(res, err);
  }
};

o.getAllUsers = async function (req, res, next) {
  try {
    const users = await User.findAll();
    json.showAll(res, users, 200);
  } catch (error) {
    return json.errorResponse(res, err);
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

o.getAdminUsers = async function (req, res, next) {
  try {
    const { role } = req.params;
    const users = await User.findAll({
      where: { role },
      include: [
        {
          model: Dealer,
          as: "dealer",
        },
        {
          model: Repair,
          as: "repair",
        },
        {
          model: Insurance,
          as: "insurance",
        },
      ],
    });
    json.showAll(res, users, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getUserById = async function (req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    json.showOne(res, user, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};
module.exports = o;
