const jwt = require("jsonwebtoken");

class TokenManager {
  static generateAccessToken(userId, email, role) {
    return jwt.sign({ userId, email, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });
  }

  static generateRefreshToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw error;
    }
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw error;
    }
  }

  // Set secure HTTP-only cookies
  static setAuthCookies(res, accessToken, refreshToken) {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const frontendUrl = (process.env.FRONTEND_URL || "").toLowerCase();
    const isSecureContext =
      process.env.NODE_ENV === "production" ||
      frontendUrl.startsWith("https://");

    // When using cross-site requests in secure contexts, browsers require
    // `SameSite=None` and `Secure=true` for cookies to be sent.
    const sameSite = isSecureContext ? "none" : "lax";
    const secure = !!isSecureContext;

    // Access token cookie (1 hour)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 60 * 60 * 1000, // 1 hour
      path: "/",
      domain: cookieDomain,
    });

    // Refresh token cookie (7 days)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth/refresh-token",
      domain: cookieDomain,
    });
  }

  // Clear auth cookies on logout
  static clearAuthCookies(res) {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const frontendUrl = (process.env.FRONTEND_URL || "").toLowerCase();
    const isSecureContext =
      process.env.NODE_ENV === "production" ||
      frontendUrl.startsWith("https://");
    const sameSite = isSecureContext ? "none" : "lax";
    const secure = !!isSecureContext;

    res.clearCookie("accessToken", {
      path: "/",
      domain: cookieDomain,
      httpOnly: true,
      secure,
      sameSite,
    });
    res.clearCookie("refreshToken", {
      path: "/api/auth/refresh-token",
      domain: cookieDomain,
      httpOnly: true,
      secure,
      sameSite,
    });
  }
}

module.exports = TokenManager;
