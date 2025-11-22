const bcrypt = require("bcryptjs");
const User = require("../models/User");
const TokenManager = require("../utils/tokenManager");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { sendEmail } = require("../utils/email");

const logger = require("../utils/logger");

// CONFIG
const ADMIN_EMAIL = "12230045.gcit@rub.edu.bt";
const ADMIN_PASSWORD = "Admin@123@2025";
const adminOtpStore = new Map(); // short-lived admin OTPs

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, country } = req.body;

    if (email === ADMIN_EMAIL)
      return res.status(403).json({ message: "Admin cannot be registered." });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "user",
      phone,
      country,
    });

    const accessToken = TokenManager.generateAccessToken(
      user._id,
      user.email,
      user.role
    );
    const refreshToken = TokenManager.generateRefreshToken(user._id);
    TokenManager.setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: "Registration successful",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error("REGISTER_FAILED", { error: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ADMIN LOGIN (Admin portal only)
exports.adminLogin = async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;
    logger.info("ADMIN_LOGIN_ATTEMPT", { email });

    // Only allow admin email to login through admin portal
    if (email !== ADMIN_EMAIL) {
      logger.warn("NON_ADMIN_EMAIL_IN_ADMIN_PORTAL", { email });
      return res.status(403).json({
        message:
          "Only admin accounts can login through this portal. Please use /login for regular user accounts.",
      });
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!mfaCode) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hash = await bcrypt.hash(otp, 10);
      const expires = Date.now() + 5 * 60 * 1000;
      adminOtpStore.set(ADMIN_EMAIL, { hash, expires });

      const sendResult = await sendEmail({
        to: ADMIN_EMAIL,
        subject: "Admin Login OTP",
        html: `<p>Your OTP is <b>${otp}</b>. Expires in 5 min.</p>`,
        text: `Your OTP is ${otp}. Expires in 5 min.`,
      });
      if (sendResult.ok) {
        logger.info("ADMIN_OTP_EMAIL_SENT", { email: ADMIN_EMAIL });
        return res.json({
          requiresMFA: true,
          method: "otp",
          message: "OTP sent to admin email",
        });
      } else {
        // Clean up the stored OTP since email failed
        adminOtpStore.delete(ADMIN_EMAIL);
        logger.error("ADMIN_OTP_SEND_FAILED", {
          email: ADMIN_EMAIL,
          error: sendResult.error,
          provider: sendResult.provider,
        });
        return res.status(500).json({
          message: "Failed to send OTP email. Please try again later.",
          error:
            process.env.NODE_ENV === "development"
              ? sendResult.error
              : undefined,
        });
      }
    }

    // Verify OTP
    const record = adminOtpStore.get(ADMIN_EMAIL);
    if (!record || record.expires < Date.now()) {
      adminOtpStore.delete(ADMIN_EMAIL);
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    const ok = await bcrypt.compare(mfaCode, record.hash);
    if (!ok) return res.status(400).json({ message: "Invalid OTP" });

    adminOtpStore.delete(ADMIN_EMAIL);
    const accessToken = TokenManager.generateAccessToken(
      "admin-0001",
      ADMIN_EMAIL,
      "admin"
    );
    const refreshToken = TokenManager.generateRefreshToken("admin-0001");
    TokenManager.setAuthCookies(res, accessToken, refreshToken);
    return res.json({
      message: "Admin login successful",
      token: accessToken,
      refreshToken,
      user: {
        id: "admin-0001",
        name: "System Admin",
        email: ADMIN_EMAIL,
        role: "admin",
      },
    });
  } catch (error) {
    logger.error("ADMIN_LOGIN_ERROR", { error: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// USER LOGIN (Regular users only)
exports.login = async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;
    logger.info("USER_LOGIN_ATTEMPT", { email });

    // Reject admin login attempts from user portal
    if (email === ADMIN_EMAIL) {
      logger.warn("ADMIN_LOGIN_ATTEMPT_FROM_USER_PORTAL", { email });
      return res.status(403).json({
        message:
          "Admin accounts must login through the admin portal. Please use /admin/login",
      });
    }

    // Check if user exists and is not an admin
    const user = await User.findOne({ email }).select(
      "+password +mfaSecret +mfaOtpHash +mfaOtpExpires"
    );

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Reject if user is an admin trying to login from user portal
    if (user.role === "admin") {
      logger.warn("ADMIN_USER_LOGIN_ATTEMPT_FROM_USER_PORTAL", {
        email,
        userId: user._id,
      });
      return res.status(403).json({
        message:
          "Admin accounts must login through the admin portal. Please use /admin/login",
      });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Send OTP if not provided
    if (!mfaCode) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.mfaOtpHash = await bcrypt.hash(otp, 10);
      user.mfaOtpExpires = Date.now() + 5 * 60 * 1000;
      await user.save();

      const sendResult = await sendEmail({
        to: user.email,
        subject: "Login OTP - Tour Booking System",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ff9500;">Your Login OTP</h2>
            <p>Hello ${user.name || "User"},</p>
            <p>Your login verification code is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #ff9500; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
              ${otp}
            </div>
            <p>This code will expire in <strong>5 minutes</strong>.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated email from Tour Booking System.</p>
          </div>
        `,
      });
      if (sendResult.ok) {
        logger.info("USER_OTP_EMAIL_SENT", {
          email: user.email,
          emailId: sendResult.emailId || sendResult.result?.id,
          provider: sendResult.provider,
          domain: sendResult.domain,
        });
        return res.json({
          requiresMFA: true,
          method: "otp",
          message: "OTP sent to registered email",
          emailSent: true,
          // Include email ID in development for debugging
          ...(process.env.NODE_ENV === "development" && {
            debug: {
              emailId: sendResult.emailId,
              provider: sendResult.provider,
            },
          }),
        });
      } else {
        // Clean up the stored OTP since email failed
        user.mfaOtpHash = undefined;
        user.mfaOtpExpires = undefined;
        await user.save();
        logger.error("USER_OTP_SEND_FAILED", {
          email: user.email,
          error: sendResult.error,
          provider: sendResult.provider,
          suggestion: sendResult.suggestion,
        });
        return res.status(500).json({
          message: "Failed to send OTP email. Please try again later.",
          error:
            process.env.NODE_ENV === "development"
              ? sendResult.error
              : undefined,
          suggestion: sendResult.suggestion,
        });
      }
    }

    // Verify MFA
    let validMFA = false;
    if (user.mfaOtpHash && user.mfaOtpExpires > Date.now()) {
      validMFA = await bcrypt.compare(mfaCode, user.mfaOtpHash);
      if (validMFA) {
        user.mfaOtpHash = undefined;
        user.mfaOtpExpires = undefined;
        await user.save();
      }
    }

    if (!validMFA && user.mfaSecret) {
      validMFA = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: "base32",
        token: mfaCode,
        window: 2,
      });
    }

    if (!validMFA) return res.status(400).json({ message: "Invalid MFA code" });

    const accessToken = TokenManager.generateAccessToken(
      user._id,
      user.email,
      user.role
    );
    const refreshToken = TokenManager.generateRefreshToken(user._id);
    TokenManager.setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Login successful",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    logger.error("LOGIN_FAILED", { error: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET CURRENT USER
exports.getCurrentUser = async (req, res) => {
  try {
    if (req.user.userId === "admin-0001")
      return res.json({
        id: "admin-0001",
        name: "System Admin",
        email: ADMIN_EMAIL,
        role: "admin",
      });

    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      country: user.country,
      mfaEnabled: user.mfaEnabled,
    });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      return res.status(400).json({ message: "Current password incorrect" });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

// MFA SETUP / VERIFY / DISABLE
exports.setupMFA = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const secret = speakeasy.generateSecret({
      name: `Bhutan Tours (${user.email})`,
      length: 32,
    });
    user.mfaTempSecret = secret.base32;
    await user.save();
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    res.json({
      secret: secret.base32,
      qrCode,
      message: "Scan QR with authenticator app",
    });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

exports.verifyMFA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user.mfaTempSecret)
      return res.status(400).json({ message: "MFA setup not initiated" });

    const valid = speakeasy.totp.verify({
      secret: user.mfaTempSecret,
      encoding: "base32",
      token: code,
      window: 2,
    });
    if (!valid) return res.status(400).json({ message: "Invalid MFA code" });

    user.mfaSecret = user.mfaTempSecret;
    user.mfaTempSecret = undefined;
    user.mfaEnabled = true;
    await user.save();
    res.json({ message: "MFA enabled", mfaEnabled: true });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

exports.disableMFA = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user.userId).select("+password");
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaTempSecret = undefined;
    await user.save();
    res.json({ message: "MFA disabled" });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashed,
      resetTokenExpires: { $gt: Date.now() },
    }).select("+password");
    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

// REFRESH TOKEN
exports.refreshToken = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh token missing" });

  try {
    const newAccessToken =
      TokenManager.verifyAndRefreshAccessToken(refreshToken);
    TokenManager.setAuthCookies(res, newAccessToken, refreshToken);
    res.json({ message: "Token refreshed", token: newAccessToken });
  } catch (e) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// BACKUP CODES
exports.generateBackupCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex")
    );
    user.backupCodes = backupCodes.map((code) => bcrypt.hashSync(code, 10));
    await user.save();
    logger.info(`Backup codes generated for user ${user.email}`);
    res.json({ message: "Backup codes generated", backupCodes });
  } catch (error) {
    logger.error("BACKUP_CODES_FAILED", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// LOGOUT
exports.logout = (req, res) => {
  TokenManager.clearAuthCookies(res);
  res.json({ message: "Logout successful" });
};
