const logger = require("./logger");

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Log the error with full details
  logger.error("ERROR_OCCURRED", {
    message: err.message,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.user?.userId || "anonymous",
    stack: err.stack,
  });

  // Prepare response - never expose sensitive details in production
  const statusCode = err.statusCode || 500;
  const response = {
    status: "error",
    message: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  };

  // Only include stack trace in development
  if (isDevelopment) {
    response.stack = err.stack;
    response.details = err;
  }

  res.status(statusCode).json(response);
};

// Async error wrapper to catch errors in async functions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
};
