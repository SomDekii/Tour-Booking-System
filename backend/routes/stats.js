const express = require("express");
const router = express.Router();

const statsController = require("../controllers/statsController");
const {
  authenticateToken,
  isAdmin,
  sanitizeInput,
} = require("../middleware/auth");

// Apply sanitization middleware
router.use(sanitizeInput);

//     ADMIN STATS ROUTES

// GET /api/stats → Dashboard summary
router.get("/", authenticateToken, isAdmin, statsController.getDashboardStats);

// GET /api/stats/revenue → Revenue analytics
router.get(
  "/revenue",
  authenticateToken,
  isAdmin,
  statsController.getRevenueStats
);

// GET /api/stats/trends → Booking trends
router.get(
  "/trends",
  authenticateToken,
  isAdmin,
  statsController.getBookingTrends
);

module.exports = router;
