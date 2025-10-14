"use strict";

const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where } = require("sequelize");
const Vehicle = db.Vehicle;
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

o.addVehicle = async function (req, res, next) {
  try {
    const {
      name,
      model,
      mileage,
      transmission,
      fuelType,
      registerIn,
      assemblyIn,
      bodyType,
      color,
      engineCapacity,
      interiorDetails,
      exteriorDetails,
      safetyFeatures,
      specifications,
      status,
    } = req.body;

    const { role, id } = req.decoded;
    if (role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    const requiredFields = [
      "name",
      "model",
      "mileage",
      "transmission",
      "fuelType",
      "registerIn",
      "assemblyIn",
      "bodyType",
      "color",
      "engineCapacity",
      "interiorDetails",
      "exteriorDetails",
      "safetyFeatures",
      "specifications",
    ];

    // Validate fields sequentially
    validateRequiredFieldsSequentially(req.body, requiredFields);

    // Handle uploaded files from req.files
    const finalImages = [];
    if (req.files && req.files.length > 0) {
      const destination = path.join(__dirname, "../../../public/uploads/");
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
      }

      req.files.forEach((file) => {
        const extension = path.extname(file.originalname) || ".jpg";
        const filename =
          Date.now() + "-" + Math.round(Math.random() * 1e9) + extension;
        fs.writeFileSync(destination + filename, file.buffer);

        const serverAddress = req.protocol + "://" + req.headers.host + "/";
        finalImages.push(serverAddress + "public/uploads/" + filename);
      });
    }

    if (finalImages.length === 0) {
      return json.errorResponse(
        res,
        'Field "images" must have at least one image',
        400
      );
    }

    // Generate slug from name
    let slug = slugify(
      `${name}-${model}-${color}-${mileage}-${transmission}-${fuelType}-${registerIn}-${bodyType}-${engineCapacity}-${assemblyIn}`,
      { lower: true }
    );

    // Create vehicle record
    console.log("dealerId", id);

    const vehicle = await Vehicle.create({
      dealerId: id,
      name,
      slug,
      model,
      mileage,
      transmission,
      fuelType,
      registerIn,
      assemblyIn,
      bodyType,
      color,
      engineCapacity,
      interiorDetails,
      exteriorDetails,
      safetyFeatures,
      specifications,
      images: finalImages,
      status,
    });

    return json.showOne(res, vehicle, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getVehicleDetails = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const vehicle = await Vehicle.findOne({
      where: { slug: slug },
    });

    if (!vehicle) {
      return json.errorResponse(res, "Vehicle Not Fount", 404);
    }
    return json.showOne(res, vehicle, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.updateVehicle = async function (req, res) {
  try {
    const { id } = req.params;
    const dealerId = req.decoded.id;

    // Find the vehicle by ID and dealerId (to ensure ownership)
    const vehicle = await Vehicle.findOne({
      where: {
        id,
        dealerId,
      },
    });

    if (!vehicle) {
      return json.errorResponse(
        res,
        "Vehicle not found or unauthorized access.",
        404
      );
    }

    // Merge old and new fields
    const updatedData = {
      name: req.body.name || vehicle.name,
      model: req.body.model || vehicle.model,
      color: req.body.color || vehicle.color,
      mileage: req.body.mileage || vehicle.mileage,
      transmission: req.body.transmission || vehicle.transmission,
      fuelType: req.body.fuelType || vehicle.fuelType,
      registerIn: req.body.registerIn || vehicle.registerIn,
      bodyType: req.body.bodyType || vehicle.bodyType,
      engineCapacity: req.body.engineCapacity || vehicle.engineCapacity,
      assemblyIn: req.body.assemblyIn || vehicle.assemblyIn,
      make: req.body.make || vehicle.make,
      year: req.body.year || vehicle.year,
      price: req.body.price || vehicle.price,
      ...req.body, // include other optional fields
    };

    // Regenerate slug based on updated fields
    updatedData.slug = slugify(
      `${updatedData.name}-${updatedData.model}-${updatedData.color}-${updatedData.mileage}-${updatedData.transmission}-${updatedData.fuelType}-${updatedData.registerIn}-${updatedData.bodyType}-${updatedData.engineCapacity}-${updatedData.assemblyIn}`,
      { lower: true }
    );

    // Update the vehicle
    await vehicle.update(updatedData);

    return json.successResponse(res, "Vehicle updated successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getDealerVehicles = async function (req, res, next) {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Only dealers can access their own vehicles
    if (req.decoded.role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    // Fetch dealer’s vehicles with pagination and optional status filter
    const where = { dealerId: req.decoded.id };
    if (status) where.status = status;

    const { rows: vehicles, count: total } = await Vehicle.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["createdAt", "DESC"]],
    });

    if (!vehicles || vehicles.length === 0) {
      return json.errorResponse(res, "Vehicles not found", 404);
    }

    const totalPages = Math.ceil(total / limit);

    return json.successResponse(res, {
      currentPage: parseInt(page),
      totalPages,
      totalRecords: total,
      vehicles,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllVehicles = async function (req, res) {
  try {
    const { page = 1, limit = 10, search, ...filters } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters dynamically for given fields
    const filterableFields = [
      "price",
      "city",
      "make",
      "model",
      "mileage",
      "transmission",
      "fuelType",
      "registerIn",
      "assemblyIn",
      "bodyType",
      "color",
      "engineCapacity",
    ];

    // Loop through and add filters if provided
    for (const field of filterableFields) {
      if (filters[field]) {
        where[field] = {
          [Op.iLike]: `%${filters[field]}%`, // case-insensitive partial match
        };
      }
    }

    // Search functionality (across multiple key fields)
    if (search) {
      where[Op.or] = [
        { slug: { [Op.iLike]: `%${search}%` } }, // Added slug search
      ];
    }

    // Fetch data with pagination
    const { rows: vehicles, count: total } = await Vehicle.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(total / limit);

    return json.successResponse(res, {
      currentPage: parseInt(page),
      totalPages,
      totalRecords: total,
      vehicles,
    });
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.deleteVehicle = async function (req, res, next) {
  try {
    const { id } = req.params;
    const vehicle = await Vehicle.findByPk(id);
    const dealerId = req.decoded.id;
    if (vehicle.dealerId !== dealerId) {
      return json.errorResponse(res, "Unauthorized access", 401);
    }
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }
    await Vehicle.destroy({ where: { id } });

    return json.successResponse(res, "Vehicle deleted successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
