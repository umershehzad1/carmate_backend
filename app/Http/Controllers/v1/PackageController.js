"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const TestDriveRequest = db.TestDriveRequest;
const Package = db.Package;
const stripe = require("../../../../config/Stripe");
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

o.createPackage = async function (req, res, next) {
  try {
    const {
      package: packageName,
      price,
      description,
      vehicleCount,
      features,
      packageCategory,
    } = req.body;
    validateRequiredFieldsSequentially(req.body, [
      "package",
      "price",
      "description",
      "features",
      "packageCategory",
    ]);

    // 1️⃣ Create Stripe Product
    const product = await stripe.products.create({
      name: packageName,
      description,
    });

    // 2️⃣ Create Stripe Price (recurring monthly)
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100),
      currency: "cad",
      recurring: {
        interval: "month",
      },
      metadata: {
        packageName,
      },
    });

    // 3️⃣ Save in database
    const newPackage = await Package.create({
      package: packageName,
      price,
      description,
      vehicleCount:
        packageCategory === "dealer" ? (Number(vehicleCount) ?? null) : null,

      features,
      stripeProductId: product.id,
      stripePriceId: stripePrice.id,
      packageCategory,
    });

    return json.successResponse(res, "Package Created Successfully!", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllPackges = async function (req, res, next) {
  try {
    const { packagecategory } = req.params;
    const packages = await Package.findAll({
      where: { packageCategory: packagecategory },
    });

    return json.showAll(res, packages, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deletePackage = async function (req, res, next) {
  try {
    const { id } = req.params;

    // 1️⃣ Fetch the package from DB
    const existingPackage = await Package.findByPk(id);
    if (!existingPackage)
      return json.errorResponse(res, "Package not found", 404);

    // 2️⃣ Deactivate (archive) in Stripe
    try {
      // a. Deactivate Stripe Price
      if (existingPackage.stripePriceId) {
        await stripe.prices.update(existingPackage.stripePriceId, {
          active: false,
        });
      }

      // b. Deactivate Stripe Product
      if (existingPackage.stripeProductId) {
        await stripe.products.update(existingPackage.stripeProductId, {
          active: false,
        });
      }
    } catch (stripeErr) {
      console.error("⚠️ Stripe Deactivation Failed:", stripeErr.message);
      // Do not abort deletion if Stripe update fails, but log it
    }

    // 3️⃣ Delete from database
    await existingPackage.destroy();

    // 4️⃣ Respond success
    return json.successResponse(res, "Package deleted successfully!", 200);
  } catch (error) {
    console.error("❌ Delete Package Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updatePackage = async function (req, res, next) {
  try {
    const { id } = req.params;
    const {
      package: packageName,
      price,
      description,
      vehicleCount,
      features,
      packageCategory,
    } = req.body;

    // 1️⃣ Fetch the existing package
    const existingPackage = await Package.findByPk(id);
    if (!existingPackage)
      return json.errorResponse(res, "Package not found", 404);

    // 2️⃣ Check if the price has changed
    const priceChanged = price && price !== existingPackage.price;

    let newStripePriceId = existingPackage.stripePriceId;

    // 3️⃣ If price changed, create a new Stripe Price (keep old one active)
    if (priceChanged) {
      const newPrice = await stripe.prices.create({
        product: existingPackage.stripeProductId,
        unit_amount: Math.round(price * 100),
        currency: "cad",
        recurring: { interval: "month" },
        metadata: { packageName },
      });

      newStripePriceId = newPrice.id;
    }

    // 4️⃣ Update Stripe Product details (non-price attributes)
    await stripe.products.update(existingPackage.stripeProductId, {
      name: packageName || existingPackage.package,
      description: description || existingPackage.description,
    });

    // 5️⃣ Update database record (only price & StripePriceId if changed)
    await existingPackage.update({
      package: packageName || existingPackage.package,
      price: price || existingPackage.price,
      description: description || existingPackage.description,
      vehicleCount: vehicleCount ?? existingPackage.vehicleCount,
      features: features || existingPackage.features,
      stripePriceId: newStripePriceId,
      packageCategory: packageCategory || existingPackage.packageCategory,
    });

    // 6️⃣ Respond success
    return json.successResponse(res, "Package updated successfully!", 200);
  } catch (error) {
    console.error("❌ Edit Package Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
