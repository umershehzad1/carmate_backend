"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const repairCtrl = require("../app/Http/Controllers/v1/RepairController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/getallrepairs").get(repairCtrl.getAllRepairs);
router.route("/:slug").get(repairCtrl.getRepairDetails);
router.route("/").patch(authCtrl.authenticate, repairCtrl.updateRepairProfile);
router.route("/").delete(authCtrl.authenticate, repairCtrl.deleteRepairProfile);

module.exports = router;
