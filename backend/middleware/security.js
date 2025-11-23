const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

/**
 * Security Middleware Collection
 * Implements various security measures: CSRF, rate limiting, security headers
 */

/**
 * Enhanced rate limiter with different limits for different endpoints
 */
const createRateLimiter = (
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false
) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      logger.warn("RATE_LIMIT_EXCEEDED", {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get("user-agent"),
        timestamp: new Date().toISOString(),
      });
      res.status(429).json({
        message: message || "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    
  });
};

// Specific rate limiters for different endpoints
const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests
  "Too many authentication attempts. Please try again later.",
  true
);

const generalRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many requests from this IP, please try again later."
);

const strictRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  "Too many requests. Please slow down."
);

/**
 * CSRF Protection Middleware
 * Validates Origin/Referer headers for state-changing requests
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const allowedOrigins = (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // In development, allow localhost
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  const origin = req.get("origin") || req.get("referer");

  if (!origin) {
    // Allow requests without origin (e.g., Postman, curl) in development
    if (process.env.NODE_ENV === "development") {
      return next();
    }
    logger.warn("CSRF_CHECK_FAILED", {
      reason: "Missing origin/referer",
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      message: "CSRF protection: Origin header required",
      code: "CSRF_ERROR",
    });
  }

  const originUrl = new URL(origin);
  const normalizedOrigin = `${originUrl.protocol}//${originUrl.host}`;

  const isAllowed = allowedOrigins.some((allowed) => {
    try {
      const allowedUrl = new URL(allowed);
      return (
        allowedUrl.protocol === originUrl.protocol &&
        allowedUrl.host === originUrl.host
      );
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    logger.warn("CSRF_CHECK_FAILED", {
      reason: "Origin not in allowed list",
      origin: normalizedOrigin,
      allowedOrigins,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      message: "CSRF protection: Origin not allowed",
      code: "CSRF_ERROR",
    });
  }

  next();
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (maxSize = "10mb") => {
  return (req, res, next) => {
    const contentLength = req.get("content-length");
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeMB = parseInt(maxSize) || 10;
      if (sizeInMB > maxSizeMB) {
        logger.warn("REQUEST_SIZE_EXCEEDED", {
          size: `${sizeInMB.toFixed(2)}MB`,
          maxSize: `${maxSizeMB}MB`,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        return res.status(413).json({
          message: `Request too large. Maximum size: ${maxSizeMB}MB`,
          code: "PAYLOAD_TOO_LARGE",
        });
      }
    }
    next();
  };
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader("X-Powered-By");

  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);

  next();
};

/**
 * HTTPS enforcement middleware
 */
const enforceHTTPS = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    // Check if request is secure
    const isSecure =
      req.secure ||
      req.headers["x-forwarded-proto"] === "https" ||
      req.headers["x-forwarded-ssl"] === "on";

    if (!isSecure) {
      logger.warn("HTTPS_ENFORCEMENT", {
        protocol: req.protocol,
        forwardedProto: req.headers["x-forwarded-proto"],
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({
        message: "HTTPS required",
        code: "HTTPS_REQUIRED",
      });
    }
  }

  next();
};

/**
 * IP whitelist/blacklist (optional)
 */
const ipFilter = (allowedIPs = [], blockedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check blacklist first
    if (blockedIPs.length > 0 && blockedIPs.includes(clientIP)) {
      logger.warn("IP_BLOCKED", {
        ip: clientIP,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        message: "Access denied",
        code: "IP_BLOCKED",
      });
    }

    // Check whitelist if configured
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn("IP_NOT_WHITELISTED", {
        ip: clientIP,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        message: "Access denied",
        code: "IP_NOT_WHITELISTED",
      });
    }

    next();
  };
};

module.exports = {
  createRateLimiter,
  authRateLimiter,
  generalRateLimiter,
  strictRateLimiter,
  csrfProtection,
  requestSizeLimiter,
  securityHeaders,
  enforceHTTPS,
  ipFilter,
};
