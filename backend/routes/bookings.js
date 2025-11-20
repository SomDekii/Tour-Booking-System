const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { sanitizeRequest } = require("../utils/sanitizer");
const { validateBookingData } = require("../middleware/validationMiddleware");

router.use(sanitizeRequest);

// POST /api/bookings
router.post(
  "/",
  authenticateToken,
  validateBookingData,
  bookingController.createBooking
);

// GET /api/bookings/my-bookings
router.get("/my-bookings", authenticateToken, bookingController.getMyBookings);

// GET all bookings (admin)
router.get("/", authenticateToken, isAdmin, bookingController.getAllBookings);

// GET one booking
router.get("/:id", authenticateToken, bookingController.getBookingById);

// Update booking status
router.patch(
  "/:id/status",
  authenticateToken,
  isAdmin,
  bookingController.updateBookingStatus
);

// Delete booking
router.delete("/:id", authenticateToken, bookingController.cancelBooking);

module.exports = router;
