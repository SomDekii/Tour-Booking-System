const validator = require("validator");
const logger = require("./logger");

// Regex rules
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

const sanitizers = {
  // SAFE sanitize string (does NOT escape slashes)
  sanitizeString: (input) => {
    if (typeof input !== "string") return input;

    let cleaned = validator.trim(input);

    // Prevent NoSQL injection by removing MongoDB operators
    const nosqlOperators = [
      "$ne",
      "$gt",
      "$gte",
      "$lt",
      "$lte",
      "$in",
      "$nin",
      "$exists",
      "$regex",
      "$or",
      "$and",
      "$not",
      "$nor",
      "$where",
      "$elemMatch",
      "$all",
      "$size",
      "$type",
      "$mod",
      "$text",
      "$search",
      "$meta",
    ];
    
    // Remove MongoDB operators from string
    nosqlOperators.forEach((op) => {
      const regex = new RegExp(`\\${op}`, "gi");
      cleaned = cleaned.replace(regex, "");
    });

    // Escape XSS-related characters
    cleaned = cleaned
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;") // Escape forward slash for XSS
      .replace(/\\/g, "&#x5C;"); // Escape backslash

    return cleaned;
  },

  // Prevent NoSQL injection in objects
  sanitizeObject: (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizers.sanitizeObject(item));
    }

    const sanitized = {};
    for (const key in obj) {
      // Remove MongoDB operators from keys
      if (key.startsWith("$")) {
        continue; // Skip MongoDB operator keys
      }

      const value = obj[key];
      if (typeof value === "string") {
        sanitized[key] = sanitizers.sanitizeString(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizers.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  },

  sanitizeEmail: (email) => {
    const sanitized = validator.trim(email).toLowerCase();
    if (!emailRegex.test(sanitized)) {
      throw new Error("Invalid email format");
    }
    return validator.normalizeEmail(sanitized);
  },

  validatePassword: (password) => {
    if (!passwordRegex.test(password)) {
      throw new Error(
        "Password must be at least 12 characters with uppercase, lowercase, number, and special character"
      );
    }
    return password;
  },

  validatePhone: (phone) => {
    if (!validator.isMobilePhone(phone, "any", { strictMode: false })) {
      throw new Error("Invalid phone number format");
    }
    return validator.trim(phone);
  },

  sanitizeNumber: (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid number. Must be between ${min} and ${max}`);
    }
    return num;
  },

  sanitizeArray: (arr) => {
    if (!Array.isArray(arr)) throw new Error("Expected an array");
    return arr.map((item) =>
      typeof item === "string" ? sanitizers.sanitizeString(item) : item
    );
  },

  validateUrl: (url) => {
    if (!validator.isURL(url)) {
      throw new Error("Invalid URL format");
    }
    return url;
  },

  preventXSS: (input) => {
    return sanitizers.sanitizeString(String(input));
  },
};

// Fields that should NEVER be sanitized using escape()
const SKIP_SANITIZE_FIELDS = [
  "image",
  "imageUrl",
  "filename",
  "file",
  "path",
  "url",
];

const sanitizeRequest = (req, res, next) => {
  try {
    // Prevent NoSQL injection in body
    if (req.body && typeof req.body === "object") {
      // Check for MongoDB operators in body
      const bodyKeys = Object.keys(req.body);
      for (const key of bodyKeys) {
        if (key.startsWith("$")) {
          logger.warn("NOSQL_INJECTION_ATTEMPT", {
            key,
            path: req.path,
            method: req.method,
            ip: req.ip,
          });
          return res.status(400).json({
            message: "Invalid input format",
            error: "MongoDB operators are not allowed",
          });
        }
      }

      // Sanitize body
      for (let key in req.body) {
        if (SKIP_SANITIZE_FIELDS.includes(key)) {
          continue;
        }
        if (typeof req.body[key] === "string") {
          req.body[key] = sanitizers.sanitizeString(req.body[key]);
        } else if (typeof req.body[key] === "object" && req.body[key] !== null) {
          req.body[key] = sanitizers.sanitizeObject(req.body[key]);
        }
      }
    }

    // Sanitize query parameters
    for (let key in req.query) {
      if (SKIP_SANITIZE_FIELDS.includes(key)) {
        continue;
      }
      if (typeof req.query[key] === "string") {
        req.query[key] = sanitizers.sanitizeString(req.query[key]);
      } else if (typeof req.query[key] === "object" && req.query[key] !== null) {
        req.query[key] = sanitizers.sanitizeObject(req.query[key]);
      }
    }

    // Sanitize URL parameters
    for (let key in req.params) {
      if (SKIP_SANITIZE_FIELDS.includes(key)) {
        continue;
      }
      if (typeof req.params[key] === "string") {
        req.params[key] = sanitizers.sanitizeString(req.params[key]);
      }
    }

    next();
  } catch (error) {
    logger.error("SANITIZATION_ERROR", {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(400).json({
      message: "Invalid input format",
      error: process.env.NODE_ENV === "development" ? error.message : "Input validation failed",
    });
  }
};

module.exports = { sanitizers, sanitizeRequest };
