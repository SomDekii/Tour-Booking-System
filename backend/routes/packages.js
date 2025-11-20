const express = require("express");
const router = express.Router();
const packageController = require("../controllers/packageController");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { sanitizeRequest } = require("../utils/sanitizer");
const { validatePackageData } = require("../middleware/validationMiddleware");

router.use(sanitizeRequest);

// GET /api/packages - Get all active packages (public)
router.get("/", packageController.getAllPackages);

// GET /api/packages/:id - Get single package (public)
router.get("/:id", packageController.getPackageById);

// POST /api/packages - Create new package (admin only)
router.post(
  "/",
  authenticateToken,
  isAdmin,
  validatePackageData,
  packageController.createPackage
);

// PUT /api/packages/:id - Update package (admin only)
router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  validatePackageData,
  packageController.updatePackage
);

// DELETE /api/packages/:id - Delete package (admin only)
router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  packageController.deletePackage
);

module.exports = router;
