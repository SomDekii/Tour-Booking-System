/**
 * Migration script to add category field to existing packages
 * Run this once to update existing packages with a default category
 */

const mongoose = require("mongoose");
require("dotenv").config();

const TourPackage = require("../models/TourPackage");

async function addCategoryToPackages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Update all packages without category to have "cultural" as default
    const result = await TourPackage.updateMany(
      { category: { $exists: false } },
      { $set: { category: "cultural" } }
    );

    console.log(`Updated ${result.modifiedCount} packages with default category`);

    // Also update packages with empty or invalid categories
    const invalidCategories = await TourPackage.updateMany(
      {
        $or: [
          { category: { $exists: false } },
          { category: "" },
          { category: { $nin: ["adventure", "cultural", "nature", "spiritual"] } },
        ],
      },
      { $set: { category: "cultural" } }
    );

    console.log(
      `Updated ${invalidCategories.modifiedCount} packages with invalid categories`
    );

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

addCategoryToPackages();

