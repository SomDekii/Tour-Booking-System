const validator = require("validator");

// =======================
// Helper Functions
// =======================
const isValidEmail = (email) => validator.isEmail(email);

const isStrongPassword = (password) => password && password.length >= 12;

const isValidPhone = (phone) =>
  !phone || validator.isMobilePhone(phone, "any", { strictMode: false });

const isValidDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj) && dateObj > new Date();
};

const isPositiveNumber = (num) => !isNaN(num) && Number(num) > 0;

// =======================
// Registration Validation
// =======================
const validateRegistration = (req, res, next) => {
  const { name, email, password, phone } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push("Name must be at least 2 characters");
  if (name && name.length > 100)
    errors.push("Name cannot exceed 100 characters");

  if (!email) errors.push("Email is required");
  else if (!isValidEmail(email)) errors.push("Invalid email format");

  if (!password) errors.push("Password is required");
  else if (!isStrongPassword(password))
    errors.push("Password must be at least 12 characters");

  if (phone && !isValidPhone(phone)) errors.push("Invalid phone number format");

  if (errors.length > 0)
    return res.status(400).json({ message: "Validation failed", errors });

  next();
};

// =======================
// Login Validation
// =======================
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) errors.push("Email is required");
  else if (!isValidEmail(email)) errors.push("Invalid email format");

  if (!password) errors.push("Password is required");

  if (errors.length > 0)
    return res.status(400).json({ message: "Validation failed", errors });

  next();
};

// =======================
// Tour Package Validation
// =======================
const validatePackage = (req, res, next) => {
  const {
    title,
    description,
    duration,
    price,
    location,
    maxGroupSize,
    availableSpots,
  } = req.body;
  const errors = [];

  if (!title || title.trim().length < 3)
    errors.push("Title must be at least 3 characters");
  if (title && title.length > 200)
    errors.push("Title cannot exceed 200 characters");

  if (!description || description.trim().length < 10)
    errors.push("Description must be at least 10 characters");
  if (description && description.length > 5000)
    errors.push("Description cannot exceed 5000 characters");

  if (!isPositiveNumber(duration))
    errors.push("Duration must be a positive number");
  if (duration && duration > 365)
    errors.push("Duration cannot exceed 365 days");

  if (!isPositiveNumber(price)) errors.push("Price must be a positive number");
  if (price && price > 10000000) errors.push("Price seems unreasonably high");

  if (!location || location.trim().length < 2)
    errors.push("Location must be at least 2 characters");
  if (location && location.length > 200)
    errors.push("Location cannot exceed 200 characters");

  if (!isPositiveNumber(maxGroupSize))
    errors.push("Max group size must be a positive number");
  if (maxGroupSize && maxGroupSize > 100)
    errors.push("Max group size cannot exceed 100");

  if (
    availableSpots !== undefined &&
    !isPositiveNumber(availableSpots) &&
    availableSpots !== 0
  )
    errors.push("Available spots must be a non-negative number");
  if (availableSpots && availableSpots > 1000)
    errors.push("Available spots cannot exceed 1000");

  if (errors.length > 0)
    return res.status(400).json({ message: "Validation failed", errors });

  next();
};

// =======================
// Booking Validation
// =======================
const validateBooking = (req, res, next) => {
  const {
    tourPackageId,
    numberOfPeople,
    startDate,
    contactEmail,
    contactPhone,
    specialRequests,
  } = req.body;
  const errors = [];

  if (!tourPackageId || !validator.isMongoId(tourPackageId))
    errors.push("Invalid tour package ID");

  if (!isPositiveNumber(numberOfPeople))
    errors.push("Number of people must be a positive number");
  if (numberOfPeople && numberOfPeople > 50)
    errors.push("Number of people cannot exceed 50");

  if (!startDate) errors.push("Start date is required");
  else if (!isValidDate(startDate))
    errors.push("Start date must be a valid future date");

  // Contact email: allow omission if authenticated user has an email (handled in controller)
  const effectiveEmail = contactEmail || (req.user && req.user.email);
  if (!effectiveEmail) errors.push("Contact email is required");
  else if (!isValidEmail(effectiveEmail))
    errors.push("Invalid contact email format");

  // Contact phone: optional if user has phone; otherwise validate when provided
  const effectivePhone = contactPhone || (req.user && req.user.phone);
  if (effectivePhone && !isValidPhone(effectivePhone))
    errors.push("Invalid contact phone format");

  if (specialRequests && specialRequests.length > 1000)
    errors.push("Special requests cannot exceed 1000 characters");

  if (errors.length > 0)
    return res.status(400).json({ message: "Validation failed", errors });

  next();
};

// =======================
// Booking Status Validation
// =======================
const validateBookingStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "cancelled", "completed"];

  if (!status)
    return res.status(400).json({
      message: "Status is required",
      errors: ["Status field is missing"],
    });
  if (!validStatuses.includes(status))
    return res.status(400).json({
      message: "Invalid status value",
      errors: [`Status must be one of: ${validStatuses.join(", ")}`],
    });

  next();
};

// =======================
// MongoDB ObjectId Validation
// =======================
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !validator.isMongoId(id))
      return res.status(400).json({
        message: "Invalid ID format",
        errors: [`${paramName} must be a valid MongoDB ObjectId`],
      });

    next();
  };
};

// Exports
module.exports = {
  validateRegistration,
  validateLogin,
  validatePackage,
  validateBooking,
  validateBookingStatus,
  validateObjectId,
  isValidEmail,
  isStrongPassword,
  isValidPhone,
  isValidDate,
  isPositiveNumber,
};
