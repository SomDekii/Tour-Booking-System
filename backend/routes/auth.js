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

// Development-only: SMTP health check / verification endpoint
// This helps verify SMTP connectivity without sending a real email.
router.get("/debug/smtp", async (req, res) => {
  // Do not expose this in production
  if (process.env.NODE_ENV === "production")
    return res.status(404).json({ message: "Not found" });

  try {
    const { ensureTransporter } = require("../utils/email");
    await ensureTransporter();
    return res.json({ ok: true, message: "SMTP verified" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Development-only: send a test email to verify email provider and logs
router.post("/debug/send-test", async (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(404).json({ message: "Not found" });

  const to = req.body?.to || req.query?.to;
  if (!to) return res.status(400).json({ message: "Missing 'to' address" });

  try {
    const { sendEmail } = require("../utils/email");
    const result = await sendEmail({
      to,
      subject: "Test Email from Tour-Booking-System",
      html: `<p>This is a test email to verify email provider configuration.</p>
             <p>If you received this, your email provider is working correctly!</p>
             <p><strong>Email ID:</strong> ${result.result?.id || "N/A"}</p>
             <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>`,
    });
    
    if (result.ok) {
      return res.json({ 
        ok: true, 
        message: `Test email sent to ${to}`,
        provider: result.provider,
        emailId: result.emailId || result.result?.id || result.result?.messageId,
        domain: result.domain,
        warning: result.warning,
        note: result.warning 
          ? "⚠️ Check Resend dashboard to verify domain and check email delivery status"
          : "✅ Email sent successfully. Check your inbox (and spam folder)."
      });
    } else {
      return res.status(500).json({ 
        ok: false, 
        error: result.error,
        provider: result.provider,
        suggestion: result.suggestion,
        message: "Failed to send test email. Check your email provider configuration."
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

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
