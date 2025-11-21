import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Users, DollarSign, MapPin, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { resolveImageSrc } from "../../utils/image";

const PackageDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingData, setBookingData] = useState({
    numberOfPeople: 1,
    specialRequests: "",
    startDate: "",
  });

  // Fetch package data on mount
  useEffect(() => {
    const fetchPackage = async () => {
      setLoading(true);
      try {
        const resp = await api.getPackageById(id);
        const pkg = resp?.data || resp;
        setPackageData(pkg);
      } catch (err) {
        setError(err.message || "Failed to load package");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchPackage();
  }, [id]);

  // Handle booking submission
  const handleBooking = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // Validate number of people
    if (bookingData.numberOfPeople < 1) {
      setError("Number of people must be at least 1");
      return;
    }
    if (bookingData.numberOfPeople > packageData.availableSpots) {
      setError("Number of people exceeds available spots");
      return;
    }

    // Use authenticated user's email; ensure it's present
    if (!user?.email) {
      setError("User email not available. Please update your profile.");
      return;
    }
    if (!bookingData.startDate) {
      setError("Please select a start date");
      return;
    }
    // Prevent past dates
    const selectedDate = new Date(bookingData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError("Start date cannot be in the past");
      return;
    }
    // Validate number of people bounds
    const maxSpots = packageData?.availableSpots ?? 10000;
    if (
      bookingData.numberOfPeople < 1 ||
      bookingData.numberOfPeople > maxSpots
    ) {
      setError(`Please select between 1 and ${maxSpots} people`);
      return;
    }

    setBookingLoading(true);
    setError("");

    try {
      await api.createBooking({
        // send both legacy and current field names so backend validation and controller accept it
        packageId: id,
        totalPersons: bookingData.numberOfPeople,
        tourPackageId: id,
        numberOfPeople: bookingData.numberOfPeople,
        startDate: bookingData.startDate,
        specialRequests: bookingData.specialRequests,
      });
      navigate("/my-bookings");
    } catch (err) {
      // Show backend-provided message when available
      setError(err.message || "Booking failed");
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && !packageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {(() => {
              const imgPath =
                packageData?.imageUrl ||
                packageData?.image ||
                packageData?.filename;
              const title =
                packageData?.title || packageData?.name || "Package";
              const imageSrc =
                resolveImageSrc(imgPath) ||
                `/placeholder.svg?height=250&width=400&query=${encodeURIComponent(
                  title
                )}`;

              return (
                <div className="w-full rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center min-h-[300px] max-h-[500px]">
                  <img
                    src={imageSrc}
                    alt={title}
                    className="max-w-full max-h-[500px] w-auto h-auto object-contain"
                  />
                </div>
              );
            })()}

            <div className="bg-white rounded-xl shadow-md p-6 lg:p-8">
              <div className="flex items-center gap-2 mb-4">
                {packageData?.category && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-600 text-sm font-semibold rounded-full">
                    {packageData.category}
                  </span>
                )}
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {packageData?.title}
              </h1>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <span>{packageData?.duration} days</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-5 h-5 text-orange-500" />
                  <span>{packageData?.availableSpots} spots</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  <span>{packageData?.location}</span>
                </div>
                <div className="flex items-center gap-2 text-orange-600 font-bold text-xl">
                  <DollarSign className="w-6 h-6" />
                  {packageData?.price}
                </div>
              </div>

              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {packageData?.description}
              </p>

              {packageData?.highlights && packageData.highlights.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Highlights
                  </h3>
                  <ul className="space-y-2">
                    {packageData.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-20">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Book This Tour
              </h3>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleBooking} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of People
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={packageData?.availableSpots || 10}
                    value={bookingData.numberOfPeople}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        numberOfPeople: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    value={bookingData.specialRequests}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        specialRequests: e.target.value,
                      })
                    }
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Any special requirements..."
                  />
                </div>

                {/* contact fields removed; using authenticated user's email/phone */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.startDate}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-lg mb-4">
                    <span className="text-gray-700">Total Price</span>
                    <span className="font-bold text-orange-600">
                      ${(packageData?.price || 0) * bookingData.numberOfPeople}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400"
                  >
                    {bookingLoading ? "Processing..." : "Book Now"}
                  </button>

                  {!isAuthenticated && (
                    <p className="text-sm text-gray-600 text-center mt-3">
                      You'll be redirected to login
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageDetail;
