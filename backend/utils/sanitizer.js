const validator = require("validator");

// Regex rules
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

const sanitizers = {
  // SAFE sanitize string (does NOT escape slashes)
  sanitizeString: (input) => {
    if (typeof input !== "string") return input;

    let cleaned = validator.trim(input);

    // Escape only XSS-related characters, NOT `/`
    cleaned = cleaned
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

    return cleaned;
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
    // Sanitize body
    for (let key in req.body) {
      if (
        typeof req.body[key] === "string" &&
        !SKIP_SANITIZE_FIELDS.includes(key)
      ) {
        req.body[key] = sanitizers.sanitizeString(req.body[key]);
      }
    }

    // Sanitize query
    for (let key in req.query) {
      if (
        typeof req.query[key] === "string" &&
        !SKIP_SANITIZE_FIELDS.includes(key)
      ) {
        req.query[key] = sanitizers.sanitizeString(req.query[key]);
      }
    }

    // Sanitize params
    for (let key in req.params) {
      if (
        typeof req.params[key] === "string" &&
        !SKIP_SANITIZE_FIELDS.includes(key)
      ) {
        req.params[key] = sanitizers.sanitizeString(req.params[key]);
      }
    }

    next();
  } catch (error) {
    return res.status(400).json({
      message: "Invalid input format",
      error: error.message,
    });
  }
};

module.exports = { sanitizers, sanitizeRequest };
