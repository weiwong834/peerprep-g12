import { supabase } from "../services/supabaseClient.js";

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
        message: "Username already taken."
      });
    }
    
    // attempt to add user to database
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });
  
    // error for duplicate username or email
    if (error) {
      return res.status(400).json({
        code: "DUPLICATE_EMAIL",
        message: "Duplicate email detected."
      });
    }
  
    res.status(201).json({
        code: "SUCCESS",
        message: "User registered successfully",
        user: data.user
    });
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
        message: "Invalid email or password." });
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

    const token = req.headers.authorization?.split(" ")[1];
  
    const { error } = await supabase.auth.signOut(token);
  
    if (error) {
      return res.status(400).json({
        code: "LOGOUT_FAILED",
        message: "Logout failed"
      });
    }
  
    return res.status(200).json({
        code: "SUCCESS",
        message: "Logged out successfully"
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

    const token = req.headers.authorization?.split(" ")[1];
  
    if (!token) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Unauthorized"
      });
    }
  
    const { data: authUser, error: token_error } = await supabase.auth.getUser(token);
  
    if (token_error) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token"
      });
    }
  
    const userId = authUser.user.id;
  
    const { data: profile, error: query_error } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("id, username, user_role")
      .eq("id", userId)
      .single();
    
    if (query_error) {
    return res.status(500).json({
        code: "PROFILE_NOT_FOUND",
        message: "Error retrieving profile"
    });
    }
    
    if (!profile) {
    return res.status(404).json({
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found"
    });
    }
    res.json({
      id: userId,
      username: profile.username,
      email: authUser.user.email,
      isAdmin: profile.user_role == "admin"
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

    const token = req.headers.authorization?.split(" ")[1];
    const { username } = req.body;
  
    if (!token) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Unauthorized"
      });
    }
  
    if (!username) {
      return res.status(400).json({
        code: "EMPTY_FIELD",
        message: "Username is required"
      });
    }

    // verify token
    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
  
    if (authError) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token"
      });
    }
  
    const userId = authUser.user.id;
  
    // check for duplicate username
    const { data: existing } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
  
    if (existing) {
      return res.status(400).json({
        code: "DUPLICATE_FIELD",
        message: "Username already taken"
      });
    }
  
    // update username
    const { data, error } = await supabase
      .schema("userservice")
      .from("profiles")
      .update({ username })
      .eq("id", userId)
      .select()
      .single();
  
    if (error) {
      console.error("Username update error:", error);
      return res.status(500).json({
        code: "UPDATE_FAILED",
        message: "Failed to update username"
      });
    }
  
    res.json({
        code: "SUCCESS",
        message: "Username updated successfully",
        username: data.username
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

    const token = req.headers.authorization?.split(" ")[1];
    const { userId } = req.params;
  
    if (!token) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Unauthorized"
      });
    }
  
    // Verify token
    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
  
    if (authError) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token"
      });
    }
  
    const requesterId = authUser.user.id;
  
    // Get requester role
    const { data: requesterProfile } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("user_role")
      .eq("id", requesterId)
      .single();
  
    if (requesterProfile.user_role !== "admin") {
      return res.status(403).json({
        code: "UNAUTHORIZED",
        message: "Only administrators can change user roles"
      });
    }
  
    // Get target user role
    const { data: targetProfile } = await supabase
      .schema("userservice")
      .from("profiles")
      .select("user_role")
      .eq("id", userId)
      .single();
  
    if (!targetProfile) {
      return res.status(404).json({
        code: "USER_NOT_FOUND",
        message: "User not found"
      });
    }
  
    // Prevent demotion
    if (targetProfile.user_role === "admin") {
      return res.status(400).json({
        code: "UPDATE_FAILED",
        message: "User is already an Administrator"
      });
    }
  
    // Promote user
    const { error } = await supabase
      .schema("userservice")
      .from("profiles")
      .update({ user_role: "admin" })
      .eq("id", userId);
  
    if (error) {
      return res.status(500).json({
        code: "UPDATE_FAILED",
        message: "Failed to update user role"
      });
    }
  
    res.json({
        code: "SUCCESS",
        message: "User promoted to Administrator"
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

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Unauthorized"
    });
  }

  // verify token
  const { data: authUser, error: authError } = await supabase.auth.getUser(token);

  if (authError) {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Invalid token"
    });
  }

  const requesterId = authUser.user.id;

  // check requester role
  const { data: requesterProfile } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", requesterId)
    .single();

  if (requesterProfile.user_role !== "admin") {
    return res.status(403).json({
      code: "UNATHORIZED",
      message: "Admin privileges required"
    });
  }

  // get all users
  const { data: users, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("id, username, user_role");

  if (error) {
    console.log(error)
    return res.status(500).json({
      code: "FETCH_FAILED",
      message: "Failed to retrieve users"
    });
  }

  // convert user_role to boolean isAdmin
  const formattedUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    isAdmin: user.user_role === "admin"
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
      message: "Username is required"
    });
  }

  const { data, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      code: "QUERY_FAILED",
      message: "Error checking username"
    });
  }

  // if data exists --> username taken
  if (data) {
    return res.status(200).json({
      available: false
    });
  }

  // if no data --> username available
  return res.status(200).json({
    available: true
  });
};
