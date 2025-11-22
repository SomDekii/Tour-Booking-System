const Booking = require("../models/Booking");
const TourPackage = require("../models/TourPackage");
const User = require("../models/User");

// Dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: "pending" });
    const confirmedBookings = await Booking.countDocuments({
      status: "confirmed",
    });
    const cancelledBookings = await Booking.countDocuments({
      status: "cancelled",
    });
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });

    const revenueData = await Booking.aggregate([
      { $match: { status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    const totalPackages = await TourPackage.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments({ role: "user" });

    const recentBookings = await Booking.find()
      .populate("userId", "name email")
      .populate("tourPackageId", "title")
      .sort({ createdAt: -1 })
      .limit(5);

    const popularPackages = await Booking.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$tourPackageId", bookingCount: { $sum: 1 } } },
      { $sort: { bookingCount: -1 } },
      { $limit: 5 },
    ]);

    const popularPackagesWithDetails = await TourPackage.populate(
      popularPackages,
      {
        path: "_id",
        select: "title location price",
      }
    );

    res.json({
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      totalRevenue,
      totalPackages,
      totalUsers,
      recentBookings,
      popularPackages: popularPackagesWithDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// You can add similar functions for revenue and trends
exports.getRevenueStats = async (req, res) => {
  res.json({ message: "Revenue stats placeholder" });
};

exports.getBookingTrends = async (req, res) => {
  res.json({ message: "Booking trends placeholder" });
};
