"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const vehicleUploadsDir = path.join(__dirname, "../public/uploads/gallery");
    // Ensure directory exists
    if (!fs.existsSync(vehicleUploadsDir)) {
      fs.mkdirSync(vehicleUploadsDir, { recursive: true });
    }
    cb(null, vehicleUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, "gallery-" + uniqueSuffix + ext);
  },
});
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};
const uploadImages = multer({
  storage: storage, // Use the disk storage configuration
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});
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
router
  .route("/")
  .patch(
    authCtrl.authenticate,
    uploadImages.array("gallery"),
    repairCtrl.updateRepairProfile
  );
router.route("/").delete(authCtrl.authenticate, repairCtrl.deleteRepairProfile);

module.exports = router;
