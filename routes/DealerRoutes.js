"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const dealerCtrl = require("../app/Http/Controllers/v1/DealerController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/getalldealers").get(dealerCtrl.getAllDealers);
router.route("/:id").get(dealerCtrl.getDealerDetails);
router.route("/:id").patch(authCtrl.authenticate, dealerCtrl.updateDealer);
router.route("/:id").delete(authCtrl.authenticate, dealerCtrl.deleteDealer);

module.exports = router;
