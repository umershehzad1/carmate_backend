'use strict'

const db = require("../../../Models/index")
const User = db.User;

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ejs = require("ejs");
const path = require("path");

let fs = require('fs');
let config = {};
config.app = require('../../../../config/app');
config.services = require('../../../../config/services');
const { JWT_EXPIRES_IN } = require('../../../../config/constants');

const json = require('../../../Traits/ApiResponser');
const email = require('../../../Traits/SendEmail');

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

    return jwt.sign({

        _id: user.id,
        username: user.username,
        email: user.email
    }, config.app.key, { expiresIn: JWT_EXPIRES_IN });
}

let o = {}

o.signup = async (req, res, next) => {

    try {
        const user = await User.findOne({ where: {email: req.body.email} });

        if (user) {

            return json.errorResponse(res, 'User Already Exist!', 409)
        }

        let password = bcrypt.hashSync(req.body.password, 5);

        let newUser = new User({

            email: req.body.email,
            username: req.body.username,
            fullname: req.body.fullname,
            password: password,
        })

        newUser = await newUser.save()

        let newUserInfo = newUser;

        // Remove sensitive information
        delete newUserInfo.password;

        newUserInfo.token = createToken(newUser)

        json.showOne(res, newUserInfo, 201)

    } catch (err) {

        return json.errorResponse(res, err)
    }
}

o.login = async (req, res, next) => {

    try {
        const user = await User.findOne({ email: req.body.email })

        if (!user) {

            return json.errorResponse(res, "User Not found", 404)
        }

        const validUser = bcrypt.compareSync(req.body.password, user.password);

        if (!validUser) {

            return json.errorResponse(res, "Wrong password", 401)
        }

        let newUserInfo = user;
        // Remove sensitive information
        delete newUserInfo.password;

        const token = createToken(user);
    
        json.showOne(res, {newUserInfo, token}, 200)

    } catch (err) {

        return json.errorResponse(res, err)
    }
}


o.me = async (req, res, next) => {

    try {

        const user = await User.findOne({ id: req.decoded.id })

        json.showOne(res, user)

    } catch (err) {

        return json.errorResponse(res, err)
    }
}


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
            const extension = req.body.extension || "jpg";
            const filename = Date.now() + '.' + extension;
            const destination = path.join(__dirname, "../../../public/uploads/");

            // Ensure directory exists
            if (!fs.existsSync(destination)) {
                fs.mkdirSync(destination, { recursive: true });
            }

            // Write file to server
            fs.writeFileSync(destination + filename, req.file.buffer);

            // Construct URL path for storing in DB
            const serverAddress = req.protocol + '://' + req.headers.host + '/';
            properties.image = serverAddress + 'public/uploads/' + filename;
        }

        // Find the user first
        const user = await User.findByPk(req.decoded._id);
        if (!user) return json.errorResponse(res, "User not found");

        // Update user
        await user.update(properties);

        json.showOne(res, user);

    } catch (err) {
        console.error(err);
        return json.errorResponse(res, err);
    }
}




o.forgetPassword = async (req, res, next) => {
    try {
        console.log("body", req.body);
        
        
        const user = await User.findOne({ where: { email: req.body.email } });

        if (!user) {
            return json.errorResponse(res, "Email Not Found", 404);
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        user.resetPasswordCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        user.resetPasswordExpires = tomorrow;

        await user.save();

        const html = await ejs.renderFile(
            path.join(__dirname, '../../../../resources/views/emails/forgot-password-email.ejs'),
            { resetPasswordCode: user.resetPasswordCode }
        );

        email.send(user.email, "Forget Password?", html);

        json.showOne(res, { success: true });

    } catch (err) {
        console.error(err);
        return json.errorResponse(res, err);
    }
};


o.resetPasswordPage = async function (req, res, next) {

    try {

        let code = false;
        let expiry = false;
        let success = false;

        if (req.query.code) {

            const user = await User.findOne({ resetPasswordCode: req.query.code });
            code = (user) ? true : false;
            expiry = (user.resetPasswordExpires <= new Date()) ? true : false;
        }

        res.render('reset-password', { code: code, expiry: expiry, success: success });

    } catch (err) {

        return json.errorResponse(res, err)
    }
}

o.resetPasswordPageSubmission = async function (req, res, next) {

    try {

        let code = false;
        let expiry = false;
        let success = false;

        if (req.query.code) {

            let user = await User.findOne({ resetPasswordCode: req.query.code });
            code = (user) ? true : false;
            expiry = (user.resetPasswordExpires <= new Date()) ? true : false;
            if (code && !expiry) {

                user.resetPasswordExpires = new Date();
                user.password = bcrypt.hashSync(req.body.password, 5);
                await user.save();
                success = true;
            }

        }

        res.render('reset-password', { code: code, expiry: expiry, success: success });

    } catch (err) {

        return json.errorResponse(res, err)
    }
}

o.resetPassword = async function (req, res, next) {

    try {

        let code = false;
        let expiry = false;
        let success = false;
        let msg = "Unknown error occurred.";
        let statusCode = 500;

        let user = await User.findOne({ email: req.body.email, resetPasswordCode: req.body.code });
        code = (user) ? true : false;
        expiry = (user?.resetPasswordExpires <= new Date()) ? true : false;
        if (code && !expiry) {

            user.resetPasswordExpires = new Date();
            user.password = bcrypt.hashSync(req.body.password, 5);
            await user.save();
            success = true;
        }

        if (success) {
            msg = "Your password has been changed successfully."
            statusCode = 200
        } else if (!code) {
            msg = "Invalid code!"
            statusCode = 404
        } else if (expiry) {
            msg = "The code has been expired!",
                statusCode = 410;
        }

        json.showOne(res, {

            success: msg
        }, statusCode);


    } catch (err) {

        return json.errorResponse(res, err)
    }
}

module.exports = o;