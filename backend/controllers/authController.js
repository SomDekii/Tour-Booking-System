const bcrypt = require("bcryptjs");
const User = require("../models/User");
const TokenManager = require("../utils/tokenManager");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { sendEmail } = require("../utils/email"); // email utility

// In-memory admin OTP store (short-lived). Keyed by admin email.
const adminOtpStore = new Map();

// ADMIN (hardcoded)
const ADMIN_EMAIL = "12230045.gcit@rub.edu.bt";
const ADMIN_PASSWORD = "Admin@123@2025";

// ===============================
// REGISTER
// ===============================
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, country } = req.body;

    if (email === ADMIN_EMAIL) {
      return res
        .status(403)
        .json({ message: "Admin account cannot be registered." });
    }

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
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ===============================
// LOGIN
// ===============================
exports.login = async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    // HARDCODED ADMIN LOGIN: use email OTP for admin 2FA
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // If no mfaCode provided, generate and send OTP via email
      if (!mfaCode) {
        const otp = ("" + Math.floor(100000 + Math.random() * 900000)).slice(
          0,
          6
        );
        const hash = await bcrypt.hash(otp, 10);
        const expires = Date.now() + 1000 * 60 * 5; // 5 minutes

        adminOtpStore.set(ADMIN_EMAIL, { hash, expires });

        // Send OTP to admin email
        try {
          await sendEmail(
            ADMIN_EMAIL,
            "Your admin login code",
            `<p>Your one-time login code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`
          );
        } catch (err) {
          logger.error("ADMIN_OTP_SEND_FAILED", { error: err.message });
          return res.status(500).json({ message: "Failed to send OTP" });
        }

        return res.status(200).json({
          requiresMFA: true,
          method: "otp",
          message: "OTP sent to admin email",
        });
      }

      // Verify provided OTP
      const record = adminOtpStore.get(ADMIN_EMAIL);
      if (!record || record.expires < Date.now()) {
        adminOtpStore.delete(ADMIN_EMAIL);
        return res.status(400).json({ message: "OTP expired or not found" });
      }

      const ok = await bcrypt.compare(mfaCode, record.hash);
      if (!ok) return res.status(400).json({ message: "Invalid OTP" });

      // Successful admin OTP verification
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
    }

    // NORMAL USER LOGIN
    const user = await User.findOne({ email }).select(
      "+password +mfaSecret +mfaOtpHash +mfaOtpExpires"
    );
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass)
      return res.status(400).json({ message: "Invalid credentials" });

    // If no MFA code provided, generate a one-time OTP and email it to the user
    if (!mfaCode) {
      const otp = ("" + Math.floor(100000 + Math.random() * 900000)).slice(
        0,
        6
      );
      const hash = await bcrypt.hash(otp, 10);
      user.mfaOtpHash = hash;
      user.mfaOtpExpires = Date.now() + 1000 * 60 * 5; // 5 minutes
      await user.save();

      try {
        await sendEmail(
          user.email,
          "Your login code",
          `<p>Your one-time login code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`
        );
      } catch (err) {
        logger.error("USER_OTP_SEND_FAILED", {
          email: user.email,
          error: err.message,
        });
        return res.status(500).json({ message: "Failed to send OTP" });
      }

      return res
        .status(200)
        .json({
          requiresMFA: true,
          method: "otp",
          message: "OTP sent to registered email",
        });
    }

    // If MFA code provided, verify either the per-login OTP or TOTP (if user has it)
    try {
      // Check stored per-login OTP first
      if (
        user.mfaOtpHash &&
        user.mfaOtpExpires &&
        user.mfaOtpExpires > Date.now()
      ) {
        const ok = await bcrypt.compare(mfaCode, user.mfaOtpHash);
        if (ok) {
          // clear otp fields
          user.mfaOtpHash = undefined;
          user.mfaOtpExpires = undefined;
          await user.save();

          const accessToken = TokenManager.generateAccessToken(
            user._id,
            user.email,
            user.role
          );
          const refreshToken = TokenManager.generateRefreshToken(user._id);
          TokenManager.setAuthCookies(res, accessToken, refreshToken);
          return res.json({
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
        }
      }

      // If no matching per-login OTP, but user has an authenticator secret, check TOTP
      if (user.mfaSecret) {
        const validTOTP = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: "base32",
          token: mfaCode,
          window: 2,
        });
        if (validTOTP) {
          const accessToken = TokenManager.generateAccessToken(
            user._id,
            user.email,
            user.role
          );
          const refreshToken = TokenManager.generateRefreshToken(user._id);
          TokenManager.setAuthCookies(res, accessToken, refreshToken);
          return res.json({
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
        }
      }

      return res.status(400).json({ message: "Invalid MFA code" });
    } catch (err) {
      logger.error("USER_MFA_VERIFY_FAILED", {
        email: user.email,
        error: err.message,
      });
      return res.status(500).json({ message: "Failed to verify MFA code" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ===============================
// CURRENT USER
// ===============================
exports.getCurrentUser = async (req, res) => {
  try {
    if (req.user.userId === "admin-0001") {
      return res.json({
        id: "admin-0001",
        name: "System Admin",
        email: ADMIN_EMAIL,
        role: "admin",
      });
    }

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

// ===============================
// PASSWORD CHANGE
// ===============================
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

// ===============================
// MFA SETUP
// ===============================
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

// ===============================
// MFA VERIFY
// ===============================
exports.verifyMFA = async (req, res) => {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user.mfaTempSecret) {
      return res.status(400).json({ message: "MFA setup not initiated" });
    }

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

// ===============================
// MFA DISABLE
// ===============================
exports.disableMFA = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("+password");
    const { password } = req.body;

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

// ===============================
// FORGOT PASSWORD (EMAIL SEND)
// ===============================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email);

    const user = await User.findOne({ email });

    if (!user) {
      // Always respond with success message to prevent email enumeration
      return res.json({ message: "If email exists, reset link will be sent" });
    }

    // Create reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetToken = hashedToken;
    user.resetTokenExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send email
    await sendEmail(
      user.email,
      "Password Reset",
      `
      <p>You requested a password reset.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you did not request this, please ignore this email.</p>
    `
    );

    res.json({
      message: "Password reset email sent",
      resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ===============================
// RESET PASSWORD
// ===============================
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
exports.refreshToken = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh token missing" });

  try {
    const newAccessToken =
      TokenManager.verifyAndRefreshAccessToken(refreshToken);
    TokenManager.setAuthCookies(res, newAccessToken, refreshToken);

    res.json({
      message: "Token refreshed",
      token: newAccessToken,
    });
  } catch (e) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// ===============================
// BACKUP CODES
// ===============================
// exports.generateBackupCodes = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId);

//     if (!user.mfaEnabled) {
//       return res.status(400).json({ message: "Enable MFA first" });
//     }

//     const codes = Array.from({ length: 10 }, () =>
//       crypto.randomBytes(4).toString("hex").toUpperCase()
//     );

//     user.mfaBackupCodes = codes.map((c) =>
//       crypto.createHash("sha256").update(c).digest("hex")
//     );

//     await user.save();

//     res.json({
//       message: "Backup codes generated",
//       backupCodes: codes,
//     });
//   } catch (e) {
//     res.status(500).json({ message: "Server error", error: e.message });
//   }
// };
exports.generateBackupCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex")
    );

    user.backupCodes = backupCodes.map((code) => bcrypt.hashSync(code, 10));
    await user.save();

    logger.info(`Backup codes generated for user ${user.email}`);

    res.status(200).json({
      message: "Backup codes generated successfully",
      backupCodes, // send plain codes to user (but hash stored in DB)
    });
  } catch (error) {
    logger.error("Error generating backup codes:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// LOGOUT
// ===============================
exports.logout = async (req, res) => {
  TokenManager.clearAuthCookies(res);
  res.json({ message: "Logout successful" });
};
