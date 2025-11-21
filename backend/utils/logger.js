const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "bhutan-tourism-api" },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate error log file
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Helper function to log authentication events
logger.logAuth = (eventType, email, status, details = {}) => {
  logger.info("AUTH_EVENT", {
    eventType,
    email,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Helper function to log grade operations (for audit trail)
logger.logOperation = (operation, userId, resourceId, changes = {}) => {
  logger.info("OPERATION_LOG", {
    operation,
    userId,
    resourceId,
    timestamp: new Date().toISOString(),
    changes,
  });
};

/**
 * Sanitize sensitive data from logs
 * Removes passwords, tokens, and other sensitive information
 */
const sanitizeLogData = (data) => {
  if (!data || typeof data !== "object") return data;

  const sensitiveFields = [
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "apiKey",
    "secret",
    "mfaSecret",
    "mfaOtpHash",
    "resetToken",
    "creditCard",
    "ssn",
    "cvv",
    "pin",
  ];

  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (
      typeof sanitized[key] === "object" &&
      sanitized[key] !== null &&
      !Array.isArray(sanitized[key])
    ) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
};

// Override logger methods to sanitize sensitive data
const originalInfo = logger.info.bind(logger);
const originalError = logger.error.bind(logger);
const originalWarn = logger.warn.bind(logger);

logger.info = (message, meta = {}) => {
  return originalInfo(message, sanitizeLogData(meta));
};

logger.error = (message, meta = {}) => {
  return originalError(message, sanitizeLogData(meta));
};

logger.warn = (message, meta = {}) => {
  return originalWarn(message, sanitizeLogData(meta));
};

module.exports = logger;
