const { sanitizers } = require("../utils/sanitizer");
const logger = require("../utils/logger");

const validateSignup = (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, phone, country } = req.body;

    // Check required fields
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Validate name length
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        message: "Name must be between 2 and 100 characters",
      });
    }

    // Validate email format
    try {
      sanitizers.sanitizeEmail(email);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Validate password strength
    try {
      sanitizers.validatePassword(password);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Confirm passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // Validate phone if provided
    if (phone) {
      try {
        sanitizers.validatePhone(phone);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }

    // Validate country if provided
    if (country && (country.length < 2 || country.length > 100)) {
      return res.status(400).json({
        message: "Country must be between 2 and 100 characters",
      });
    }

    logger.logAuth("VALIDATION_PASSED", email, "success", {
      endpoint: "/auth/register",
    });

    next();
  } catch (error) {
    logger.error("VALIDATION_ERROR", {
      error: error.message,
      endpoint: "/auth/register",
    });
    res.status(400).json({
      message: "Validation failed",
      error: error.message,
    });
  }
};

const validateLogin = (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Validate email format
    try {
      sanitizers.sanitizeEmail(email);
    } catch (error) {
      logger.logAuth("LOGIN_VALIDATION_FAILED", email, "invalid_email");
      return res.status(400).json({ message: error.message });
    }

    if (password.length < 1) {
      logger.logAuth("LOGIN_VALIDATION_FAILED", email, "empty_password");
      return res.status(400).json({
        message: "Password is required",
      });
    }

    next();
  } catch (error) {
    logger.error("LOGIN_VALIDATION_ERROR", {
      error: error.message,
    });
    res.status(400).json({
      message: "Validation failed",
    });
  }
};

const validatePackageData = (req, res, next) => {
  try {
    const { title, description, price, duration, availableSpots, location } =
      req.body;

    // Check required fields
    if (!title || !description || !price || !duration || !location) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Validate title
    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({
        message: "Title must be between 3 and 200 characters",
      });
    }

    // Validate price
    const priceNum = sanitizers.sanitizeNumber(price, 1, 1000000);

    // Validate duration
    const durationNum = sanitizers.sanitizeNumber(duration, 1, 365);

    // Validate available spots
    const spots = sanitizers.sanitizeNumber(availableSpots, 1, 10000);

    // Validate description length
    if (description.length < 10 || description.length > 5000) {
      return res.status(400).json({
        message: "Description must be between 10 and 5000 characters",
      });
    }

    logger.logOperation("PACKAGE_VALIDATION", req.user?.userId, "new", {
      title,
    });

    next();
  } catch (error) {
    logger.error("PACKAGE_VALIDATION_ERROR", {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(400).json({
      message: "Invalid package data",
      error: error.message,
    });
  }
};

const validateBookingData = (req, res, next) => {
  try {
    const { packageId, totalPersons, specialRequests } = req.body;

    if (!packageId || !totalPersons) {
      return res.status(400).json({
        message: "Package ID and total persons are required",
      });
    }

    // Validate persons count
    const persons = sanitizers.sanitizeNumber(totalPersons, 1, 10000);

    // Validate special requests if provided
    if (specialRequests && specialRequests.length > 2000) {
      return res.status(400).json({
        message: "Special requests must not exceed 2000 characters",
      });
    }

    logger.logOperation("BOOKING_VALIDATION", req.user?.userId, packageId, {
      totalPersons: persons,
    });

    next();
  } catch (error) {
    logger.error("BOOKING_VALIDATION_ERROR", {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(400).json({
      message: "Invalid booking data",
      error: error.message,
    });
  }
};

module.exports = {
  validateSignup,
  validateLogin,
  validatePackageData,
  validateBookingData,
};
