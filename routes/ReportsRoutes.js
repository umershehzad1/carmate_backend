"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const reportController = require("../app/Http/Controllers/v1/ReportController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/").post(reportController.createReport);
router
  .route("/getallreports")
  .get(authCtrl.authenticate, authCtrl.isAdmin, reportController.getAllReports);

router
  .route("/:id")
  .get(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    reportController.getReportDetails
  );

module.exports = router;
