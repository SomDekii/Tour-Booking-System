let API_URL = process.env.REACT_APP_API_URL || "/api";
// Force the dev proxy when running on localhost in development
try {
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    API_URL = "/api";
  }
} catch (e) {}
console.log(`[frontend] services/api.js using API_URL=${API_URL}`);

class ApiService {
  // -------------------------------
  // TOKEN HANDLING
  // -------------------------------
  setToken(token) {
    localStorage.setItem("token", token);
  }

  setAdminToken(token) {
    localStorage.setItem("adminToken", token);
  }

  getToken() {
    return localStorage.getItem("token");
  }

  getAdminToken() {
    return localStorage.getItem("adminToken");
  }

  clearToken() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  clearAdminToken() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
  } // ------------------------------- // GENERIC REQUEST (FINAL FIX) // -------------------------------

  async request(endpoint, options = {}, admin = false) {
    // 1. Determine if this is an authentication request (login/register)
    const isAuthRequest =
      endpoint.includes("/auth/login") || endpoint.includes("/auth/register"); // 2. Get the token, but only if it's NOT an authentication request

    const token = !isAuthRequest
      ? admin
        ? this.getAdminToken()
        : this.getToken()
      : null;

    // ⭐ FIX: Prevent execution from hitting the unknown custom error at line 65
    // If it's a protected admin request and the token is missing, throw a general error now.
    // This pre-empts the faulty client-side check at line 65.
    if (admin && !isAuthRequest && !token) {
      throw new Error("Authorization token is missing. Please log in.");
    }

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {} // 3. Handle Errors (This is where 401/403 errors from the backend are caught)

    if (!res.ok) {
      throw new Error(
        data?.message || `Request failed with status ${res.status}`
      );
    }

    return { data };
  } // ------------------------------- // USER API // -------------------------------

  auth = {
    register: (user) =>
      this.request("/auth/register", {
        method: "POST",
        body: JSON.stringify(user),
      }),
    login: (email, password) =>
      this.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => this.request("/auth/me"),
    logout: () => {
      this.clearToken();
      return Promise.resolve();
    },
  };

  bookingsAPI = {
    getAll: () => this.request("/bookings"),
    create: (data) =>
      this.request("/bookings", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id, status) =>
      this.request(`/bookings/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
  };

  packagesAPI = {
    getAll: () => this.request("/packages"),
    create: (data) =>
      this.request("/packages", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) =>
      this.request(`/packages/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) => this.request(`/packages/${id}`, { method: "DELETE" }),
  }; // ---------------------------------------------------------------------- // 🔐 ADMIN API // ----------------------------------------------------------------------

  admin = {
    login: (email, password) =>
      this.request(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        true
      ),

    logout: () => {
      this.clearAdminToken();
      return Promise.resolve();
    },

    statsAPI: {
      getDashboard: () => this.request("/stats", {}, true),
    },

    bookingsAPI: {
      getAll: () => this.request("/bookings", {}, true),
      updateStatus: (id, status) =>
        this.request(
          `/bookings/${id}/status`,
          { method: "PATCH", body: JSON.stringify({ status }) },
          true
        ),
    },

    packagesAPI: {
      getAll: () => this.request("/packages", {}, true),
      create: (data) =>
        this.request(
          "/packages",
          { method: "POST", body: JSON.stringify(data) },
          true
        ),
      update: (id, data) =>
        this.request(
          `/packages/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          true
        ),
      delete: (id) =>
        this.request(`/packages/${id}`, { method: "DELETE" }, true),
    },

    usersAPI: {
      getAll: () => this.request("/users", {}, true),
    },
  };
}

const api = new ApiService();

export const authAPI = api.auth;
export const bookingsAPI = api.bookingsAPI;
export const packagesAPI = api.packagesAPI;

export const adminAPI = api.admin;
export default api;
