const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const uploadController = require("../controllers/uploadController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

// POST /api/upload - Upload image (admin only)
router.post(
  "/",
  authenticateToken,
  isAdmin,
  upload.single("image"),
  uploadController.uploadImage
);

module.exports = router;
