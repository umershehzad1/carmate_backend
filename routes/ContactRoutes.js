"use strict";

const express = require("express");
const multer = require("multer");

/** Controllers **/
const ContactController = require("../app/Http/Controllers/v1/ContactController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");
const uploadCtrl = require("../app/Http/Controllers/v1/UploadController");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.route("/").post(ContactController.createContact);
router
  .route("/getallcontacts")
  .get(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    ContactController.getAllContacts
  );

router
  .route("/:id")
  .get(
    authCtrl.authenticate,
    authCtrl.isAdmin,
    ContactController.getContactDetails
  );

  router.route("/delete/:id").delete(authCtrl.authenticate, authCtrl.isAdmin, ContactController.deleteContact)

module.exports = router;
