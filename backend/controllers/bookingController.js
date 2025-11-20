const Booking = require("../models/Booking");
const TourPackage = require("../models/TourPackage");
const { encrypt, decrypt } = require("../utils/encryption");
const logger = require("../utils/logger");

// Helper function to encrypt booking details
const encryptBookingDetails = (details) => {
  return encrypt({
    specialRequests: details.specialRequests,
    contactEmail: details.contactEmail,
    contactPhone: details.contactPhone,
  });
};

// Helper function to decrypt booking details
const decryptBookingDetails = (booking) => {
  if (booking.encryptedDetails) {
    try {
      return decrypt(booking.encryptedDetails);
    } catch (error) {
      logger.error("DECRYPTION_ERROR", {
        bookingId: booking._id,
        error: error.message,
      });
      return { failed: true, error: error.message };
    }
  }
  return null;
};

// -----------------------------
// Create new booking
// -----------------------------
exports.createBooking = async (req, res) => {
  try {
    const { tourPackageId, numberOfPeople, startDate, specialRequests } =
      req.body;

    // Use authenticated user's email/phone when available
    const contactEmail = req.user?.email || null;
    const contactPhone = req.user?.phone || req.body.contactPhone || null;

    // Find the tour package
    const tourPackage = await TourPackage.findById(tourPackageId);
    if (!tourPackage) {
      return res.status(404).json({ message: "Tour package not found" });
    }

    // Check if package is active
    if (!tourPackage.isActive) {
      return res
        .status(400)
        .json({ message: "This package is no longer available" });
    }

    // Check available spots
    if (tourPackage.availableSpots < numberOfPeople) {
      return res.status(400).json({
        message: `Only ${tourPackage.availableSpots} spots available`,
      });
    }

    // Calculate total price
    const totalPrice = tourPackage.price * numberOfPeople;

    // Encrypt sensitive details
    const encryptedDetails = encryptBookingDetails({
      specialRequests,
      contactEmail,
      contactPhone,
    });

    // Create booking
    const booking = new Booking({
      userId: req.user.userId,
      tourPackageId,
      numberOfPeople,
      startDate,
      totalPrice,
      encryptedDetails,
      contactEmail,
      contactPhone,
    });

    await booking.save();

    // Update available spots
    tourPackage.availableSpots -= numberOfPeople;
    await tourPackage.save();

    // Log booking creation for audit trail
    logger.logOperation("BOOKING_CREATED", req.user.userId, tourPackageId, {
      numberOfPeople,
      totalPrice,
    });

    // Populate tour package details
    await booking.populate("tourPackageId");

    // Decrypt for response
    const decryptedDetails = decryptBookingDetails(booking);

    res.status(201).json({
      ...booking.toObject(),
      specialRequests: decryptedDetails?.specialRequests,
      contactEmail: decryptedDetails?.contactEmail,
      contactPhone: decryptedDetails?.contactPhone,
    });
  } catch (error) {
    logger.error("BOOKING_CREATION_ERROR", {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get bookings for current user
// -----------------------------
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId })
      .populate("tourPackageId")
      .sort({ createdAt: -1 });

    // Decrypt sensitive data for response
    const decryptedBookings = bookings.map((booking) => {
      const decryptedDetails = decryptBookingDetails(booking);
      return {
        ...booking.toObject(),
        specialRequests: decryptedDetails?.specialRequests || null,
        contactEmail: decryptedDetails?.contactEmail || null,
        contactPhone: decryptedDetails?.contactPhone || null,
        decryptionFailed: !!decryptedDetails?.failed,
      };
    });

    res.json(decryptedBookings);
  } catch (error) {
    logger.error("GET_MY_BOOKINGS_ERROR", {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get all bookings (admin only)
// -----------------------------
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("userId", "-password")
      .populate("tourPackageId")
      .sort({ createdAt: -1 });

    // Decrypt sensitive data for response
    const decryptedBookings = bookings.map((booking) => {
      const decryptedDetails = decryptBookingDetails(booking);
      return {
        ...booking.toObject(),
        specialRequests: decryptedDetails?.specialRequests || null,
        contactEmail: decryptedDetails?.contactEmail || null,
        contactPhone: decryptedDetails?.contactPhone || null,
        decryptionFailed: !!decryptedDetails?.failed,
      };
    });

    res.json(decryptedBookings);
  } catch (error) {
    logger.error("GET_ALL_BOOKINGS_ERROR", {
      userId: req.user?.userId,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Get a single booking by ID
// -----------------------------
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("userId", "-password")
      .populate("tourPackageId");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only owner or admin can access
    if (
      booking.userId._id.toString() !== req.user.userId &&
      req.user.role !== "admin"
    ) {
      logger.warn("UNAUTHORIZED_BOOKING_ACCESS", {
        attemptedBy: req.user.userId,
        bookingId: req.params.id,
      });
      return res
        .status(403)
        .json({ message: "Not authorized to view this booking" });
    }

    // Decrypt sensitive data for response
    const decryptedDetails = decryptBookingDetails(booking);

    res.json({
      ...booking.toObject(),
      specialRequests: decryptedDetails?.specialRequests || null,
      contactEmail: decryptedDetails?.contactEmail || null,
      contactPhone: decryptedDetails?.contactPhone || null,
      decryptionFailed: !!decryptedDetails?.failed,
    });
  } catch (error) {
    logger.error("GET_BOOKING_ERROR", {
      userId: req.user?.userId,
      bookingId: req.params.id,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Update booking status (admin only)
// -----------------------------
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const oldStatus = booking.status;
    booking.status = status;
    await booking.save();

    // Restore available spots if booking is cancelled
    if (status === "cancelled" && oldStatus !== "cancelled") {
      const tourPackage = await TourPackage.findById(booking.tourPackageId);
      if (tourPackage) {
        tourPackage.availableSpots += booking.numberOfPeople;
        await tourPackage.save();
      }
    }

    // Log status change for audit trail
    logger.logOperation(
      "BOOKING_STATUS_CHANGED",
      req.user.userId,
      booking._id.toString(),
      {
        oldStatus,
        newStatus: status,
      }
    );

    await booking.populate(["userId", "tourPackageId"]);

    // Decrypt sensitive data for response
    const decryptedDetails = decryptBookingDetails(booking);

    res.json({
      ...booking.toObject(),
      specialRequests: decryptedDetails?.specialRequests || null,
      contactEmail: decryptedDetails?.contactEmail || null,
      contactPhone: decryptedDetails?.contactPhone || null,
      decryptionFailed: !!decryptedDetails?.failed,
    });
  } catch (error) {
    logger.error("UPDATE_BOOKING_STATUS_ERROR", {
      userId: req.user?.userId,
      bookingId: req.params.id,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Cancel a booking (owner or admin)
// -----------------------------
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only owner or admin can cancel
    if (
      booking.userId.toString() !== req.user.userId &&
      req.user.role !== "admin"
    ) {
      logger.warn("UNAUTHORIZED_BOOKING_CANCELLATION", {
        attemptedBy: req.user.userId,
        bookingId: req.params.id,
      });
      return res
        .status(403)
        .json({ message: "Not authorized to cancel this booking" });
    }

    // Restore available spots
    const tourPackage = await TourPackage.findById(booking.tourPackageId);
    if (tourPackage) {
      tourPackage.availableSpots += booking.numberOfPeople;
      await tourPackage.save();
    }

    // Log cancellation for audit trail
    logger.logOperation(
      "BOOKING_CANCELLED",
      req.user.userId,
      booking._id.toString()
    );

    await booking.deleteOne();

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    logger.error("CANCEL_BOOKING_ERROR", {
      userId: req.user?.userId,
      bookingId: req.params.id,
      error: error.message,
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
