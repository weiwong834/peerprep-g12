const API_BASE = "http://localhost:3000";

/**
 * Helper function that automatically attaches the Authorization token.
 */
const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};

/**
 * Signup
 * POST /auth/signup
 */
export const signupUser = async (username, email, password) => {
  return fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, email, password }),
  });
};

/**
 * Login
 * POST /auth/login
 */
export const loginUser = async (email, password) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  // store token automatically
  if (data.accessToken) {
    localStorage.setItem("accessToken", data.accessToken);
  }

  return data;
};

/**
 * Logout
 * POST /auth/logout
 */
export const logoutUser = async () => {
  const data = await authFetch(`${API_BASE}/auth/logout`, {
    method: "POST",
  });

  localStorage.removeItem("accessToken");

  return data;
};

/**
 * Get current user info
 * GET /user/getUserInfo
 * Returns { username, email, user_role }
 *
 * Example to check if user is admin:
 * const user = await getUserInfo();
 * if (user.isAdmin) {
 *  console.log("User is admin");
 * } else {
 *  console.log("User is normal user");
 * }
 */
export const getUserInfo = async () => {
  return authFetch(`${API_BASE}/user/getUserInfo`, {
    method: "GET",
  });
};

/**
 * Update username
 * PUT /user/username
 */
export const updateUsername = async (username) => {
  return authFetch(`${API_BASE}/user/username`, {
    method: "PUT",
    body: JSON.stringify({ username }),
  });
};

/**
 * Promote user to admin
 * PUT /admin/role/:userId
 */
export const promoteUser = async (userId) => {
  return authFetch(`${API_BASE}/admin/role/${userId}`, {
    method: "PUT",
  });
};

/**
 * Get all users (admin only)
 * GET /admin/allUsers
 */
export const getAllUsers = async () => {
  return authFetch(`${API_BASE}/admin/allUsers`, {
    method: "GET",
  });
};

/**
 * Check if there is a duplicate username in the database.
 * GET /user/checkUniqueUsername?username=<username>
 */
export const checkUniqueUsername = async (username) => {
  const params = new URLSearchParams({ username });

  return fetch(`${API_BASE}/user/checkUniqueUsername?${params.toString()}`, {
    method: "GET",
  });
};
