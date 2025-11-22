import React, { useState, useEffect } from "react";
import { Calendar, Users, DollarSign, Mail, Phone } from "lucide-react";
import api from "../../utils/api";

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch live bookings from backend (admin-only)
      const resp = await api.getAllBookings();
      // Ensure response is an array
      if (Array.isArray(resp)) {
        setBookings(resp);
      } else {
        console.error("Invalid response format:", resp);
        setError("Invalid response format from server");
        setBookings([]);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      setError(err.message || "Failed to fetch bookings. Please try again.");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus);
      fetchBookings();
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const filteredBookings =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Manage Bookings</h1>
          <p className="text-gray-600 mt-1">
            View and manage all tour bookings
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-3 mb-6">
          {["all", "pending", "confirmed", "cancelled", "completed"].map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading bookings</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchBookings}
              className="mt-2 text-sm underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* Bookings List */}
        <div className="space-y-4">
          {filteredBookings.length === 0 && !loading && !error ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-600">No bookings found</p>
            </div>
          ) : filteredBookings.length === 0 && !loading && error ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div
                key={booking._id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {booking.tourPackageId?.title || 
                         (typeof booking.tourPackageId === 'string' 
                           ? `Package ID: ${booking.tourPackageId}` 
                           : "Unknown Package")}
                      </h3>
                      <span
                        className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {booking.status?.toUpperCase()}
                      </span>
                    </div>

                    <select
                      value={booking.status}
                      onChange={(e) =>
                        handleStatusChange(booking._id, e.target.value)
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Customer</p>
                        <p className="text-sm">
                          {booking.userId?.name || booking.userId || "Unknown"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm">
                          {booking.contactEmail || booking.userId?.email || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm">
                          {booking.contactPhone || booking.userId?.phone || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Booking Date</p>
                        <p className="text-sm">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">People</p>
                        <p className="text-sm">
                          {booking.numberOfPeople} travelers
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-orange-600">
                      <DollarSign className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-medium">Total Price</p>
                        <p className="text-lg font-bold">
                          {typeof booking.totalPrice === 'number' 
                            ? booking.totalPrice.toLocaleString() 
                            : String(booking.totalPrice || 0).replace(/^\$+/, '')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.specialRequests && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Special Requests:</strong>{" "}
                        {booking.specialRequests}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default AdminBookings;
