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

module.exports = logger;
