import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, X, Upload } from "lucide-react";
import api from "../../utils/api";

const AdminPackages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration: "",
    price: "",
    location: "",
    maxGroupSize: "",
    availableSpots: "",
    category: "cultural",
    imageUrl: "",
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await api.getPackages();
      const packagesData =
        response.data ||
        response.packages ||
        (Array.isArray(response) ? response : []);
      setPackages(packagesData);
    } catch (err) {
      console.error("Failed to fetch packages:", err);
      alert("Failed to load packages: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        // Update package
        await api.updatePackage(editingPackage._id, formData);
      } else {
        // Create new package
        await api.createPackage(formData);
      }
      setShowModal(false);
      resetForm();
      fetchPackages();
    } catch (err) {
      console.error("Error saving package:", err);
      const errorMessage = err.message || "Failed to save package";
      alert(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this package?")) {
      return;
    }
    try {
      await api.deletePackage(id);
      fetchPackages();
    } catch (err) {
      console.error("Error deleting package:", err);
      const errorMessage = err.message || "Failed to delete package";
      alert(errorMessage);
    }
  };

  const openEditModal = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      title: pkg.title,
      description: pkg.description,
      duration: pkg.duration,
      price: pkg.price,
      location: pkg.location,
      maxGroupSize: pkg.maxGroupSize,
      availableSpots: pkg.availableSpots,
      category: pkg.category || "cultural",
      imageUrl: pkg.imageUrl || "",
    });
    setImagePreview(pkg.imageUrl || null);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPackage(null);
    setImagePreview(null);
    setFormData({
      title: "",
      description: "",
      duration: "",
      price: "",
      location: "",
      maxGroupSize: "",
      availableSpots: "",
      category: "cultural",
      imageUrl: "",
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const response = await api.uploadImage(file);
      if (response.imageUrl) {
        setFormData({ ...formData, imageUrl: response.imageUrl });
      } else {
        throw new Error("No image URL in response");
      }
    } catch (err) {
      console.error("Image upload error:", err);
      alert(err.message || "Failed to upload image");
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Manage Packages
              </h1>
              <p className="text-gray-600 mt-1">
                Create and manage tour packages
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Package
            </button>
          </div>
        </div>
      </div>

      {/* Packages List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg._id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="w-full h-64 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={
                    pkg.imageUrl ||
                    `/placeholder.svg?height=200&width=400&query=${
                      pkg.title || "/placeholder.svg"
                    }`
                  }
                  alt={pkg.title}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {pkg.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {pkg.description}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <span>{pkg.duration} days</span>
                  <span className="font-bold text-orange-600">
                    ${pkg.price}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(pkg._id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingPackage ? "Edit Package" : "Create New Package"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    required
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Group Size
                  </label>
                  <input
                    type="number"
                    value={formData.maxGroupSize}
                    onChange={(e) =>
                      setFormData({ ...formData, maxGroupSize: e.target.value })
                    }
                    required
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Spots
                  </label>
                  <input
                    type="number"
                    value={formData.availableSpots}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        availableSpots: e.target.value,
                      })
                    }
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="cultural">Cultural</option>
                  <option value="adventure">Adventure</option>
                  <option value="nature">Nature</option>
                  <option value="spiritual">Spiritual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Image
                </label>
                <div className="space-y-3">
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center min-h-[200px] max-h-[400px]">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="max-w-full max-h-[400px] w-auto h-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setFormData({ ...formData, imageUrl: "" });
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                        <span className="text-sm text-gray-600">
                          Uploading...
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {imagePreview ? "Change Image" : "Upload Image"}
                        </span>
                      </>
                    )}
                  </label>

                  <p className="text-xs text-gray-500">
                    Max file size: 5MB. Supported formats: JPEG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                >
                  {editingPackage ? "Update Package" : "Create Package"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPackages;
