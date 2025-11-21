const API_URL = process.env.REACT_APP_API_URL || "https://tour-booking-system-server-esgm.onrender.com/api";

class ApiClient {
  constructor() {
    // Use sessionStorage so auth state is isolated per browser tab/window
    this.accessToken = sessionStorage.getItem("accessToken");
    this.refreshToken = sessionStorage.getItem("refreshToken");
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) sessionStorage.setItem("accessToken", accessToken);
    if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
  }

  async refreshAccessToken() {
    try {
      console.log("[v0] Refreshing access token...");
      const response = await fetch(`${API_URL}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.token, this.refreshToken);
        console.log("[v0] Token refreshed successfully");
        return data.token;
      }
      throw new Error("Token refresh failed");
    } catch (error) {
      console.error("[v0] Token refresh error:", error.message);
      this.clearTokens();
      window.location.href = "/login";
      throw error;
    }
  }

  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = isFormData
      ? {}
      : {
          "Content-Type": "application/json",
          ...options.headers,
        };

    const config = {
      headers,
      credentials: "include",
      ...options,
    };

    if (this.accessToken && !options.skipAuth) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      console.log(
        `[v0] API Request: ${options.method || "GET"} ${API_URL}${endpoint}`
      );
      let response = await fetch(`${API_URL}${endpoint}`, config);
      console.log(`[v0] API Response: ${response.status}`);

      if (response.status === 401 && !options.skipAuth) {
        // Clone the response before reading to check if token expired
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        if (data.code === "TOKEN_EXPIRED") {
          console.log("[v0] Token expired, refreshing...");
          await this.refreshAccessToken();
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          response = await fetch(`${API_URL}${endpoint}`, config);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        console.error(
          `[v0] API Error: ${data.message || data.error} (status ${
            response.status
          })`
        );
        // Prefer explicit message, then error detail, then fallback with status
        throw new Error(
          data.message || data.error || `Request failed (${response.status})`
        );
      }

      console.log("[v0] API Success:", data);
      return data;
    } catch (error) {
      console.error(`[v0] API Exception:`, error.message);
      throw error;
    }
  }

  // Auth endpoints
  async login(email, password, mfaCode) {
    console.log("[v0] Attempting login for:", email);
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, mfaCode }),
      skipAuth: true,
    });

    if (data.token) {
      this.setTokens(data.token, data.refreshToken);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      console.log("[v0] Login successful, user:", data.user);
    }

    return data;
  }

  async register(userData) {
    const data = await this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
      skipAuth: true,
    });

    if (data.token) {
      this.setTokens(data.token, data.refreshToken);
      sessionStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  }

  async logout() {
    await this.request("/auth/logout", { method: "POST" });
    this.clearTokens();
  }

  async getCurrentUser() {
    return this.request("/auth/me");
  }

  // MFA endpoints
  async setupMFA() {
    return this.request("/auth/mfa/setup", { method: "POST" });
  }

  async verifyMFA(code) {
    return this.request("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async disableMFA(password) {
    return this.request("/auth/mfa/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  // Password reset endpoints
  async requestPasswordReset(email) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  }

  async resetPassword(token, newPassword) {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
      skipAuth: true,
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // MFA backup codes endpoints
  async generateBackupCodes() {
    return this.request("/auth/mfa/backup-codes", {
      method: "POST",
    });
  }

  async useBackupCode(code) {
    return this.request("/auth/mfa/verify-backup", {
      method: "POST",
      body: JSON.stringify({ code }),
      skipAuth: true,
    });
  }

  // Package endpoints
  async getPackages(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const response = await this.request(
      `/packages${queryString ? `?${queryString}` : ""}`,
      {
        skipAuth: true,
      }
    );
    // Backend returns { success, count, data: packages }
    // Extract the packages array from the response
    return response.data || response.packages || response || [];
  }

  async getPackageById(id) {
    return this.request(`/packages/${id}`, { skipAuth: true });
  }

  // Admin endpoints
  async getAdminStats() {
    return this.request(`/stats`);
  }

  async getAllBookings() {
    return this.request(`/bookings`);
  }

  async updatePackage(id, packageData) {
    return this.request(`/packages/${id}`, {
      method: "PUT",
      body: JSON.stringify(packageData),
    });
  }

  async createPackage(packageData) {
    return this.request("/packages", {
      method: "POST",
      body: JSON.stringify(packageData),
    });
  }

  async deletePackage(id) {
    return this.request(`/packages/${id}`, {
      method: "DELETE",
    });
  }

  async uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    return this.request("/upload", {
      method: "POST",
      body: formData,
    });
  }

  // Booking endpoints
  async createBooking(bookingData) {
    return this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(bookingData),
    });
  }

  async getMyBookings() {
    return this.request("/bookings/my-bookings");
  }

  async updateBookingStatus(bookingId, status) {
    return this.request(`/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async cancelBooking(id) {
    return this.request(`/bookings/${id}/cancel`, { method: "PATCH" });
  }
}

export const api = new ApiClient();
export default api;
