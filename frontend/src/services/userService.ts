const API_BASE = "http://localhost:3000";

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

async function authFetch<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("accessToken");
  console.log(`🚀 Making ${options.method || "GET"} request to:`, url);
  console.log(
    "Token being sent:",
    token ? `${token.substring(0, 20)}...` : "No token",
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    // Try to get the response text first for debugging
    const responseText = await response.text();
    console.log("Raw response:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", responseText);
      throw new Error(
        `Invalid JSON response: ${responseText.substring(0, 100)}`,
      );
    }

    if (!response.ok) {
      console.error("Request failed with status:", response.status);
      console.error("Error data:", data);
      throw new Error(data.message || data.error || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

export async function signupUser(
  username: string,
  email: string,
  password: string,
) {
  return authFetch<{
    code: string;
    message: string;
    user: unknown;
  }>(`${API_BASE}/auth/signup`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginUser(email: string, password: string) {
  const data = await authFetch<{
    accessToken: string;
  }>(`${API_BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  localStorage.setItem("accessToken", data.accessToken);
  return data;
}

export async function logoutUser() {
  try {
    const data = await authFetch<{
      code: string;
      message: string;
    }>(`${API_BASE}/auth/logout`, {
      method: "POST",
    });

    localStorage.removeItem("accessToken");
    return data;
  } catch (error) {
    localStorage.removeItem("accessToken");
    throw error;
  }
}

export async function getUserInfo() {
  return authFetch<{
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  }>(`${API_BASE}/user/getUserInfo`, {
    method: "GET",
  });
}

export async function updateUsername(username: string) {
  return authFetch<{
    code: string;
    message: string;
    username: string;
  }>(`${API_BASE}/user/username`, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

export async function promoteUser(userId: string) {
  return authFetch<{
    code: string;
    message: string;
  }>(`${API_BASE}/admin/role/${userId}`, {
    method: "PATCH",
  });
}

export async function getAllUsers() {
  return authFetch<
    {
      id: string;
      username: string;
      isAdmin: boolean;
    }[]
  >(`${API_BASE}/admin/allUsers`, {
    method: "GET",
  });
}
