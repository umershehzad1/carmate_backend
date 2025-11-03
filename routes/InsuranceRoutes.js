"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const insuranceCtrl = require("../app/Http/Controllers/v1/InsuranceController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/getallinsurances").get(insuranceCtrl.getAllInsurance);
router
  .route("/getinsurancestats")
  .get(authCtrl.authenticate, insuranceCtrl.getInsuranceStats);
router.route("/:slug").get(insuranceCtrl.getInsurnaceProfile);
router
  .route("/")
  .patch(authCtrl.authenticate, insuranceCtrl.updateInsuranceProfile);
router
  .route("/")
  .delete(authCtrl.authenticate, insuranceCtrl.deleteInsuranceProfile);

module.exports = router;
