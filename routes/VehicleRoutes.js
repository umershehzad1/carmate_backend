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

// Multer configuration for vehicle image storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vehicleUploadsDir = path.join(
      __dirname,
      "../public/uploads/vehicles"
    );
    // Ensure directory exists
    if (!fs.existsSync(vehicleUploadsDir)) {
      fs.mkdirSync(vehicleUploadsDir, { recursive: true });
    }
    cb(null, vehicleUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, "vehicle-" + uniqueSuffix + ext);
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

// Multer instance for CSV (disk storage)
const uploadCSV = multer({
  storage: storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for CSV
});

// Multer instance for images (memory storage for Cloudinary)
const memoryStorage = multer.memoryStorage();
const uploadImagesMemory = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

const router = express.Router();

router.route("/getallvehiclesmakes").get(vehicleCtrl.getAllMakes);
// Vehicle Routes
router.route("/addvehicle").post(
  authCtrl.authenticate,
  uploadImagesMemory.array("images"), // "images" is the field name sent from frontend
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

router
  .route("/:id")
  .patch(
    authCtrl.authenticate,
    uploadImagesMemory.array("images"),
    vehicleCtrl.updateVehicle
  );
router.route("/:id").delete(authCtrl.authenticate, vehicleCtrl.deleteVehicle);
// Admin route to delete vehicle and all related data
router
  .route("/admin/delete/:id")
  .delete(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    vehicleCtrl.adminDeleteVehicle
  );
router.route("/getallvehiclesmodels/:make").get(vehicleCtrl.getModelsByMake);
module.exports = router;
