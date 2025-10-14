"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const TestDriveRequest = db.TestDriveRequest;
const Contact = db.Contact;
const User = db.User;
// Sequential field validation function
function validateRequiredFieldsSequentially(body, requiredFields) {
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`Field "${field}" is required`);
    }
  }
}

const o = {};

o.createContact = async function (req, res, next) {
  try {
    const { firstName, lastName, email, phone, message } = req.body;
    console.log("Request Body", req.body);

    validateRequiredFieldsSequentially(req.body, [
      "firstName",
      "lastName",
      "email",
      "phone",
      "message",
    ]);

    const contact = await Contact.create({
      firstName,
      lastName,
      email,
      phone,
      message,
    });

    return json.showOne(res, contact, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getContactDetails = async function (req, res, next) {
  try {
    const { id } = req.params;
    const contact = await Contact.findByPk(id);
    if (!contact) {
      return json.errorResponse(res, "Contact Not Fount", 404);
    }
    return json.showOne(res, contact, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};
o.getAllContacts = async function (req, res, next) {
  try {
    const contacts = await Contact.findAll();
    if (!contacts) {
      return json.errorResponse(res, "No contacts found", 404);
    }
    return json.showAll(res, contacts, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
