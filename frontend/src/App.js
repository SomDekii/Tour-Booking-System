import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Layout Components
import Navbar from "./components/common/Navbar";
import AdminLayout from "./components/admin/AdminLayout"; // AdminLayout.tsx

// Auth Components
import RegisterPage from "./components/auth/RegisterPage";
import UserLoginPage from "./components/auth/UserLoginPage";
import AdminLoginPage from "./components/auth/AdminLoginPage";
import ForgotPasswordPage from "./components/auth/ForgotPasswordPage";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";

// Tourist Components
import HomePage from "./components/tourist/HomePage";
import PackagesList from "./components/tourist/PackagesList";
import PackageDetail from "./components/tourist/PackageDetail";
import MyBookings from "./components/tourist/MyBookings";

// Admin Components
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminPackages from "./components/admin/AdminPackages";
import AdminBookings from "./components/admin/AdminBookings";

// Settings
import SettingsPage from "./pages/SettingsPage";
import Footer from "./components/common/Footer";

// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// PUBLIC ROUTE COMPONENT (redirects if logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/"} replace />;
  }

  return children;
};

// APP CONTENT WITH ROUTES
function AppContent() {
  const location = useLocation();
  // Note: `isAdmin` and `isAuthenticated` are obtained in ProtectedRoute where needed

  const isAdminRoute = location.pathname.startsWith("/admin");

  // Hide navbar for admin, login, and register pages
  const hideNavbar =
    isAdminRoute ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/admin/login" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";

  // Allow admins to access public pages as well (no forced redirect).
  // Admin-only route protection is still handled by `ProtectedRoute(adminOnly)`.

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideNavbar && <Navbar />}

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<HomePage />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <UserLoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/admin/login"
          element={
            <PublicRoute>
              <AdminLoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />

        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* TOURIST ROUTES */}
        <Route path="/packages" element={<PackagesList />} />
        <Route path="/packages/:id" element={<PackageDetail />} />

        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="packages" element={<AdminPackages />} />
                  <Route path="bookings" element={<AdminBookings />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Footer: show on non-admin routes (public and user pages) */}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

// MAIN APP COMPONENT
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
