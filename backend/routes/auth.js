const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, sanitizeInput } = require("../middleware/auth");
const {
  validateRegistration,
  validateLogin,
} = require("../middleware/validation");

// Apply input sanitization to all routes
router.use(sanitizeInput);

router.post("/register", validateRegistration, authController.register);
router.post("/login", validateLogin, authController.login);
router.post("/refresh-token", authController.refreshToken);

router.get("/me", authenticateToken, authController.getCurrentUser);
router.post("/logout", authenticateToken, authController.logout);
router.put(
  "/change-password",
  authenticateToken,
  authController.changePassword
);

router.post("/mfa/setup", authenticateToken, authController.setupMFA);
router.post("/mfa/verify", authenticateToken, authController.verifyMFA);
router.post("/mfa/disable", authenticateToken, authController.disableMFA);

router.post("/forgot-password", sanitizeInput, authController.forgotPassword);
router.post("/reset-password", sanitizeInput, authController.resetPassword);

router.post(
  "/mfa/backup-codes",
  authenticateToken,
  authController.generateBackupCodes
);

module.exports = router;
