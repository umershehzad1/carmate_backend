"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const testDriveRequestCtrl = require("../app/Http/Controllers/v1/TestDriveRequestsController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router
  .route("/")
  .post(authCtrl.authenticate, (req, res) =>
    testDriveRequestCtrl.addTestDriveRequest(req, res, global.io)
  );
router
  .route("/getAllTestDriveRequests")
  .get(authCtrl.authenticate, testDriveRequestCtrl.getAllTestDriveRequests);

router
  .route("/:id")
  .get(authCtrl.authenticate, testDriveRequestCtrl.getTestDriveRequestDetails);
module.exports = router;
