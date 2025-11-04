"use strict";

const path = require("path");
const cloudinary = require("../../../Traits/Cloudinary");
const csv = require("csv-parser");
const slugify = require("slugify");
const json = require("../../../Traits/ApiResponser"); // Your custom response helper
const db = require("../../../Models/index");
const { Op, where, Sequelize } = require("sequelize");
const Vehicle = db.Vehicle;
const Dealer = db.Dealer;
const Advertisement = db.Advertisement;
const User = db.User;
const Make = db.Make;
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
      price,
      city,
      province,
      make,
      model,
      modelCategory,
      mileage,
      doors,
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
      description,
      tags,
      condition,
      exteriorColor,
      fuelConsumption,
      year,
      drive,
      location,
    } = req.body;

    const { role, id } = req.decoded;

    // Authorization check
    if (role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    // Define all required fields based on model
    const requiredFields = [
      "name",
      "price",
      "city",
      "province",
      "make",
      "model",
      "mileage",
      "doors",
      "transmission",
      "fuelType",
      "registerIn",
      "assemblyIn",
      "bodyType",
      "color",
      "fuelConsumption",
      "engineCapacity",
      "interiorDetails",
      "exteriorDetails",
      "safetyFeatures",
      "specifications",
      "description",
      "condition",
      "exteriorColor",
      "year",
      "drive",
      "location",
    ];

    // Validate all required fields sequentially
    const validationError = validateRequiredFieldsSequentially(
      req.body,
      requiredFields
    );
    if (validationError) {
      return json.errorResponse(res, validationError, 400);
    }

    // Validate doors is an integer
    if (isNaN(parseInt(doors))) {
      return json.errorResponse(
        res,
        "Field 'doors' must be a valid number",
        400
      );
    }

    // Validate condition enum
    const validConditions = ["used", "new", "certified"];
    if (!validConditions.includes(condition)) {
      return json.errorResponse(
        res,
        `Field 'condition' must be one of: ${validConditions.join(", ")}`,
        400
      );
    }

    // Validate status enum
    const validStatuses = ["live", "draft", "sold"];
    if (status && !validStatuses.includes(status)) {
      return json.errorResponse(
        res,
        `Field 'status' must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    // Validate tags is an array
    if (tags && !Array.isArray(tags)) {
      return json.errorResponse(res, "Field 'tags' must be an array", 400);
    }

    // Validate JSON fields
    const jsonFields = [
      "interiorDetails",
      "exteriorDetails",
      "safetyFeatures",
      "specifications",
    ];
    for (const field of jsonFields) {
      if (req.body[field]) {
        try {
          if (typeof req.body[field] === "string") {
            JSON.parse(req.body[field]);
          } else if (!isValidObject(req.body[field])) {
            return json.errorResponse(
              res,
              `Field '${field}' must be a valid JSON object`,
              400
            );
          }
        } catch (e) {
          return json.errorResponse(
            res,
            `Field '${field}' must be valid JSON`,
            400
          );
        }
      }
    }

    // Handle uploaded files from req.files and upload to Cloudinary
    const finalImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            {
              resource_type: "image",
              folder: "vehicles",
            }
          );
          // Only push the URL string
          if (result && typeof result.secure_url === "string") {
            finalImages.push(result.secure_url);
          }
        } catch (error) {
          return json.errorResponse(
            res,
            `Image upload failed: ${error.message || error}`,
            400
          );
        }
      }
    }

    // Validate images
    if (finalImages.length === 0) {
      return json.errorResponse(
        res,
        'Field "images" must have at least one image',
        400
      );
    }

    // Generate slug from name
    let slug = slugify(
      `${name}-${model}-${color}-${mileage}-${transmission}-${fuelType}-${registerIn}-${bodyType}-${engineCapacity}-${assemblyIn}-${Date.now()}`,
      { lower: true }
    );

    // Check if slug already exists
    const existingVehicle = await Vehicle.findOne({ where: { slug } });
    if (existingVehicle) {
      slug = slug + "-" + Date.now();
    }

    // Create vehicle record with all fields
    const vehicle = await Vehicle.create({
      dealerId: id,
      name,
      slug,
      images: finalImages,
      price,
      city,
      province,
      make,
      model,
      modelCategory,
      mileage,
      doors: parseInt(doors),
      transmission,
      fuelType,
      registerIn,
      fuelConsumption,
      assemblyIn,
      bodyType,
      color,
      engineCapacity,
      interiorDetails:
        typeof interiorDetails === "string"
          ? JSON.parse(interiorDetails)
          : interiorDetails,
      exteriorDetails:
        typeof exteriorDetails === "string"
          ? JSON.parse(exteriorDetails)
          : exteriorDetails,
      safetyFeatures:
        typeof safetyFeatures === "string"
          ? JSON.parse(safetyFeatures)
          : safetyFeatures,
      specifications:
        typeof specifications === "string"
          ? JSON.parse(specifications)
          : specifications,
      status: status || "live",
      description,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
      condition,
      exteriorColor,
      year,
      drive,
      location,
    });

    return json.showOne(res, vehicle, 200);
  } catch (error) {
    console.error("addVehicle Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.bulkUploadVehicles = async function (req, res, next) {
  try {
    const { role, id } = req.decoded;

    // Authorization check
    if (role !== "dealer") {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    if (!req.file) {
      return json.errorResponse(res, "CSV file is required", 400);
    }

    const filePath = path.resolve(req.file.path);
    const vehicles = [];
    const errors = [];
    const validConditions = ["used", "new", "certified"];
    const validStatuses = ["live", "draft", "sold"];

    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          try {
            // Basic validation for required fields
            const requiredFields = [
              "name",
              "price",
              "city",
              "province",
              "make",
              "model",
              "modelCategory",
              "mileage",
              "doors",
              "transmission",
              "fuelType",
              "registerIn",
              "assemblyIn",
              "bodyType",
              "color",
              "engineCapacity",
              "condition",
              "exteriorColor",
              "year",
              "drive",
              "location",
            ];

            const missingField = validateRequiredFieldsSequentially(
              row,
              requiredFields
            );
            if (missingField) {
              errors.push({ row, error: `Missing field: ${missingField}` });
              return;
            }

            // Validate enums
            if (row.condition && !validConditions.includes(row.condition)) {
              errors.push({
                row,
                error: `Invalid condition '${row.condition}'`,
              });
              return;
            }

            if (row.status && !validStatuses.includes(row.status)) {
              errors.push({
                row,
                error: `Invalid status '${row.status}'`,
              });
              return;
            }

            // Parse and validate fields
            const parsedVehicle = {
              dealerId: id,
              name: row.name,
              slug: slugify(
                `${row.name}-${row.model}-${row.color}-${row.mileage}-${Date.now()}`,
                { lower: true }
              ),
              images: row.images,
              price: row.price,
              city: row.city,
              province: row.province,
              make: row.make,
              model: row.model,
              modelCategory: row.modelCategory,
              mileage: row.mileage,
              doors: parseInt(row.doors, 10) || 0,
              transmission: row.transmission,
              fuelType: row.fuelType,
              registerIn: row.registerIn,
              assemblyIn: row.assemblyIn,
              bodyType: row.bodyType,
              color: row.color,
              status: "draft",
              engineCapacity: row.engineCapacity,
              interiorDetails: row.interiorDetails
                ? JSON.parse(row.interiorDetails)
                : null,
              exteriorDetails: row.exteriorDetails
                ? JSON.parse(row.exteriorDetails)
                : null,
              safetyFeatures: row.safetyFeatures
                ? JSON.parse(row.safetyFeatures)
                : null,
              specifications: row.specifications
                ? JSON.parse(row.specifications)
                : null,
              description: row.description || "",
              tags: row.tags ? row.tags.split("|") : [],
              condition: row.condition || "used",
              exteriorColor: row.exteriorColor,
              year: row.year,
              drive: row.drive,
              location: row.location,
            };

            vehicles.push(parsedVehicle);
          } catch (err) {
            errors.push({ row, error: err.message });
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Cleanup CSV file
    fs.unlinkSync(filePath);

    if (vehicles.length === 0) {
      return json.errorResponse(
        res,
        errors.length
          ? `No valid rows. Found ${errors.length} invalid rows.`
          : "CSV file is empty or invalid",
        400
      );
    }

    // Bulk create vehicles
    const createdVehicles = await Vehicle.bulkCreate(vehicles, {
      validate: true,
    });

    return json.showAll(res, {
      created: createdVehicles.length,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    console.error("uploadVehiclesFromCSV Error:", error);
    return json.errorResponse(res, error.message || error, 400);
  }
};

// Helper function to validate required fields
function validateRequiredFieldsSequentially(data, requiredFields) {
  for (const field of requiredFields) {
    if (
      !data[field] ||
      (typeof data[field] === "string" && data[field].trim() === "") ||
      (Array.isArray(data[field]) && data[field].length === 0)
    ) {
      return `Field '${field}' is required and cannot be empty`;
    }
  }
  return null;
}

// Helper function to check if value is valid object
function isValidObject(obj) {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

o.getVehicleDetails = async function (req, res, next) {
  try {
    const { slug } = req.params;
    const vehicle = await Vehicle.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: "user", // must match Vehicle.belongsTo alias
          include: [
            {
              model: Dealer,
              as: "dealer", // matches User.hasOne alias
            },
          ],
        },
      ],
    });

    if (!vehicle) {
      return json.errorResponse(res, "Vehicle Not Found", 404);
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

    const vehicle = await Vehicle.findOne({
      where: { id, dealerId },
    });

    if (!vehicle) {
      return json.errorResponse(
        res,
        "Vehicle not found or unauthorized access.",
        404
      );
    }

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
      ...req.body,
    };

    // Log incoming image data for debugging
    console.log("updateVehicle: req.files:", req.files);
    console.log("updateVehicle: req.body.images:", req.body.images);
    console.log(
      "updateVehicle: req.body.existingImages:",
      req.body.existingImages
    );
    // Handle uploaded files from req.files and upload to Cloudinary
    let finalImages = [];
    // Parse existing image URLs from req.body.existingImages
    if (req.body.existingImages) {
      try {
        const existing = JSON.parse(req.body.existingImages);
        if (Array.isArray(existing)) {
          finalImages = existing.filter((url) => typeof url === "string");
        }
      } catch (e) {
        console.error("Failed to parse existingImages:", e);
      }
    }
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          console.log("Uploading file to Cloudinary:", {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
          const result = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            {
              resource_type: "image",
              folder: "vehicles",
              timeout: 60000, // 60 seconds
            }
          );
          // Only push the URL string
          if (result && typeof result.secure_url === "string") {
            finalImages.push(result.secure_url);
          }
        } catch (error) {
          let errorMsg = "";
          if (error.message) {
            errorMsg = error.message;
          } else if (typeof error === "object") {
            errorMsg = JSON.stringify(error);
          } else {
            errorMsg = String(error);
          }
          console.error("Cloudinary upload error:", error);
          return json.errorResponse(
            res,
            `Image upload failed: ${errorMsg}`,
            400
          );
        }
      }
      console.log("updateVehicle: finalImages:", finalImages);
      updatedData.images = finalImages;
    } else if (finalImages.length > 0) {
      updatedData.images = finalImages;
    } else if (req.body.images) {
      // If images are sent in body, ensure it's an array of strings
      if (Array.isArray(req.body.images)) {
        updatedData.images = req.body.images.filter(
          (img) => typeof img === "string"
        );
      } else if (typeof req.body.images === "string") {
        try {
          const parsed = JSON.parse(req.body.images);
          updatedData.images = Array.isArray(parsed)
            ? parsed.filter((img) => typeof img === "string")
            : [parsed].filter((img) => typeof img === "string");
        } catch {
          updatedData.images = [req.body.images];
        }
      } else {
        updatedData.images = [req.body.images].filter(
          (img) => typeof img === "string"
        );
      }
    }

    // Only regenerate slug if key fields changed
    const slugFields = [
      updatedData.name,
      updatedData.model,
      updatedData.year,
      updatedData.make,
    ]
      .filter((f) => f != null)
      .join("-");

    if (slugFields) {
      updatedData.slug = slugify(slugFields, { lower: true });
    } else {
      // Fallback: keep existing slug or generate from ID
      updatedData.slug =
        vehicle.slug || slugify(`vehicle-${id}`, { lower: true });
    }

    await vehicle.update(updatedData);
    return json.successResponse(res, "Vehicle updated successfully.", 200);
  } catch (error) {
    console.error("Update error:", error);
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
    const dealerId = req.decoded.id;

    // Find vehicle by ID
    const vehicle = await Vehicle.findByPk(id);

    // Check if vehicle exists
    if (!vehicle) {
      return json.errorResponse(res, "Vehicle not found", 404);
    }

    // Check if the vehicle belongs to the authenticated dealer
    if (vehicle.dealerId !== dealerId) {
      return json.errorResponse(res, "Unauthorized access", 401);
    }

    // Check if the vehicle is linked to any live advertisement
    const advertisement = await Advertisement.findOne({
      where: { vehicleId: id },
    });

    if (advertisement) {
      return json.errorResponse(
        res,
        "This vehicle has a live ad and cannot be deleted.",
        400
      );
    }

    // Delete all notifications related to test drive requests for this vehicle
    const TestDriveRequest = db.TestDriveRequest;
    const Notification = db.Notification || db.Notifications;
    const testDriveRequests = await TestDriveRequest.findAll({
      where: { vehicleId: id },
    });
    if (testDriveRequests && testDriveRequests.length > 0 && Notification) {
      const testDriveRequestIds = testDriveRequests.map((r) => r.id);
      await Notification.destroy({
        where: { testDriveRequestId: testDriveRequestIds },
      });
    }

    // Delete all test drive requests for this vehicle
    await TestDriveRequest.destroy({ where: { vehicleId: id } });

    // Delete vehicle if no active ad exists
    await Vehicle.destroy({ where: { id } });

    return json.successResponse(res, "Vehicle deleted successfully.", 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getModelsByMake = async function (req, res, next) {
  try {
    const { make } = req.params;

    // Validate make parameter
    if (!make || make.trim() === "") {
      return json.errorResponse(res, "Make name is required", 400);
    }

    // Find all models for the given make (case-insensitive)
    const models = await Make.findAll({
      where: {
        make: {
          [Op.iLike]: make, // ✅ use make, not makeName
        },
      },
      attributes: ["id", "make", "model"],
      order: [["model", "ASC"]],
      raw: true,
    });

    // Check if models exist
    if (models.length === 0) {
      return json.errorResponse(res, `No models found for make: ${make}`, 404);
    }

    // Prepare response data
    const responseData = {
      make: models[0].make,
      totalModels: models.length,
      models: models.map((m) => ({
        id: m.id,
        model: m.model,
      })),
    };

    return json.successResponse(res, models, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

o.getAllMakes = async function (req, res, next) {
  try {
    const makes = await Make.findAll({
      attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("make")), "make"]],
      raw: true,
    });

    // Extract only the 'make' values into a plain array and sort alphabetically
    const responseData = makes
      .map((item) => item.make)
      .sort((a, b) => {
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      });

    return json.successResponse(res, responseData, 200);
  } catch (error) {
    return json.errorResponse(res, error.message || error, 400);
  }
};

module.exports = o;
