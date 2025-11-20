const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tourPackageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TourPackage",
    required: true,
  },
  numberOfPeople: {
    type: Number,
    required: [true, "Please provide number of people"],
    min: 1,
  },
  startDate: {
    type: Date,
    required: [true, "Please provide start date"],
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending",
  },
  specialRequests: {
    type: String,
    default: "",
  },
  contactEmail: {
    type: String,
    required: [true, "Please provide contact email"],
  },
  contactPhone: {
    type: String,
    // make contact phone optional; frontend will use user's phone when available
    required: false,
  },
  encryptedDetails: {
    iv: String,
    encryptedData: String,
    authTag: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
