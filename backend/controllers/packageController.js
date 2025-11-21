const TourPackage = require("../models/TourPackage");

// Get all active packages
exports.getAllPackages = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, duration, location } = req.query;

    // Log received query parameters for debugging
    console.log("Package filters received:", {
      category,
      minPrice,
      maxPrice,
      duration,
      location,
    });

    // Build filter object
    const filter = { isActive: true };

    // Category filter - only apply if not empty (case-insensitive)
    if (category && category.trim() !== "") {
      // Use case-insensitive regex for category matching
      filter.category = { $regex: new RegExp(`^${category.trim()}$`, "i") };
      console.log("Applied category filter:", filter.category);
    }

    // Price range filter - only apply if values are provided and valid
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice && minPrice !== "" && !isNaN(Number(minPrice))) {
        filter.price.$gte = Number(minPrice);
        console.log("Applied minPrice filter:", filter.price.$gte);
      }
      if (maxPrice && maxPrice !== "" && !isNaN(Number(maxPrice))) {
        filter.price.$lte = Number(maxPrice);
        console.log("Applied maxPrice filter:", filter.price.$lte);
      }
      // Only add price filter if at least one condition is set
      if (Object.keys(filter.price).length === 0) {
        delete filter.price;
      }
    }

    // Duration filter
    if (duration && duration !== "" && !isNaN(Number(duration))) {
      filter.duration = Number(duration);
      console.log("Applied duration filter:", filter.duration);
    }

    // Location filter - case-insensitive search
    if (location && location.trim() !== "") {
      filter.location = { $regex: location.trim(), $options: "i" };
      console.log("Applied location filter:", filter.location);
    }

    console.log("Final filter object:", JSON.stringify(filter, null, 2));

    // Aggregate package popularity by counting related bookings (exclude cancelled)
    const packages = await TourPackage.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "bookings",
          let: { packageId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$tourPackageId", "$$packageId"] } } },
            { $match: { status: { $ne: "cancelled" } } },
            { $count: "count" },
          ],
          as: "bookingStats",
        },
      },
      {
        $addFields: {
          bookingsCount: {
            $ifNull: [{ $arrayElemAt: ["$bookingStats.count", 0] }, 0],
          },
        },
      },
      { $sort: { bookingsCount: -1, createdAt: -1 } },
      { $project: { bookingStats: 0, __v: 0 } },
    ]);

    res.json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (error) {
    console.error("Get packages error:", error);
    res.status(500).json({
      message: "Failed to retrieve packages",
      error: "SERVER_ERROR",
    });
  }
};

// Get single package by ID
exports.getPackageById = async (req, res) => {
  try {
    const package = await TourPackage.findById(req.params.id).select("-__v");

    if (!package) {
      return res.status(404).json({
        message: "Package not found",
        error: "NOT_FOUND",
      });
    }

    if (!package.isActive) {
      return res.status(404).json({
        message: "Package is no longer available",
        error: "INACTIVE_PACKAGE",
      });
    }

    res.json({
      success: true,
      data: package,
    });
  } catch (error) {
    console.error("Get package error:", error);
    res.status(500).json({
      message: "Failed to retrieve package",
      error: "SERVER_ERROR",
    });
  }
};

// Create new package (Admin only)
exports.createPackage = async (req, res) => {
  try {
    const packageData = {
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      duration: Number(req.body.duration),
      price: Number(req.body.price),
      location: req.body.location.trim(),
      maxGroupSize: Number(req.body.maxGroupSize),
      availableSpots: Number(req.body.availableSpots),
      category: req.body.category || "destinations",
      imageUrl: req.body.imageUrl || "",
      itinerary: req.body.itinerary || [],
      included: req.body.included || [],
      excluded: req.body.excluded || [],
    };

    const package = new TourPackage(packageData);
    await package.save();

    console.log(
      `Package created: ${package.title} by admin: ${req.user.email}`
    );

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: package,
    });
  } catch (error) {
    console.error("Create package error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    res.status(500).json({
      message: "Failed to create package",
      error: "SERVER_ERROR",
    });
  }
};

// Update package (Admin only)
exports.updatePackage = async (req, res) => {
  try {
    const updateData = {};

    // Only update provided fields
    if (req.body.title) updateData.title = req.body.title.trim();
    if (req.body.description)
      updateData.description = req.body.description.trim();
    if (req.body.duration) updateData.duration = Number(req.body.duration);
    if (req.body.price) updateData.price = Number(req.body.price);
    if (req.body.location) updateData.location = req.body.location.trim();
    if (req.body.maxGroupSize)
      updateData.maxGroupSize = Number(req.body.maxGroupSize);
    if (req.body.availableSpots !== undefined)
      updateData.availableSpots = Number(req.body.availableSpots);
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.imageUrl !== undefined)
      updateData.imageUrl = req.body.imageUrl;
    if (req.body.itinerary) updateData.itinerary = req.body.itinerary;
    if (req.body.included) updateData.included = req.body.included;
    if (req.body.excluded) updateData.excluded = req.body.excluded;
    if (req.body.isActive !== undefined)
      updateData.isActive = req.body.isActive;

    const package = await TourPackage.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({
        message: "Package not found",
        error: "NOT_FOUND",
      });
    }

    console.log(
      `Package updated: ${package.title} by admin: ${req.user.email}`
    );

    res.json({
      success: true,
      message: "Package updated successfully",
      data: package,
    });
  } catch (error) {
    console.error("Update package error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    res.status(500).json({
      message: "Failed to update package",
      error: "SERVER_ERROR",
    });
  }
};

// Delete package (Admin only) - Soft delete
exports.deletePackage = async (req, res) => {
  try {
    const package = await TourPackage.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!package) {
      return res.status(404).json({
        message: "Package not found",
        error: "NOT_FOUND",
      });
    }

    console.log(
      `Package deleted: ${package.title} by admin: ${req.user.email}`
    );

    res.json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (error) {
    console.error("Delete package error:", error);
    res.status(500).json({
      message: "Failed to delete package",
      error: "SERVER_ERROR",
    });
  }
};
