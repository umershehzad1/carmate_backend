"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};
const uploadImages = multer({
  storage: multer.memoryStorage(), // Use memory storage for Cloudinary
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});
/** Controllers **/
const detailerController = require("../app/Http/Controllers/v1/DetailerController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();
router
  .route("/getrepairstats")
  .get(authCtrl.authenticate, detailerController.getDetailerStats);
router.route("/getallrepairs").get(detailerController.getAllDetailers);
router.route("/:slug").get(detailerController.getDetailerDetails);
router
  .route("/")
  .patch(
    authCtrl.authenticate,
    uploadImages.array("gallery"),
    detailerController.updateDetailerProfile
  );
router.route("/").delete(authCtrl.authenticate, detailerController.deleteDetailerProfile);

module.exports = router;
