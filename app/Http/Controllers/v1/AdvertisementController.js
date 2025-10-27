"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, fn, col } = require("sequelize");
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
          include: [
            {
              model: User,
              as: "user",
              include: [
                {
                  model: Dealer,
                  as: "dealer",
                },
              ],
            },
          ],
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
    // Extract pagination parameters from query (with defaults)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Fetch paginated ads with associations
    const { count, rows: ads } = await Advertisement.findAndCountAll({
      where: { dealerId: req.params.id },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
        {
          model: User,
          as: "dealer",
          attributes: ["id", "fullname", "email", "phone", "role", "image"],
          include: [
            {
              model: Dealer,
              as: "dealer",
              attributes: [
                "id",
                "location",
                "status",
                "image",
                "closingTime",
                "openingTime",
              ],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]], // optional: latest first
    });

    if (!ads || ads.length === 0) {
      return json.errorResponse(res, "No ads found", 404);
    }

    // Pagination metadata
    const totalPages = Math.ceil(count / limit);

    return json.showAll(
      res,
      {
        currentPage: page,
        totalPages,
        totalAds: count,
        ads,
      },
      200
    );
  } catch (error) {
    return json.errorResponse(res, error.message, 400);
  }
};

o.getAllAds = async function (req, res, next) {
  try {
    const {
      adType,
      page = 1,
      limit = 20,
      sort = "recent",
      keyword,
      city,
      province,
      make,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      minMileage,
      maxMileage,
      registerIn,
      transmission,
      color,
      fuelType,
      assemblyIn,
      bodyType,
      dealerStatus,
    } = req.query;

    const offset = (page - 1) * limit;

    // -----------------------------
    // VEHICLE FILTERS
    // -----------------------------
    const vehicleWhere = {};

    // Helper function to parse array filters
    const parseArrayFilter = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.includes(",")) {
        return value.split(",").map((v) => v.trim());
      }
      return [value];
    };

    // Apply filters with array support
    if (keyword) vehicleWhere.name = { [Op.iLike]: `%${keyword}%` };

    // Handle array filters - use Op.in for multiple values
    const cityArray = parseArrayFilter(city);
    if (cityArray && cityArray.length > 0) {
      vehicleWhere.city = { [Op.in]: cityArray };
    }

    const provinceArray = parseArrayFilter(province);
    if (provinceArray && provinceArray.length > 0) {
      vehicleWhere.province = { [Op.in]: provinceArray };
    }

    const makeArray = parseArrayFilter(make);
    if (makeArray && makeArray.length > 0) {
      vehicleWhere.make = { [Op.in]: makeArray };
    }

    const registerInArray = parseArrayFilter(registerIn);
    if (registerInArray && registerInArray.length > 0) {
      vehicleWhere.registerIn = { [Op.in]: registerInArray };
    }

    const transmissionArray = parseArrayFilter(transmission);
    if (transmissionArray && transmissionArray.length > 0) {
      vehicleWhere.transmission = { [Op.in]: transmissionArray };
    }

    const colorArray = parseArrayFilter(color);
    if (colorArray && colorArray.length > 0) {
      vehicleWhere.color = { [Op.in]: colorArray };
    }

    const fuelTypeArray = parseArrayFilter(fuelType);
    if (fuelTypeArray && fuelTypeArray.length > 0) {
      vehicleWhere.fuelType = { [Op.in]: fuelTypeArray };
    }

    const assemblyInArray = parseArrayFilter(assemblyIn);
    if (assemblyInArray && assemblyInArray.length > 0) {
      vehicleWhere.assemblyIn = { [Op.in]: assemblyInArray };
    }

    const bodyTypeArray = parseArrayFilter(bodyType);
    if (bodyTypeArray && bodyTypeArray.length > 0) {
      vehicleWhere.bodyType = { [Op.in]: bodyTypeArray };
    }

    // Range filters
    if (minPrice && maxPrice) {
      vehicleWhere.price = { [Op.between]: [minPrice, maxPrice] };
    } else if (minPrice) {
      vehicleWhere.price = { [Op.gte]: minPrice };
    } else if (maxPrice) {
      vehicleWhere.price = { [Op.lte]: maxPrice };
    }

    if (minYear && maxYear) {
      vehicleWhere.model = { [Op.between]: [minYear, maxYear] };
    } else if (minYear) {
      vehicleWhere.model = { [Op.gte]: minYear };
    } else if (maxYear) {
      vehicleWhere.model = { [Op.lte]: maxYear };
    }

    if (minMileage && maxMileage) {
      vehicleWhere.mileage = { [Op.between]: [minMileage, maxMileage] };
    } else if (minMileage) {
      vehicleWhere.mileage = { [Op.gte]: minMileage };
    } else if (maxMileage) {
      vehicleWhere.mileage = { [Op.lte]: maxMileage };
    }

    // -----------------------------
    // DEALER FILTER
    // -----------------------------
    const dealerWhere = {};
    const dealerStatusArray = parseArrayFilter(dealerStatus);
    if (dealerStatusArray && dealerStatusArray.length > 0) {
      dealerWhere.status = { [Op.in]: dealerStatusArray };
    }

    // -----------------------------
    // SORT ORDER
    // -----------------------------
    const order =
      sort === "oldest" ? [["createdAt", "ASC"]] : [["createdAt", "DESC"]];

    // -----------------------------
    // MAIN QUERY
    // -----------------------------
    const query = {
      where: adType ? { adType } : {},
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where:
            Object.keys(vehicleWhere).length > 0 ? vehicleWhere : undefined,
          required: true, // This ensures we only get ads with matching vehicles
        },
        {
          model: User,
          as: "dealer",
          attributes: ["id", "fullname", "email", "phone", "role", "image"],
          include: [
            {
              model: Dealer,
              as: "dealer",
              attributes: [
                "id",
                "location",
                "status",
                "image",
                "availableCarListing",
                "closingTime",
                "openingTime",
              ],
              where: Object.keys(dealerWhere).length ? dealerWhere : undefined,
              required: dealerStatusArray && dealerStatusArray.length > 0, // Only require if filter is applied
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order,
      distinct: true, // Important for correct count with includes
    };

    // -----------------------------
    // FETCH DATA WITH COUNT
    // -----------------------------
    const { rows: ads, count: filteredCount } =
      await Advertisement.findAndCountAll(query);

    // -----------------------------
    // TOTAL VEHICLES IN DATABASE
    // -----------------------------
    const totalVehicles = await Vehicle.count();

    // -----------------------------
    // AGGREGATION COUNTS (for filters)
    // -----------------------------
    const aggregateAttributes = [
      "city",
      "province",
      "make",
      "bodyType",
      "fuelType",
      "transmission",
      "color",
      "modelCategory",
    ];

    const aggregateData = {};
    for (const attr of aggregateAttributes) {
      const rows = await Vehicle.findAll({
        attributes: [
          [col(attr), attr],
          [fn("COUNT", col(attr)), "count"],
        ],
        group: [col(attr)],
        where: {
          [attr]: { [Op.ne]: null }, // exclude nulls
        },
        raw: true,
      });
      aggregateData[attr] = rows;
    }

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,
      message:
        ads.length > 0
          ? "Ads fetched successfully"
          : "No ads found matching your criteria",
      pagination: {
        totalFiltered: filteredCount,
        totalAllVehicles: totalVehicles,
        page: parseInt(page),
        perPage: parseInt(limit),
        totalPages: Math.ceil(filteredCount / limit),
        rangeText:
          filteredCount > 0
            ? `${offset + 1}-${Math.min(offset + parseInt(limit), filteredCount)} of ${filteredCount} vehicles`
            : "0 vehicles",
      },
      filterStats: aggregateData,
      data: ads || [],
    });
  } catch (error) {
    console.error(error);
    return json.errorResponse(res, error.message, 400);
  }
};

