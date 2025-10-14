"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const vehicleCtrl = require("../app/Http/Controllers/v1/VehicleController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

/** Validation **/
const userReq = require("../app/Http/Requests/UserValidator");

const router = express.Router();

// User Routes
router.route("/addvehicle").post(
  authCtrl.authenticate,
  upload.array("images"), // "images" is the field name sent from frontend
  vehicleCtrl.addVehicle
);
router.route("/getAllVehicles").get(vehicleCtrl.getAllVehicles);
router.route("/:slug").get(vehicleCtrl.getVehicleDetails);
router
  .route("/getdealervehicles/:status?")
  .get(authCtrl.authenticate, vehicleCtrl.getDealerVehicles);

router.route("/:id").put(authCtrl.authenticate, vehicleCtrl.updateVehicle);
router.route("/:id").delete(authCtrl.authenticate, vehicleCtrl.deleteVehicle);
module.exports = router;
