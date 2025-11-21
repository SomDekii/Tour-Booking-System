import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users, DollarSign, MapPin } from "lucide-react";
import api from "../../utils/api";
import { resolveImageSrc } from "../../utils/image";

const PackagesList = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    category: "",
    minPrice: "",
    maxPrice: "",
  });

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Fetching packages with filters:", filters);
        const data = await api.getPackages(filters);

        const packagesArray = Array.isArray(data)
          ? data
          : Array.isArray(data.packages)
          ? data.packages
          : [];
        console.log(`Found ${packagesArray.length} packages`, packagesArray);

        setPackages(packagesArray);
      } catch (err) {
        console.error("Error fetching packages:", err);
        setError(err.message || "Failed to load packages");
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    // Convert empty strings to empty value (will be filtered out in API call)
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: value === "" ? "" : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Subtitle */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Tour Packages
          </h1>
          <p className="text-lg text-gray-600">
            Discover amazing destinations and unforgettable experiences
          </p>
        </div>

        {/* Filters - Compact & Modern Design */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            {/* Category Filter */}
            <div className="flex-1 min-w-0">
              <label
                htmlFor="category"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="adventure">Adventure</option>
                <option value="cultural">Cultural</option>
                <option value="nature">Nature</option>
                <option value="spiritual">Spiritual</option>
              </select>
            </div>

            {/* Min Price */}
            <div className="flex-1 min-w-0">
              <label
                htmlFor="minPrice"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Min Price
              </label>
              <input
                id="minPrice"
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="$0"
              />
            </div>

            {/* Max Price */}
            <div className="flex-1 min-w-0">
              <label
                htmlFor="maxPrice"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Max Price
              </label>
              <input
                id="maxPrice"
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="$10000"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Packages Grid */}
        {!loading && !error && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                No packages found matching your criteria
              </div>
            ) : (
              packages.map((pkg) => (
                <Link
                  key={pkg._id || pkg.id}
                  to={`/packages/${pkg._id || pkg.id}`}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {(() => {
                    const imgPath =
                      pkg?.imageUrl || pkg?.image || pkg?.filename;
                    const title = pkg?.title || pkg?.name || "Package";
                    const imageSrc =
                      resolveImageSrc(imgPath) ||
                      `/placeholder.svg?height=250&width=400&query=${encodeURIComponent(
                        title
                      )}`;
                    console.log(pkg?.image);
                    console.log(pkg?.imageUrl);
                    console.log(imageSrc);

                    console.log(imgPath);

                    return (
                      <div className="w-full h-64 bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img
                          src={imageSrc}
                          alt={title}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      </div>
                    );
                  })()}

                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                        {pkg.category}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {pkg.title || pkg.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {pkg.description}
                    </p>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{pkg.duration} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{pkg.availableSpots} spots available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{pkg.location}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-orange-600 font-bold text-xl">
                        <DollarSign className="w-5 h-5" />
                        {pkg.price}
                      </div>
                      <span className="text-orange-600 font-semibold">
                        View Details →
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PackagesList;
