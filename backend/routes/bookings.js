const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const {
  requirePermission,
  requireOwnershipOrAdmin,
} = require("../middleware/rbac");
const { sanitizeRequest } = require("../utils/sanitizer");
const { validateBookingData } = require("../middleware/validationMiddleware");

router.use(sanitizeRequest);

// POST /api/bookings - Users can create their own bookings
router.post(
  "/",
  authenticateToken,
  requirePermission("create:booking"),
  validateBookingData,
  bookingController.createBooking
);

// GET /api/bookings/my-bookings - Users can view their own bookings
router.get(
  "/my-bookings",
  authenticateToken,
  requirePermission("read:own"),
  bookingController.getMyBookings
);

// GET all bookings (admin only)
router.get(
  "/",
  authenticateToken,
  requirePermission("read:all"),
  bookingController.getAllBookings
);

// GET one booking - Users can view their own, admins can view any
router.get(
  "/:id",
  authenticateToken,
  requirePermission("read:own"),
  bookingController.getBookingById
);

// Update booking status (admin only)
router.patch(
  "/:id/status",
  authenticateToken,
  requirePermission("manage:bookings"),
  bookingController.updateBookingStatus
);

// Delete booking - Users can cancel their own, admins can delete any
router.delete(
  "/:id",
  authenticateToken,
  requirePermission("delete:own"),
  bookingController.cancelBooking
);

module.exports = router;
