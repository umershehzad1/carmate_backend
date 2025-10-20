"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Advertisement = db.Advertisement;
const Vehicle = db.Vehicle;
const Dealer = db.Dealer;
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

o.createAd = async function (req, res, next) {
  try {
    const { vehicleId, adType, startDate, endDate, dailyBudget } = req.body;
    const user = req.decoded;

    validateRequiredFieldsSequentially(req.body, [
      "vehicleId",
      "adType",
      "startDate",
      "endDate",
      "dailyBudget",
    ]);

    if (user.role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }

    const ad = await Advertisement.create({
      vehicleId: vehicleId,
      dealerId: user.id,
      adType: adType,
      startDate: startDate,
      endDate: endDate,
      dailyBudget: dailyBudget,
    });
    return json.successResponse(res, "Ad created successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAdDetails = async function (req, res, next) {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByPk(id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
      ],
    });

    if (!ad) {
      return json.errorResponse(res, "Ad not found", 404);
    }
    return json.showOne(res, ad, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllDealerAds = async function (req, res, next) {
  try {
    const ads = await Advertisement.findAll({
      where: { dealerId: req.decoded.id },
    });
    if (!ads || ads.length === 0) {
      return json.errorResponse(res, "No ads found", 404);
    }
    return json.showAll(res, ads, 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.getAllAds = async function (req, res, next) {
  try {
    const { adType } = req.query;

    const query = {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
        {
          model: User,
          as: "dealer", // from Advertisement.belongsTo(User)
          attributes: ["id", "fullname", "email", "phone", "role", "image"],
          include: [
            {
              model: Dealer,
              as: "dealer", // from User.hasOne(Dealer)
              attributes: [
                "id",
                "location",
                "status",
                "image",
                "availableCarListing",
              ],
            },
          ],
        },
      ],
    };

    if (adType) {
      query.where = { adType };
    }

    const ads = await Advertisement.findAll(query);

    if (!ads || ads.length === 0) {
      return json.errorResponse(res, "No ads found", 404);
    }

    return json.showAll(res, ads, 200);
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.updateAdStatus = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate input
    validateRequiredFieldsSequentially(req.body, ["status"]);

    // Ensure user is a dealer
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    // Fetch ad with vehicle relationship
    const ad = await Advertisement.findByPk(id);

    // Check if ad exists
    if (!ad) {
      return json.errorResponse(res, "Ad not found", 404);
    }

    // Verify ownership: only the dealer who owns the vehicle can modify the ad
    if (ad.dealerId !== req.decoded.id) {
      return json.errorResponse(
        res,
        "You can only update ads for your own vehicles",
        403
      );
    }

    // Update status
    ad.status = status;
    await ad.save();

    return json.successResponse(
      res,
      `Updated ad status to "${status}" successfully`,
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deleteAd = async function (req, res, next) {
  try {
    const { id } = req.params;

    // Ensure user is a dealer
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    // Fetch ad with vehicle relation
    const ad = await Advertisement.findByPk(id);

    // Check if ad exists
    if (!ad) {
      return json.errorResponse(res, "Ad not found", 404);
    }

    // Verify ownership
    if (ad.dealerId !== req.decoded.id) {
      return json.errorResponse(
        res,
        "You can only delete ads for your own vehicles",
        403
      );
    }

    // Delete the ad
    await ad.destroy();

    return json.successResponse(res, "Ad deleted successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.extendAdCompaign = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { startDate, endDate, dailyBudget } = req.body;
    validateRequiredFieldsSequentially(req.body, ["endDate", "dailyBudget"]);
    const ad = await Advertisement.findByPk(id);
    if (!ad) {
      return json.errorResponse(res, "Ad not found", 404);
    }
    if (ad.dealerId !== req.decoded.id) {
      return json.errorResponse(res, "You can only update your own ads", 401);
    }
    ad.startDate = startDate;
    ad.endDate = endDate;
    ad.dailyBudget = dailyBudget;
    await ad.save();

    return json.successResponse(res, "Ad updated successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
