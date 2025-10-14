"use strict";

const express = require("express");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage({}),
  limits: { fileSize: 500000000 },
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
    upload.single("image"),
    userReq.edit,
    userReq.validate,
    userCtrl.edit
  );

router.route("/signup").post(userReq.signup, userReq.validate, userCtrl.signup);

router.route("/login").post(userReq.signin, userReq.validate, userCtrl.login);

router
  .route("/forget-password")
  .post(userReq.forgetPassword, userReq.validate, userCtrl.forgetPassword);

router
  .route("/reset-password")
  .post(userReq.resetPassword, userReq.validate, userCtrl.resetPassword);

router
  .route("/allusers")
  .get(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.getAllUsers);
router
  .route("/updatestatus/:id")
  .patch(authCtrl.authenticate, authCtrl.isAdmin, userCtrl.updateRole);

// Upload Routes
router
  .route("/upload")
  .post(authCtrl.authenticate, upload.single("attachment"), uploadCtrl.upload);

module.exports = router;
