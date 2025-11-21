const mongoose = require("mongoose");

const tourPackageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please provide a title"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Please provide a description"],
  },
  duration: {
    type: Number,
    required: [true, "Please provide duration in days"],
    min: 1,
  },
  price: {
    type: Number,
    required: [true, "Please provide a price"],
    min: 0,
  },
  location: {
    type: String,
    required: [true, "Please provide a location"],
    trim: true,
  },
  maxGroupSize: {
    type: Number,
    required: [true, "Please provide max group size"],
    min: 1,
  },
  availableSpots: {
    type: Number,
    required: [true, "Please provide available spots"],
    min: 0,
  },
  category: {
    type: String,
    enum: ["adventure", "cultural", "nature", "spiritual"],
    default: "cultural",
  },
  imageUrl: {
    type: String,
    default: "",
  },
  itinerary: [
    {
      type: String,
    },
  ],
  included: [
    {
      type: String,
    },
  ],
  excluded: [
    {
      type: String,
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("TourPackage", tourPackageSchema);
