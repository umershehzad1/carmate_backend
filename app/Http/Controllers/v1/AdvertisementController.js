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
    const limit = parseInt(req.query.limit, 100) || 100;
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

    const cityArray = parseArrayFilter(city);
    if (cityArray?.length) vehicleWhere.city = { [Op.in]: cityArray };

    const provinceArray = parseArrayFilter(province);
    if (provinceArray?.length)
      vehicleWhere.province = { [Op.in]: provinceArray };

    const makeArray = parseArrayFilter(make);
    if (makeArray?.length) vehicleWhere.make = { [Op.in]: makeArray };

    const registerInArray = parseArrayFilter(registerIn);
    if (registerInArray?.length)
      vehicleWhere.registerIn = { [Op.in]: registerInArray };

    const transmissionArray = parseArrayFilter(transmission);
    if (transmissionArray?.length)
      vehicleWhere.transmission = { [Op.in]: transmissionArray };

    const colorArray = parseArrayFilter(color);
    if (colorArray?.length) vehicleWhere.color = { [Op.in]: colorArray };

    const fuelTypeArray = parseArrayFilter(fuelType);
    if (fuelTypeArray?.length)
      vehicleWhere.fuelType = { [Op.in]: fuelTypeArray };

    const assemblyInArray = parseArrayFilter(assemblyIn);
    if (assemblyInArray?.length)
      vehicleWhere.assemblyIn = { [Op.in]: assemblyInArray };

    const bodyTypeArray = parseArrayFilter(bodyType);
    if (bodyTypeArray?.length)
      vehicleWhere.bodyType = { [Op.in]: bodyTypeArray };

    // Range filters
    if (minPrice && maxPrice)
      vehicleWhere.price = { [Op.between]: [minPrice, maxPrice] };
    else if (minPrice) vehicleWhere.price = { [Op.gte]: minPrice };
    else if (maxPrice) vehicleWhere.price = { [Op.lte]: maxPrice };

    if (minYear && maxYear)
      vehicleWhere.model = { [Op.between]: [minYear, maxYear] };
    else if (minYear) vehicleWhere.model = { [Op.gte]: minYear };
    else if (maxYear) vehicleWhere.model = { [Op.lte]: maxYear };

    if (minMileage && maxMileage)
      vehicleWhere.mileage = { [Op.between]: [minMileage, maxMileage] };
    else if (minMileage) vehicleWhere.mileage = { [Op.gte]: minMileage };
    else if (maxMileage) vehicleWhere.mileage = { [Op.lte]: maxMileage };

    // -----------------------------
    // DEALER FILTER
    // -----------------------------
    const dealerWhere = {};
    const dealerStatusArray = parseArrayFilter(dealerStatus);
    if (dealerStatusArray?.length)
      dealerWhere.status = { [Op.in]: dealerStatusArray };

    // -----------------------------
    // SORT ORDER
    // -----------------------------
    const order =
      sort === "oldest" ? [["createdAt", "ASC"]] : [["createdAt", "DESC"]];

    // -----------------------------
    // MAIN QUERY
    // -----------------------------
    const adWhere = {
      status: "running", // ✅ Only include ads that are running
    };

    if (adType) adWhere.adType = adType;

    const query = {
      where: adWhere,
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where: Object.keys(vehicleWhere).length ? vehicleWhere : undefined,
          required: true,
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
              required: dealerStatusArray?.length > 0,
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order,
      distinct: true,
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
        where: { [attr]: { [Op.ne]: null } },
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
          ? "Running ads fetched successfully"
          : "No running ads found matching your criteria",
      pagination: {
        totalFiltered: filteredCount,
        totalAllVehicles: totalVehicles,
        page: parseInt(page),
        perPage: parseInt(limit),
        totalPages: Math.ceil(filteredCount / limit),
        rangeText:
          filteredCount > 0
            ? `${offset + 1}-${Math.min(offset + parseInt(limit), filteredCount)} of ${filteredCount} running ads`
            : "0 running ads",
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

    // Helper to parse array filters
    const parseArrayFilter = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.includes(",")) {
        return value.split(",").map((v) => v.trim());
      }
      return [value];
    };

    // Keyword search
    if (keyword) vehicleWhere.name = { [Op.iLike]: `%${keyword}%` };

    // Array-based filters
    const cityArray = parseArrayFilter(city);
    if (cityArray?.length) vehicleWhere.city = { [Op.in]: cityArray };

    const provinceArray = parseArrayFilter(province);
    if (provinceArray?.length)
      vehicleWhere.province = { [Op.in]: provinceArray };

    const makeArray = parseArrayFilter(make);
    if (makeArray?.length) vehicleWhere.make = { [Op.in]: makeArray };

    const registerInArray = parseArrayFilter(registerIn);
    if (registerInArray?.length)
      vehicleWhere.registerIn = { [Op.in]: registerInArray };

    const transmissionArray = parseArrayFilter(transmission);
    if (transmissionArray?.length)
      vehicleWhere.transmission = { [Op.in]: transmissionArray };

    const colorArray = parseArrayFilter(color);
    if (colorArray?.length) vehicleWhere.color = { [Op.in]: colorArray };

    const fuelTypeArray = parseArrayFilter(fuelType);
    if (fuelTypeArray?.length)
      vehicleWhere.fuelType = { [Op.in]: fuelTypeArray };

    const assemblyInArray = parseArrayFilter(assemblyIn);
    if (assemblyInArray?.length)
      vehicleWhere.assemblyIn = { [Op.in]: assemblyInArray };

    const bodyTypeArray = parseArrayFilter(bodyType);
    if (bodyTypeArray?.length) {
      vehicleWhere.bodyType = {
        [Op.or]: bodyTypeArray.map((bt) => ({ [Op.iLike]: bt })),
      };
    }

    const modelCategoryArray = parseArrayFilter(modelCategory);
    if (modelCategoryArray?.length)
      vehicleWhere.modelCategory = { [Op.in]: modelCategoryArray };

    // Range filters
    if (minPrice && maxPrice)
      vehicleWhere.price = { [Op.between]: [minPrice, maxPrice] };
    else if (minPrice) vehicleWhere.price = { [Op.gte]: minPrice };
    else if (maxPrice) vehicleWhere.price = { [Op.lte]: maxPrice };

    if (minYear && maxYear)
      vehicleWhere.model = { [Op.between]: [minYear, maxYear] };
    else if (minYear) vehicleWhere.model = { [Op.gte]: minYear };
    else if (maxYear) vehicleWhere.model = { [Op.lte]: maxYear };

    if (minMileage && maxMileage)
      vehicleWhere.mileage = { [Op.between]: [minMileage, maxMileage] };
    else if (minMileage) vehicleWhere.mileage = { [Op.gte]: minMileage };
    else if (maxMileage) vehicleWhere.mileage = { [Op.lte]: maxMileage };

    // -----------------------------
    // DEALER FILTER
    // -----------------------------
    const dealerWhere = {};
    const dealerStatusArray = parseArrayFilter(dealerStatus);
    if (dealerStatusArray?.length)
      dealerWhere.status = { [Op.in]: dealerStatusArray };

    // -----------------------------
    // SORT ORDER
    // -----------------------------
    const order =
      sort === "oldest" ? [["createdAt", "ASC"]] : [["createdAt", "DESC"]];

    // -----------------------------
    // MAIN QUERY
    // -----------------------------
    const query = {
      where: {
        adType: "featured",
        status: "running", // ✅ Only include running featured ads
      },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          where: Object.keys(vehicleWhere).length ? vehicleWhere : undefined,
          required: true,
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
              required: dealerStatusArray?.length > 0,
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order,
      distinct: true,
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
    // AGGREGATION COUNTS (for filters) - ONLY FOR RUNNING FEATURED ADS
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
            where: { adType: "featured", status: "running" }, // ✅ Only count running featured ads
            required: true,
          },
        ],
        group: [col(attr)],
        where: { [attr]: { [Op.ne]: null } },
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
          ? "Running featured ads fetched successfully"
          : "No running featured ads found matching your criteria",
      pagination: {
        totalFiltered: filteredCount,
        totalAllVehicles: totalVehicles,
        page: parseInt(page),
        perPage: parseInt(limit),
        totalPages: Math.ceil(filteredCount / limit),
        rangeText:
          filteredCount > 0
            ? `${offset + 1}-${Math.min(offset + parseInt(limit), filteredCount)} of ${filteredCount} running featured ads`
            : "0 running featured ads",
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
          include: [
            {
              model: Dealer,
              as: "dealer",
            },
          ],
        },
      ],
    });

    if (!ad)
      return json.errorResponse(res, "Ad not found for this vehicle", 404);

    // Step 3: Find vehicles with the same make & model, excluding the current one
    const similarVehicles = await Vehicle.findAll({
      where: {
        make: { [Op.iLike]: vehicle.make },
        model: { [Op.iLike]: vehicle.model },
        id: { [Op.ne]: vehicle.id },
      },
      limit: 10,
    });

    const vehicleIds = similarVehicles.map((v) => v.id);

    // Step 4: Fetch ads for similar vehicles
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

                include: [
                  {
                    model: Dealer,
                    as: "dealer",
                    required: false,
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

o.getDealerStats = async function (req, res, next) {
  try {
    const dealerId = req.decoded.id;

    // Fetch all advertisements belonging to this dealer
    const ads = await Advertisement.findAll({
      where: { dealerId },
      attributes: ["id", "clicks", "leads", "views", "createdAt", "updatedAt"],
    });

    if (!ads || ads.length === 0) {
      return json.successResponse(res, {
        totalAds: 0,
        totalClicks: 0,
        totalLeads: 0,
        totalViews: 0,
        conversionRate: 0,
        weeklyData: generateEmptyWeeklyData(),
      });
    }

    // Aggregate statistics
    const totalAds = ads.length;
    const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const totalLeads = ads.reduce((sum, ad) => sum + (ad.leads || 0), 0);
    const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);

    // Calculate conversion rate
    const conversionRate =
      totalClicks > 0
        ? parseFloat(((totalLeads / totalClicks) * 100).toFixed(2))
        : 0;

    // Generate last 7 days weekly data
    const weeklyData = generateWeeklyData(ads);

    // Return result
    return json.successResponse(res, {
      totalAds,
      totalClicks,
      totalLeads,
      totalViews,
      conversionRate,
      weeklyData,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

// Helper function to generate empty weekly data
function generateEmptyWeeklyData() {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][date.getDay()];

    data.push({
      date: date.toISOString().split("T")[0],
      day: dayName.substring(0, 3).toUpperCase(),
      clicks: 0,
      leads: 0,
      views: 0,
      conversionRate: 0,
    });
  }
  return data;
}

// Helper function to generate weekly data from advertisements
function generateWeeklyData(ads) {
  const weeklyMap = {};

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split("T")[0];
    const dayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][date.getDay()];

    weeklyMap[dateString] = {
      date: dateString,
      day: dayName.substring(0, 3).toUpperCase(),
      clicks: 0,
      leads: 0,
      views: 0,
      conversionRate: 0,
    };
  }

  // Process each advertisement
  ads.forEach((ad) => {
    const adDate = new Date(ad.updatedAt).toISOString().split("T")[0];

    // Only include if within last 7 days
    if (weeklyMap[adDate]) {
      weeklyMap[adDate].clicks += ad.clicks || 0;
      weeklyMap[adDate].leads += ad.leads || 0;
      weeklyMap[adDate].views += ad.views || 0;
    }
  });

  // Calculate conversion rates and convert to array
  const weeklyData = Object.values(weeklyMap).map((day) => ({
    ...day,
    conversionRate:
      day.clicks > 0
        ? parseFloat(((day.leads / day.clicks) * 100).toFixed(2))
        : 0,
  }));

  return weeklyData;
}

module.exports = o;
