import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../utils/api";
import { Mail, Lock, Shield, ArrowRight, AlertCircle } from "lucide-react";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    mfaCode: "",
  });
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Use admin login endpoint instead of regular login
      const result = await api.adminLogin(
        formData.email,
        formData.password,
        formData.mfaCode
      );

      if (result.requiresMFA) {
        setRequiresMFA(true);
        setLoading(false);
        return;
      }

      // Verify admin role
      if (result.user && result.user.role === "admin") {
        // The tokens are already set by api.adminLogin, just update context
        // Refresh the page to update auth context, or manually trigger context update
        window.location.href = "/admin/dashboard";
      } else {
        setError("Access denied. Admin credentials required.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-gray-600 mt-2">Management dashboard access</p>
          </div>

          {/* Security Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              This portal is restricted to authorized administrators only.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!requiresMFA ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-700 focus:border-transparent outline-none transition"
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-700 focus:border-transparent outline-none transition"
                      placeholder="Enter admin password"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authentication Code
                </label>
                <input
                  type="text"
                  name="mfaCode"
                  value={formData.mfaCode}
                  onChange={handleChange}
                  required
                  maxLength="6"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-700 focus:border-transparent text-center text-2xl tracking-widest outline-none transition"
                  placeholder="000000"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-700 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? "Signing in..."
                : requiresMFA
                ? "Verify Code"
                : "Access Portal"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {requiresMFA && (
            <button
              onClick={() => {
                setRequiresMFA(false);
                setFormData({ ...formData, mfaCode: "" });
              }}
              className="w-full mt-4 text-slate-700 hover:text-slate-800 font-medium"
            >
              Back to Login
            </button>
          )}
        </div>

        {/* User Portal Link */}
        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="text-sm text-gray-300 hover:text-white font-medium"
          >
            Return to user portal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
