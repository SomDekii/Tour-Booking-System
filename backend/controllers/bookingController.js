const Booking = require("../models/Booking");
const TourPackage = require("../models/TourPackage");
const logger = require("../utils/logger");

// Safely require encryption module
let encrypt, decrypt;
try {
  const encryptionModule = require("../utils/encryption");
  encrypt = encryptionModule.encrypt;
  decrypt = encryptionModule.decrypt;
} catch (error) {
  logger.error("ENCRYPTION_MODULE_LOAD_ERROR", {
    error: error.message,
    note: "Encryption functions will not be available. Check ENCRYPTION_KEY environment variable.",
  });
  // Provide fallback functions that return safe defaults
  encrypt = (data) => {
    logger.warn("ENCRYPTION_NOT_AVAILABLE", { data });
    return null; // Return null to indicate encryption failed
  };
  decrypt = (encryptedData) => {
    logger.warn("DECRYPTION_NOT_AVAILABLE", { encryptedData });
    return null; // Return null to indicate decryption failed
  };
}

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
      // Check if decrypt function is available
      if (!decrypt || typeof decrypt !== 'function') {
        logger.warn("DECRYPT_FUNCTION_NOT_AVAILABLE", {
          bookingId: booking._id,
        });
        return { failed: true, error: "Decryption not available" };
      }
      
      // Validate encryptedDetails structure before attempting decryption
      if (typeof booking.encryptedDetails !== 'object' || 
          !booking.encryptedDetails.iv || 
          !booking.encryptedDetails.encryptedData || 
          !booking.encryptedDetails.authTag) {
        logger.warn("INVALID_ENCRYPTED_DETAILS_FORMAT", {
          bookingId: booking._id,
          encryptedDetailsType: typeof booking.encryptedDetails,
        });
        return { failed: true, error: "Invalid encrypted data format" };
      }
      
      const result = decrypt(booking.encryptedDetails);
      // If decrypt returns null (from fallback), treat as failed
      if (result === null) {
        return { failed: true, error: "Decryption not available" };
      }
      return result;
    } catch (error) {
      logger.error("DECRYPTION_ERROR", {
        bookingId: booking._id,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
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
    // Log the request for debugging
    logger.info("GET_ALL_BOOKINGS_REQUEST", {
      userId: req.user?.userId,
      role: req.user?.role,
      path: req.path,
    });

    // Step 1: Query bookings
    let bookings;
    try {
      bookings = await Booking.find()
        .populate({
          path: "userId",
          select: "name email phone", // Don't mix inclusion with exclusion - password is already excluded by default in User model
          model: "User",
        })
        .populate({
          path: "tourPackageId",
          select: "title description price duration location category imageUrl",
          model: "TourPackage",
        })
        .sort({ createdAt: -1 })
        .lean(); // Use lean() for better performance and to avoid Mongoose document issues
    } catch (queryError) {
      logger.error("GET_ALL_BOOKINGS_QUERY_ERROR", {
        error: queryError.message,
        stack: queryError.stack,
      });
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    logger.info("GET_ALL_BOOKINGS_QUERY_RESULT", {
      count: bookings.length,
      userId: req.user?.userId,
    });

    // Decrypt sensitive data for response and ensure proper structure
    const decryptedBookings = bookings.map((booking) => {
      try {
        // Use booking directly if it's already a plain object (from lean()), otherwise convert
        const bookingObj = booking.toObject ? booking.toObject() : booking;
        
        // Safely decrypt booking details
        let decryptedDetails = null;
        try {
          decryptedDetails = decryptBookingDetails(booking);
        } catch (decryptError) {
          logger.warn("DECRYPT_BOOKING_DETAILS_ERROR", {
            bookingId: bookingObj._id,
            error: decryptError.message,
          });
          decryptedDetails = { failed: true, error: decryptError.message };
        }
      
      // Ensure userId and tourPackageId are properly structured
      // Handle case where populate might have failed
      const customerInfo = bookingObj.userId
        ? {
            _id: bookingObj.userId._id || bookingObj.userId,
            name: bookingObj.userId.name || "Unknown User",
            email: bookingObj.userId.email || bookingObj.contactEmail || "N/A",
            phone: bookingObj.userId.phone || bookingObj.contactPhone || "N/A",
          }
        : {
            _id: bookingObj.userId || null,
            name: "Unknown User",
            email: bookingObj.contactEmail || "N/A",
            phone: bookingObj.contactPhone || "N/A",
          };

      const packageInfo = bookingObj.tourPackageId
        ? {
            _id: bookingObj.tourPackageId._id || bookingObj.tourPackageId,
            title: bookingObj.tourPackageId.title || "Unknown Package",
            description: bookingObj.tourPackageId.description || "",
            price: bookingObj.tourPackageId.price || 0,
            duration: bookingObj.tourPackageId.duration || 0,
            location: bookingObj.tourPackageId.location || "",
            category: bookingObj.tourPackageId.category || "",
            imageUrl: bookingObj.tourPackageId.imageUrl || "",
          }
        : {
            _id: bookingObj.tourPackageId || null,
            title: "Package Not Found",
            description: "",
            price: 0,
            duration: 0,
            location: "",
            category: "",
            imageUrl: "",
          };

        return {
          ...bookingObj,
          userId: customerInfo,
          tourPackageId: packageInfo,
          specialRequests: decryptedDetails?.specialRequests || bookingObj.specialRequests || null,
          contactEmail: decryptedDetails?.contactEmail || bookingObj.contactEmail || customerInfo.email,
          contactPhone: decryptedDetails?.contactPhone || bookingObj.contactPhone || customerInfo.phone,
          decryptionFailed: !!decryptedDetails?.failed,
        };
      } catch (error) {
        // If processing a single booking fails, log it but continue with others
        logger.error("BOOKING_PROCESSING_ERROR", {
          bookingId: booking._id,
          error: error.message,
        });
        // Return a basic booking object with error flag
        const bookingObj = booking.toObject ? booking.toObject() : booking;
        return {
          ...bookingObj,
          userId: bookingObj.userId || { name: "Unknown", email: "N/A", phone: "N/A" },
          tourPackageId: bookingObj.tourPackageId || { title: "Unknown Package" },
          processingError: true,
          error: error.message,
        };
      }
    });

    logger.info("GET_ALL_BOOKINGS_SUCCESS", {
      count: decryptedBookings.length,
      userId: req.user?.userId,
    });

    res.json(decryptedBookings);
  } catch (error) {
    logger.error("GET_ALL_BOOKINGS_ERROR", {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // Return more detailed error in development
    const isDevelopment = process.env.NODE_ENV === "development";
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      ...(isDevelopment && {
        stack: error.stack,
        name: error.name,
        details: error.toString(),
      }),
    });
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
