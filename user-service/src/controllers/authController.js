import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseAdmin } from "../services/supabaseClient.js";

/**
 * Registers a new user account.
 *
 * This endpoint creates a new user using Supabase Auth's signUp function.
 * If the registration is successful, the newly created user information
 * is returned.
 *
 * Endpoint:
 *   POST /auth/signup
 *
 * Body:
 *   {
 *     username: string,
 *     email: string,
 *     password: string
 *   }
 *
 * Behavior:
 *   - Extracts username, email, and password from the request body.
 *   - Calls Supabase Auth to create a new user account.
 *   - Stores the username as part of the user's metadata.
 *   - Returns the created user information if registration is successful.
 *
 * Returns:
 *   201 Created
 *   {
 *     message: "User registered",
 *     user: <user_object>
 *   }
 *
 * Errors:
 *   400 Bad Request - Password validation failed
 *   400 Bad Request - Duplicate username or email
 *
 * @param {Request} req - Express request object containing user registration details.
 * @param {Response} res - Express response object used to return the registration result.
 */
export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // check for duplicate username
    const { data: existing } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        code: "DUPLICATE_USERNAME",
        message: "Username already taken.",
      });
    }

    // check for duplicate email
    const { data: existingEmail } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("id")
      .eq("email", email  )
      .maybeSingle();

    if (existingEmail) {
      return res.status(400).json({
        code: "DUPLICATE_EMAIL",
        message: "Email already associated with an account.",
      });
    }

    // attempt to add user to database
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://localhost:5173/verified",
        data: {
          username: username,
        },
      },
    });

    if (error && error.status === 429) {
      // Supabase has internal rate limit of 2 emails per hour. Any emails sent beyond that will fail with an error.
      return res.status(429).json({
        code: "RATE_EXCEEDED",
        message: "Failed to send confirmation email due to internal rate limit. Try again later.",
      });
    }

    res.status(201).json({
      code: "SUCCESS",
      message: "User registered successfully",
      user: data.user,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

/**
 * Authenticates a user using email and password.
 *
 * This endpoint logs in a user by calling Supabase Auth's
 * signInWithPassword function. If the credentials are valid,
 * an access token is returned which can be used to authenticate
 * subsequent requests to protected endpoints.
 *
 * Endpoint:
 *   POST /auth/login
 *
 * Body:
 *   {
 *     email: string,
 *     password: string
 *   }
 *
 * Behavior:
 *   - Extracts the email and password from the request body.
 *   - Calls Supabase Auth to authenticate the user.
 *   - Returns an access token if authentication is successful.
 *
 * Returns:
 *   200 OK
 *   {
 *     accessToken: "<jwt_access_token>"
 *   }
 *
 * Errors:
 *   401 Unauthorized - Invalid email or password
 *
 * @param {Request} req - Express request object containing the user's login credentials.
 * @param {Response} res - Express response object used to return the authentication result.
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
  }

  res.json({
    accessToken: data.session.access_token,
  });
};

/**
 * Logs out the currently authenticated user.
 *
 * This endpoint invalidates the user's authentication session by calling
 * Supabase Auth's signOut function using the access token provided in the
 * Authorization header.
 *
 * Endpoint:
 *   POST /auth/logout
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Behavior:
 *   - Extracts the access token from the Authorization header.
 *   - Calls Supabase Auth to terminate the user's session.
 *   - Returns a success message if logout is successful.
 *
 * Returns:
 *   200 OK
 *   {
 *     message: "Logged out successfully"
 *   }
 *
 * Errors:
 *   400 Bad Request - Logout failed
 *
 * @param {Request} req - Express request object containing the Authorization header.
 * @param {Response} res - Express response object used to return the logout result.
 */
export const logout = async (req, res) => {
  const supabase = req.supabase;

  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(400).json({
      code: "LOGOUT_FAILED",
      message: "Logout failed",
    });
  }

  return res.status(200).json({
    code: "SUCCESS",
    message: "Logged out successfully",
  });
};

/**
 * Gets only the current user's profile information based on
 * the provided JWT access token.
 *
 * This endpoint verifies the JWT access token provided in the
 * Authorization header and retrieves the corresponding user's
 * profile information from the userservice.profiles table.
 *
 * This function is intended to be called by other services to
 * validate the identity and user role of the requesting user.
 *
 * Endpoint:
 *   GET /user/getUserInfo
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Returns:
 *   200 OK
 *   {
 *     id: string,
 *     username: string,
 *     email: string,
 *     isAdmin: boolean
 *   }
 *
 * Errors:
 *   401 Unauthorized – Missing or invalid token
 *   500 Internal Server Error – Profile lookup failure
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const getUserInfo = async (req, res) => {
  const supabase = req.supabase;
  const userId = req.userId;

  const { data: profile, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("id, username, user_role")
    .eq("id", userId)
    .single();

  if (error) {
    return res.status(500).json({
      code: "PROFILE_NOT_FOUND",
      message: "Error retrieving profile",
    });
  }

  if (!profile) {
    return res.status(404).json({
      code: "PROFILE_NOT_FOUND",
      message: "Profile not found",
    });
  }

  res.json({
    id: userId,
    username: profile.username,
    email: req.userEmail,
    isAdmin: profile.user_role === "admin",
  });
};

/**
 * Updates the username of the currently authenticated user.
 *
 * This endpoint allows a logged-in user to change their username.
 * The user's identity is verified using the access token provided
 * in the Authorization header. The new username is checked to ensure
 * it is not already taken before updating the user's profile in the
 * database.
 *
 * Endpoint:
 *   PATCH /user/username
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Body:
 *   {
 *     username: string
 *   }
 *
 * Behavior:
 *   - Extracts the access token from the Authorization header.
 *   - Verifies the token using Supabase Auth.
 *   - Retrieves the authenticated user's ID.
 *   - Checks if the requested username already exists in the profiles table.
 *   - Updates the username in the userservice.profiles table if it is available.
 *   - Returns the updated username upon success.
 *
 * Returns:
 *   200 OK
 *   {
 *     message: "Username updated successfully",
 *     username: "<updated_username>"
 *   }
 *
 * Errors:
 *   401 Unauthorized - Missing or invalid authentication token
 *   400 Bad Request - Username is required
 *   400 Bad Request - Username already taken
 *   500 Internal Server Error - Failed to update username
 *
 * @param {Request} req - Express request object containing the Authorization header and new username.
 * @param {Response} res - Express response object used to return the update result.
 */
export const updateUsername = async (req, res) => {
  const supabase = req.supabase;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      code: "EMPTY_FIELD",
      message: "Username is required",
    });
  }

  const userId = req.userId;

  const { data: existing } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({
      code: "DUPLICATE_FIELD",
      message: "Username already taken",
    });
  }

  const { data, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .update({ username })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      code: "UPDATE_FAILED",
      message: "Failed to update username",
    });
  }

  res.json({
    code: "SUCCESS",
    message: "Username updated successfully",
    username: data.username,
  });
};

