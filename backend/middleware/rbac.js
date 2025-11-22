const logger = require("../utils/logger");

/**
 * Role-Based Access Control (RBAC) Middleware
 * Implements least privilege principle
 */

// Define permissions for each role
const rolePermissions = {
  admin: [
    "read:all",
    "write:all",
    "delete:all",
    "manage:packages",
    "manage:bookings",
    "view:stats",
    "upload:files",
  ],
  user: ["read:own", "read:packages", "create:booking", "cancel:own-booking"],
};

/**
 * Check if user has required permission
 */
const hasPermission = (userRole, requiredPermission) => {
  if (!userRole || !rolePermissions[userRole]) return false;
  return rolePermissions[userRole].includes(requiredPermission);
};

/**
 * Middleware to check if user has specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn("PERMISSION_DENIED", {
        reason: "Not authenticated",
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;
    if (!hasPermission(userRole, permission)) {
      logger.warn("PERMISSION_DENIED", {
        userId: req.user.userId,
        role: userRole,
        requiredPermission: permission,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        required: permission,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource or is admin
 */
const requireOwnershipOrAdmin = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Admin can access any resource
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId =
      req.resource?.[resourceUserIdField] || req.params.userId;
    if (
      resourceUserId &&
      resourceUserId.toString() !== req.user.userId.toString()
    ) {
      logger.warn("OWNERSHIP_DENIED", {
        userId: req.user.userId,
        resourceUserId: resourceUserId,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        message: "Access denied. You can only access your own resources.",
        code: "OWNERSHIP_DENIED",
      });
    }

    next();
  };
};

/**
 * Check multiple permissions (OR logic - user needs at least one)
 */
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;
    const hasAnyPermission = permissions.some((permission) =>
      hasPermission(userRole, permission)
    );

    if (!hasAnyPermission) {
      logger.warn("PERMISSION_DENIED", {
        userId: req.user.userId,
        role: userRole,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        required: permissions,
      });
    }

    next();
  };
};

/**
 * Check multiple permissions (AND logic - user needs all)
 */
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;
    const hasAllPermissions = permissions.every((permission) =>
      hasPermission(userRole, permission)
    );

    if (!hasAllPermissions) {
      logger.warn("PERMISSION_DENIED", {
        userId: req.user.userId,
        role: userRole,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        required: permissions,
      });
    }

    next();
  };
};

module.exports = {
  requirePermission,
  requireOwnershipOrAdmin,
  requireAnyPermission,
  requireAllPermissions,
  hasPermission,
  rolePermissions,
};
