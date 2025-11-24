"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");

// Configure multer for user image uploads

// Use memory storage for edit route so req.file.buffer is available
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed."
        )
      );
    }
  },
});

// Keep disk storage for other routes if needed
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/uploads/user"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, uniqueSuffix + ext);
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed."
        )
      );
    }
  },
});

/** Controllers **/
const userCtrl = require("../app/Http/Controllers/v1/UserController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");

/** Validation **/
const userReq = require("../app/Http/Requests/UserValidator");

const router = express.Router();

// User Routes
router
  .route("/")
  .get(authCtrl.authenticate, userCtrl.me)
  .patch(
    authCtrl.authenticate,
    uploadMemory.single("image"),
    userReq.edit,
    userReq.validate,
    userCtrl.edit
  );

router.route("/getuser/:id").get(userCtrl.getUserById);
router.route("/signup").post(userReq.signup, userReq.validate, userCtrl.signup);

router.route("/login").post(userReq.signin, userReq.validate, userCtrl.login);

router.route("/forget-password").post(userCtrl.forgetPassword);

router.route("/reset-password").patch(userCtrl.resetPassword);

router.route("/verifyotp").post(userCtrl.verifyResetPasswordCode);
router
  .route("/allusers")
  .get(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.getAllUsers);
router
  .route("/updaterole/:id")
  .patch(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.updateRole);
router
  .route("/updatepassword")
  .patch(authCtrl.authenticate, userCtrl.updatePassword);
router.route("/googlesignup").post(userCtrl.googleSignup);

router
  .route("/getadminusers/:role")
  .get(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.getAdminUsers);
router
  .route("/admin/updateuser/:id")
  .patch(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.adminUpdateUser);
// Upload Routes
router
  .route("/upload")
  .post(authCtrl.authenticate, upload.single("attachment"), uploadCtrl.upload);
router
  .route("/getadminstats")
  .get(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.getAdminStats);
module.exports = router;