/**
 * Promotes a user to the Administrator role.
 *
 * This endpoint allows an authenticated administrator to promote another
 * user to the "admin" role. The requester must provide a valid access token
 * and must already have administrator privileges. The system verifies the
 * requester’s role before updating the target user's role in the database.
 *
 * Endpoint:
 *   PATCH /admin/role/:userId
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Parameters:
 *   userId: string - ID of the user whose role will be updated. (add to URL, not body)
 *
 * Behavior:
 *   - Extracts the access token from the Authorization header.
 *   - Verifies the token using Supabase Auth.
 *   - Retrieves the requester's profile to confirm they are an administrator.
 *   - Retrieves the target user's profile from the database.
 *   - Ensures the target user exists and is not already an administrator.
 *   - Updates the user's role to "admin" in the userservice.profiles table.
 *
 * Returns:
 *   200 OK
 *   {
 *     message: "User promoted to Administrator"
 *   }
 *
 * Errors:
 *   401 Unauthorized - Missing or invalid authentication token
 *   403 Forbidden - Requester is not an administrator
 *   404 Not Found - Target user does not exist
 *   400 Bad Request - User is already an Administrator
 *   500 Internal Server Error - Failed to update user role
 *
 * @param {Request} req - Express request object containing the Authorization header and userId parameter.
 * @param {Response} res - Express response object used to return the role update result.
 */
export const updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.userId;

  const { data: requesterProfile, error: requesterError } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", requesterId)
    .single();

  if (requesterError || !requesterProfile) {
    return res.status(500).json({
      code: "USER_NOT_FOUND",
      message: "Failed to verify admin",
    });
  }

  if (requesterProfile.user_role !== "admin") {
    return res.status(403).json({
      code: "UNAUTHORIZED",
      message: "Only administrators can change user roles",
    });
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", userId)
    .single();

  if (targetError || !targetProfile) {
    return res.status(404).json({
      code: "USER_NOT_FOUND",
      message: "User not found",
    });
  }

  if (targetProfile.user_role === "admin") {
    return res.status(400).json({
      code: "UPDATE_FAILED",
      message: "User is already an Administrator",
    });
  }

  const { error } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .update({ user_role: "admin" })
    .eq("id", userId);

  if (error) {
    return res.status(500).json({
      code: "UPDATE_FAILED",
      message: "Failed to update user role",
    });
  }

  res.json({
    code: "SUCCESS",
    message: "User promoted to Administrator",
  });
};

/**
 * Retrieve ALL users info (admin only).
 *
 * Endpoint:
 *   GET /admin/allUsers
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Returns:
 *   200 OK
 *   [
 *     {
 *       id: string,
 *       username: string,
 *       user_role: string
 *     }...
 *   ]
 *
 * Errors:
 *   401 Unauthorized
 *   403 Forbidden
 */
