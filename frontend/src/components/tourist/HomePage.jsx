import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users, Shield, Star, Clock } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// Import the hero image from src/assets
// import BhutanImage from "../../assets/bhutan-mountains-landscape.png";

const HomePage = () => {
  const [featuredPackages, setFeaturedPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedPackages();
  }, []);

  const fetchFeaturedPackages = async () => {
    try {
      const response = await api.getPackages();

      console.log("API Response:", response);

      // Handle multiple possible response shapes:
      // - API may return the packages array directly
      // - Or an object like { success, count, data: [...] }
      // - Or { data: { packages: [...] } }
      let packagesData = [];

      if (Array.isArray(response)) {
        packagesData = response;
      } else if (response && Array.isArray(response.data)) {
        packagesData = response.data;
      } else if (
        response &&
        response.data &&
        Array.isArray(response.data.packages)
      ) {
        packagesData = response.data.packages;
      } else if (response && Array.isArray(response.packages)) {
        packagesData = response.packages;
      } else if (
        response &&
        response.data &&
        response.data.data &&
        Array.isArray(response.data.data)
      ) {
        packagesData = response.data.data;
      }

      if (!Array.isArray(packagesData)) {
        console.error("Expected an array but got:", packagesData);
        setFeaturedPackages([]);
        return;
      }

      setFeaturedPackages(packagesData.slice(0, 3));
    } catch (error) {
      console.error("Failed to fetch featured packages:", error);
    } finally {
      setLoading(false);
    }
  };

  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="hero-section relative bg-gradient-to-r from-orange-500 to-orange-600 text-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Discover the Magic of Bhutan
              </h1>
              <p className="text-xl lg:text-2xl text-orange-100">
                Experience authentic culture, breathtaking landscapes, and
                unforgettable adventures
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/packages"
                  className="bg-white text-orange-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors text-center"
                >
                  Explore Packages
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/register"
                    className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors text-center"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            </div>

            {/* Hero Image */}
            <div className="hidden lg:block">
              <img
                src="/Assets/bhutan-mountains-landscape.png"
                alt="Bhutan Landscape"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Us
            </h2>
            <p className="text-xl text-gray-600">
              Experience the best of Bhutan with our expert guidance
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Expert Guides
              </h3>
              <p className="text-gray-600">
                Local experts who know every hidden gem
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Small Groups
              </h3>
              <p className="text-gray-600">
                Intimate experiences with personalized attention
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Secure Booking
              </h3>
              <p className="text-gray-600">
                JWT & MFA protected for your safety
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Best Value
              </h3>
              <p className="text-gray-600">
                Premium experiences at competitive prices
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Packages Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Featured Tour Packages
            </h2>
            <p className="text-xl text-gray-600">
              Explore our most popular tour packages
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : featuredPackages.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredPackages.map((pkg) => (
                <Link
                  key={pkg._id}
                  to={`/packages/${pkg._id}`}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1"
                >
                  <div className="relative h-48">
                    <img
                      src={
                        pkg.imageUrl ||
                        "/placeholder.svg?height=200&width=400&query=tour"
                      }
                      alt={pkg.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      ${pkg.price}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {pkg.title}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {pkg.description}
                    </p>
                    <div className="text-sm text-gray-500 mb-3">
                      {typeof pkg.bookingsCount !== "undefined" && (
                        <span className="font-medium text-gray-700">
                          {pkg.bookingsCount}
                        </span>
                      )}
                      <span className="ml-1">
                        {pkg.bookingsCount === 1 ? "booking" : "bookings"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{pkg.duration} days</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{pkg.location}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No packages available at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-r from-orange-50 to-blue-50">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Browse our curated tour packages and book your dream journey today
          </p>
          <Link
            to="/packages"
            className="inline-block bg-orange-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-orange-600 transition-colors"
          >
            View All Packages
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
