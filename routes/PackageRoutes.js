"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const packageController = require("../app/Http/Controllers/v1/PackageController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");

const router = express.Router();

router
  .route("/")
  .post(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    packageController.createPackage
  );

router
  .route("/getallpackages/:packagecategory")
  .get(packageController.getAllPackges);

router
  .route("/:id")
  .delete(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    packageController.deletePackage
  );
router
  .route("/:id")
  .patch(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    packageController.updatePackage
  );
module.exports = router;