export const getAllUsers = async (req, res) => {
  const requesterId = req.userId;

  // check requester role
  const { data: requesterProfile, error: requesterError } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", requesterId)
    .single();

  if (requesterError || !requesterProfile) {
    return res.status(500).json({
      code: "USER_NOT_FOUND",
      message: "Failed to verify admin",
    });
  }

  if (requesterProfile.user_role !== "admin") {
    return res.status(403).json({
      code: "UNAUTHORIZED",
      message: "Admin privileges required",
    });
  }

  // get all users
  const { data: users, error } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .select("id, username, user_role");

  if (error) {
    return res.status(500).json({
      code: "FETCH_FAILED",
      message: "Failed to retrieve users",
    });
  }

  // convert user_role to boolean isAdmin
  const formattedUsers = users.map((user) => ({
    id: user.id,
    username: user.username,
    isAdmin: user.user_role === "admin",
  }));

  res.json(formattedUsers);
};

/**
 * Checks whether a given username is available.
 *
 * Endpoint:
 *   GET /user/checkUniqueUsername?username=:userId
 *
 * Query Parameters:
 *   username: string
 *
 * Returns:
 *   200 OK
 *   {
 *     available: boolean
 *   }
 *
 * Errors:
 *   400 Bad Request - Username is not provided
 *   500 Internal Server Error - Failed to query database
 */
export const checkUniqueUsername = async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({
      code: "EMPTY_FIELD",
      message: "Username is required",
    });
  }

  const { data, error } = await supabaseAdmin
    .schema("userservice")
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      code: "QUERY_FAILED",
      message: "Error checking username",
    });
  }

  if (data) {
    return res.status(200).json({
      available: false,
    });
  }

  return res.status(200).json({
    available: true,
  });
};

/**
 * Deletes the currently authenticated user's account.
 * Allows a user to delete their own account only.
 * If the user is an administrator,  system checks that there is
 * at least one other admin remaining before allowing deletion.
 *
 * Endpoint:
 *   DELETE /user/deleteAccount
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Returns:
 *   200 OK
 *   {
 *     code: "SUCCESS",
 *     message: "Account deleted successfully"
 *   }
 *
 * Errors:
 *   401 Unauthorized - Missing or invalid authentication token
 *   400 Bad Request - Cannot delete the last remaining admin
 *   500 Internal Server Error - Failed to delete user profile or auth user
 */
export const deleteOwnAccount = async (req, res) => {
  const db = supabaseAdmin;
  const userId = req.userId;

  const { data: userProfile, error: userError } = await db
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", userId)
    .single();

  if (userError || !userProfile) {
    return res.status(500).json({
      code: "PROFILE_FETCH_FAILED",
      message: "Failed to retrieve user profile",
    });
  }

  // If admin, check if last admin
  if (userProfile.user_role === "admin") {
    const { count, error: countError } = await db
      .schema("userservice")
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("user_role", "admin");

    if (countError) {
      return res.status(500).json({
        code: "COUNT_FAILED",
        message: "Failed to check admin count",
      });
    }

    if (count <= 1) {
      return res.status(400).json({
        code: "LAST_ADMIN",
        message: "Cannot delete the last remaining admin",
      });
    }
  }

  const { error: deleteProfileError } = await db
    .schema("userservice")
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (deleteProfileError) {
    return res.status(500).json({
      code: "DELETE_FAILED",
      message: "Failed to delete user profile",
    });
  }

  const { error: deleteAuthError } = await db.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    return res.status(500).json({
      code: "DELETE_FAILED",
      message: "Failed to delete auth user",
    });
  }

  res.json({
    code: "SUCCESS",
    message: "Account deleted successfully",
  });
};

/**
 * Sends request to Supabase Auth to trigger password reset email.
 *
 * Endpoint:
 *   POST /auth/requestResetPassword
 *
 * Body:
 *   {
 *     email: string
 *   }
 *
 * Returns:
 *   200 OK
 *   {
 *     code: "SUCCESS",
 *     message: "Password reset email sent"
 *   }
 *
 * Errors:
 *   500 Internal Server Error - Failed to send reset email
 */
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "http://localhost:5173/reset-password",
  });

  if (error) {
    return res.status(500).json({
      code: "RESET_FAILED",
      message: "Failed to send reset email due to internal rate limit. Try again later.",
    });
  }

  res.json({
    code: "SUCCESS",
    message: "Password reset email sent",
  });
};

/**
 * Resets the user's password using Supabase recovery tokens.
 *
 * Endpoint:
 *   POST /auth/resetPassword
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Body:
 *   {
 *     password: string,
 *     refreshToken: string
 *   }
 *
 * Returns:
 *   200 OK
 *   {
 *     code: "SUCCESS"
 *   }
 *
 * Errors:
 *   400 Bad Request - Missing access token
 *   401 Unauthorized - Missing or invalid token
 *   500 Internal Server Error - Failed to reset password
 *
 */
export const resetPassword = async (req, res) => {
  try {
    const { password, refreshToken } = req.body;

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Missing token",
      });
    }

    const userClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
    );

    const { error: sessionError } = await userClient.auth.setSession({
      access_token: token,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error("Session error:", sessionError);
      return res.status(400).json({
        code: "INVALID_TOKEN",
        message: sessionError.message,
      });
    }

    const { error } = await userClient.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error("Update error:", error);
      return res.status(500).json({
        code: "UPDATE_FAILED",
        message: error.message,
      });
    }

    return res.json({
      code: "SUCCESS",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      code: "SERVER_ERROR",
    });
  }
};
