"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/** Controllers **/
const vehicleCtrl = require("../app/Http/Controllers/v1/VehicleController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");

/** Validation **/
const userReq = require("../app/Http/Requests/UserValidator");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "upload-" + uniqueSuffix + ext);
  },
});

// File filter for CSV
const csvFileFilter = (req, file, cb) => {
  if (
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.originalname.endsWith(".csv")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Multer instances
const uploadCSV = multer({
  storage: storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for CSV
});

const uploadImages = multer({
  storage: multer.memoryStorage(), // Keep images in memory (they'll be uploaded to cloud)
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

const router = express.Router();

// Vehicle Routes
router.route("/addvehicle").post(
  authCtrl.authenticate,
  uploadImages.array("images"), // "images" is the field name sent from frontend
  vehicleCtrl.addVehicle
);

router.post(
  "/bulkuploadvehicles",
  authCtrl.authenticate,
  uploadCSV.single("file"), // Use CSV multer instance
  vehicleCtrl.bulkUploadVehicles
);

router.route("/getAllVehicles").get(vehicleCtrl.getAllVehicles);
router.route("/:slug").get(vehicleCtrl.getVehicleDetails);
router
  .route("/getdealervehicles/:status?")
  .get(authCtrl.authenticate, vehicleCtrl.getDealerVehicles);

router.route("/:id").patch(authCtrl.authenticate, vehicleCtrl.updateVehicle);
router.route("/:id").delete(authCtrl.authenticate, vehicleCtrl.deleteVehicle);

module.exports = router;