o.getAllFeaturesAds = async function (req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "recent",
      keyword,
      city,
      province,
      make,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      minMileage,
      maxMileage,
      registerIn,
      transmission,
      color,
      fuelType,
      assemblyIn,
      bodyType,
      modelCategory,
      dealerStatus,
    } = req.query;

    const offset = (page - 1) * limit;

    // -----------------------------
    // VEHICLE FILTERS
    // -----------------------------
    const vehicleWhere = {};

    // Helper function to parse array filters
    const parseArrayFilter = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.includes(",")) {
        return value.split(",").map((v) => v.trim());
      }
      return [value];
    };

    // Apply filters with array support
    if (keyword) vehicleWhere.name = { [Op.iLike]: `%${keyword}%` };

    // Handle array filters - use Op.in for multiple values
    const cityArray = parseArrayFilter(city);
    if (cityArray && cityArray.length > 0) {
      vehicleWhere.city = { [Op.in]: cityArray };
    }

    const provinceArray = parseArrayFilter(province);
    if (provinceArray && provinceArray.length > 0) {
      vehicleWhere.province = { [Op.in]: provinceArray };
    }

    const makeArray = parseArrayFilter(make);
    if (makeArray && makeArray.length > 0) {
      vehicleWhere.make = { [Op.in]: makeArray };
    }

    const registerInArray = parseArrayFilter(registerIn);
    if (registerInArray && registerInArray.length > 0) {
      vehicleWhere.registerIn = { [Op.in]: registerInArray };
    }

    const transmissionArray = parseArrayFilter(transmission);
    if (transmissionArray && transmissionArray.length > 0) {
      vehicleWhere.transmission = { [Op.in]: transmissionArray };
    }

    const colorArray = parseArrayFilter(color);
    if (colorArray && colorArray.length > 0) {
      vehicleWhere.color = { [Op.in]: colorArray };
    }

    const fuelTypeArray = parseArrayFilter(fuelType);
    if (fuelTypeArray && fuelTypeArray.length > 0) {
      vehicleWhere.fuelType = { [Op.in]: fuelTypeArray };
    }

    const assemblyInArray = parseArrayFilter(assemblyIn);
    if (assemblyInArray && assemblyInArray.length > 0) {
      vehicleWhere.assemblyIn = { [Op.in]: assemblyInArray };
    }

    const bodyTypeArray = parseArrayFilter(bodyType);
    if (bodyTypeArray && bodyTypeArray.length > 0) {
      vehicleWhere.bodyType = {
        [Op.or]: bodyTypeArray.map((bt) => ({ [Op.iLike]: bt })),
      };
    }

    const modelCategoryArray = parseArrayFilter(modelCategory);
    if (modelCategoryArray && modelCategoryArray.length > 0) {
      vehicleWhere.modelCategory = { [Op.in]: modelCategoryArray };
    }

    // Range filters
    if (minPrice && maxPrice) {
      vehicleWhere.price = { [Op.between]: [minPrice, maxPrice] };
    } else if (minPrice) {
      vehicleWhere.price = { [Op.gte]: minPrice };
    } else if (maxPrice) {
      vehicleWhere.price = { [Op.lte]: maxPrice };
    }

    if (minYear && maxYear) {
      vehicleWhere.model = { [Op.between]: [minYear, maxYear] };
    } else if (minYear) {
      vehicleWhere.model = { [Op.gte]: minYear };
    } else if (maxYear) {
      vehicleWhere.model = { [Op.lte]: maxYear };
    }

    if (minMileage && maxMileage) {
      vehicleWhere.mileage = { [Op.between]: [minMileage, maxMileage] };
    } else if (minMileage) {
      vehicleWhere.mileage = { [Op.gte]: minMileage };
    } else if (maxMileage) {
      vehicleWhere.mileage = { [Op.lte]: maxMileage };
    }

    // -----------------------------
    // DEALER FILTER
    // -----------------------------
    const dealerWhere = {};
    const dealerStatusArray = parseArrayFilter(dealerStatus);
    if (dealerStatusArray && dealerStatusArray.length > 0) {
      dealerWhere.status = { [Op.in]: dealerStatusArray };
    }

    // -----------------------------
    // SORT ORDER
    // -----------------------------
    const order =
      sort === "oldest" ? [["createdAt", "ASC"]] : [["createdAt", "DESC"]];

    // -----------------------------
    // MAIN QUERY
    // -----------------------------
    const query = {
      where: { adType: "featured" },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where:
            Object.keys(vehicleWhere).length > 0 ? vehicleWhere : undefined,
          required: true, // This ensures we only get ads with matching vehicles
        },
        {
          model: User,
          as: "dealer",
          attributes: ["id", "fullname", "email", "phone", "role", "image"],
          include: [
            {
              model: Dealer,
              as: "dealer",
              attributes: [
                "id",
                "location",
                "status",
                "image",
                "availableCarListing",
                "closingTime",
                "openingTime",
              ],
              where: Object.keys(dealerWhere).length ? dealerWhere : undefined,
              required: dealerStatusArray && dealerStatusArray.length > 0, // Only require if filter is applied
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order,
      distinct: true, // Important for correct count with includes
    };

    // -----------------------------
    // FETCH DATA WITH COUNT
    // -----------------------------
    const { rows: ads, count: filteredCount } =
      await Advertisement.findAndCountAll(query);

    // -----------------------------
    // TOTAL VEHICLES IN DATABASE
    // -----------------------------
    const totalVehicles = await Vehicle.count();

    // -----------------------------
    // AGGREGATION COUNTS (for filters) - ONLY FOR FEATURED ADS
    // -----------------------------
    const aggregateAttributes = [
      "city",
      "province",
      "make",
      "bodyType",
      "fuelType",
      "transmission",
      "color",
      "modelCategory",
    ];

    const aggregateData = {};
    for (const attr of aggregateAttributes) {
      const rows = await Vehicle.findAll({
        attributes: [
          [col(attr), attr],
          [fn("COUNT", col(attr)), "count"],
        ],
        include: [
          {
            model: Advertisement,
            as: "advertisement",
            attributes: [],
            where: { adType: "featured" },
            required: true,
          },
        ],
        group: [col(attr)],
        where: {
          [attr]: { [Op.ne]: null }, // exclude nulls
        },
        raw: true,
      });
      aggregateData[attr] = rows;
    }

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,
      message:
        ads.length > 0
          ? "Ads fetched successfully"
          : "No ads found matching your criteria",
      pagination: {
        totalFiltered: filteredCount,
        totalAllVehicles: totalVehicles,
        page: parseInt(page),
        perPage: parseInt(limit),
        totalPages: Math.ceil(filteredCount / limit),
        rangeText:
          filteredCount > 0
            ? `${offset + 1}-${Math.min(offset + parseInt(limit), filteredCount)} of ${filteredCount} vehicles`
            : "0 vehicles",
      },
      filterStats: aggregateData,
      data: ads || [],
    });
  } catch (error) {
    console.error(error);
    return json.errorResponse(res, error.message, 400);
  }
};

