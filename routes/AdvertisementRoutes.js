"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const advertisementCtrl = require("../app/Http/Controllers/v1/AdvertisementController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router
  .route("/createad")
  .post(authCtrl.authenticate, advertisementCtrl.createAd);
router
  .route("/getdealerstats")
  .get(authCtrl.authenticate, advertisementCtrl.getDealerStats);
router.route("/getalldealerads/:id").get(advertisementCtrl.getAllDealerAds);
router.route("/getallads").get(advertisementCtrl.getAllAds);
router.route("/getallfeaturesads").get(advertisementCtrl.getAllFeaturesAds);
router.route("/:id").get(advertisementCtrl.getAdDetails);
router
  .route("/:id")
  .patch(authCtrl.authenticate, advertisementCtrl.updateAdStatus);
router.route("/:id").delete(authCtrl.authenticate, advertisementCtrl.deleteAd);
router.route("/getsimilarads/:slug").get(advertisementCtrl.getSimilarAds);
router
  .route("/extendadcompaign/:id")
  .patch(authCtrl.authenticate, advertisementCtrl.extendAdCompaign);
router.route("/registeradclick/:id").post(advertisementCtrl.registerAdClick);
router
  .route("/registerlead/:id")
  .patch(authCtrl.authenticate, advertisementCtrl.registerLead);
router.route("/getaddetails/:adId").get(advertisementCtrl.getAdDetailsBySlug);
module.exports = router;
