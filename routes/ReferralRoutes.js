"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const referralCtrl = require("../app/Http/Controllers/v1/ReferalController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/").post(authCtrl.authenticate, referralCtrl.createReferral);
router
  .route("/getallreferrals")
  .get(authCtrl.authenticate, referralCtrl.getAllReferrals);
router
  .route("/:id")
  .get(authCtrl.authenticate, referralCtrl.getReferralDetails);
router.route("/:id").patch(authCtrl.authenticate, referralCtrl.UpdateStatus);

module.exports = router;