o.getSimilarAds = async function (req, res, next) {
  try {
    const { slug } = req.params;

    // Step 1: Find the vehicle by slug
    const vehicle = await Vehicle.findOne({ where: { slug } });
    if (!vehicle) return json.errorResponse(res, "Vehicle not found", 404);

    // Step 2: Fetch the ad for this vehicle
    const ad = await Advertisement.findOne({
      where: { vehicleId: vehicle.id },
      include: [
        { model: Vehicle, as: "vehicle" },
        {
          model: User,
          as: "dealer",
          attributes: ["id", "fullname", "email", "phone", "role", "image"],
          include: [
            {
              model: Dealer,
              as: "dealer",
              attributes: [
                "id",
                "location",
                "status",
                "image",
                "availableCarListing",
                "closingTime",
                "openingTime",
              ],
            },
          ],
        },
      ],
    });

    if (!ad)
      return json.errorResponse(res, "Ad not found for this vehicle", 404);

    // Step 3: First find similar vehicles - let's debug this
    const similarVehicles = await Vehicle.findAll({
      where: {
        make: { [Op.iLike]: `%${vehicle.make}%` }, // Use wildcard for partial matching
        id: { [Op.ne]: vehicle.id },
      },
      attributes: ["id", "make", "model", "name"], // Include more fields for debugging
      limit: 10,
    });

    const vehicleIds = similarVehicles.map((v) => v.id);

    // Step 4: Check if advertisements exist for these vehicles
    if (vehicleIds.length > 0) {
      // First, let's check how many ads exist for these vehicles
      const adCount = await Advertisement.count({
        where: {
          vehicleId: { [Op.in]: vehicleIds },
        },
      });
    }

    // Step 5: Then find ads for these vehicles
    const similarAds =
      vehicleIds.length > 0
        ? await Advertisement.findAll({
            where: {
              vehicleId: { [Op.in]: vehicleIds },
            },
            include: [
              {
                model: Vehicle,
                as: "vehicle",
                required: true,
              },
              {
                model: User,
                as: "dealer",
                required: false,
                attributes: [
                  "id",
                  "fullname",
                  "email",
                  "phone",
                  "role",
                  "image",
                ],
                include: [
                  {
                    model: Dealer,
                    as: "dealer",
                    required: false,
                    attributes: ["id", "location", "status", "image"],
                  },
                ],
              },
            ],
            limit: 3,
            order: [["createdAt", "DESC"]],
          })
        : [];

    return json.showAll(res, similarAds, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updateAdStatus = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { status, endDate } = req.body;

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
    if (status) {
      ad.status = status;
    }
    if (ad.endDate) {
      ad.endDate = endDate;
    }
    await ad.save();

    return json.successResponse(res, `Ad updated Successfully`, 200);
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

o.registerAdClick = async function (req, res, next) {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByPk(id);
    if (!ad) {
      return json.errorResponse(res, "Ad not found", 404);
    }
    ad.clicks = ad.clicks + 1;
    ad.views = ad.views + 1;
    await ad.save();
    return json.successResponse(res, "Ad click registered.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
