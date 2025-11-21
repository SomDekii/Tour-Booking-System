const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { errorHandler } = require("./utils/errorHandler");
const { sanitizeRequest } = require("./utils/sanitizer");
const {
  securityHeaders,
  enforceHTTPS,
  csrfProtection,
  requestSizeLimiter,
  authRateLimiter,
  generalRateLimiter,
} = require("./middleware/security");

// Import routes
const authRoutes = require("./routes/auth");
const packageRoutes = require("./routes/packages");
const bookingRoutes = require("./routes/bookings");
const statsRoutes = require("./routes/stats");
const uploadRoutes = require("./routes/upload");

const app = express();

// Connect to MongoDB
connectDB();

app.set("trust proxy", 1);

// Enforce HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      logger.warn("HTTP_REQUEST_REDIRECTED", {
        url: req.url,
        ip: req.ip,
      });
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
  // Additional HTTPS enforcement middleware
  app.use(enforceHTTPS);
}

// SECURITY HEADERS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://tour-booking-system-server-esgm.onrender.com",
          "https:",
        ],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    xssFilter: true,
    noSniff: true,
  })
);

// Additional security headers
app.use(securityHeaders);

app.use(cookieParser());

// Use security middleware rate limiters
const limiter = generalRateLimiter;
const authLimiter = authRateLimiter;

// CORS configuration - must come before rate limit and route handlers so preflight gets headers
// Support a comma-separated list in FRONTEND_URLS or a single FRONTEND_URL.
// Always allow localhost for development.
const rawOrigins =
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "https://tour-booking-system-1-g7l9.onrender.com";
let allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// In development, always allow localhost
if (process.env.NODE_ENV !== "production") {
  allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    ...allowedOrigins,
  ];
}

const corsOptions = {
  origin: function (origin, callback) {
    // If no origin (e.g., server-to-server, curl, mobile) allow it
    if (!origin) return callback(null, true);
    // Normalize origin and allowedOrigins by removing trailing slashes for comparison
    try {
      const normalizedOrigin = origin.replace(/\/+$/, "");
      const match = allowedOrigins.some((o) => {
        if (!o) return false;
        return o.replace(/\/+$/, "") === normalizedOrigin;
      });
      if (match) return callback(null, true);
    } catch (err) {
      // Fallthrough to logging/deny below
    }
    // Log denied origin for easier debugging
    logger.warn("CORS_ORIGIN_DENIED", { origin, allowedOrigins });
    return callback(new Error("CORS origin denied"), false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request size limiting
app.use(requestSizeLimiter("10mb"));

// Input sanitization (prevents XSS and NoSQL injection)
app.use(sanitizeRequest);

// CSRF Protection (for state-changing requests)
if (process.env.NODE_ENV === "production") {
  app.use(csrfProtection);
}

// Prevent HTTP Parameter Pollution
app.use(
  hpp({
    whitelist: ["duration", "price", "availableSpots", "category", "location"],
  })
);

// Compression
app.use(compression());

// Remove powered by header
app.disable("x-powered-by");

app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("REQUEST_LOG", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.userId || "anonymous",
      userAgent: req.get("user-agent"),
    });
  });

  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Bhutan Tourism API is running",
    version: "1.0.0",
    security: {
      https: process.env.NODE_ENV === "production",
      jwt: true,
      mfa: true,
      encryption: true,
      logging: "Winston structured logging",
    },
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      packages: "/api/packages",
      bookings: "/api/bookings",
      stats: "/api/stats",
      upload: "/api/upload",
    },
  });
});

// 404 error handler
app.use((req, res) => {
  logger.warn("ROUTE_NOT_FOUND", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  res.status(404).json({
    message: "Route not found",
    path: req.path,
  });
});

app.use(errorHandler);

// GRACEFUL SHUTDOWN
process.on("SIGTERM", () => {
  logger.info("SIGTERM_RECEIVED", {
    message: "Shutting down gracefully",
  });
  server.close(() => {
    logger.info("SERVER_CLOSED", {
      message: "Process terminated",
    });
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT_RECEIVED", {
    message: "Shutting down gracefully",
  });
  server.close(() => {
    logger.info("SERVER_CLOSED", {
      message: "Process terminated",
    });
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED_REJECTION", {
    error: err.message,
    stack: err.stack,
  });
  server.close(() => {
    process.exit(1);
  });
});

// START SERVER with optional SMTP verification
const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  // Verify email provider client on startup for non-dev providers
  const emailProvider = (
    process.env.EMAIL_PROVIDER ||
    (process.env.NODE_ENV === "production"
      ? process.env.RESEND_API_KEY
        ? "resend"
        : "smtp"
      : "dev")
  ).toLowerCase();
  if (emailProvider !== "dev") {
    try {
      const { ensureTransporter } = require("./utils/email");
      await ensureTransporter();
      logger.info("EMAIL_PROVIDER_READY", { provider: emailProvider });
    } catch (err) {
      logger.error("EMAIL_STARTUP_CHECK_FAILED", { error: err.message });
      // Exit so deployment surfaces the configuration error
      process.exit(1);
    }
  }

  server = app.listen(PORT, () => {
    logger.info("SERVER_STARTED", {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      https: process.env.NODE_ENV === "production",
      mfa: true,
      encryption: true,
    });

    console.log(`  
    ================================================  
    🚀 Server running in ${process.env.NODE_ENV || "development"} mode  
    🔒 Security features enabled:  
       - JWT Authentication  
       - Multi-Factor Authentication (MFA)  
       - HTTPS ${process.env.NODE_ENV === "production" ? "Enforced" : "Ready"}  
       - Secure Cookies  
       - Rate Limiting  
       - XSS Protection  
       - Input Validation & Sanitization
       - AES-256-GCM Encryption
       - Winston Logging
    📡 Port: ${PORT}  
    🌐 Frontend URL: ${
      process.env.FRONTEND_URL ||
      "https://tour-booking-system-1-g7l9.onrender.com"
    }  
    ================================================  
    `);
  });
};

startServer();

module.exports = () => server;
