import { createClient } from "@supabase/supabase-js";

/**
 * Middleware: requireAuth
 *
 * Verifies that the incoming request contains a valid JWT access token.
 * This middleware is used to protect routes that require authentication.
 *
 * If validation fails:
 * - Returns 401 Unauthorized (missing, invalid, or expired token)
 *
 * If validation succeeds:
 * - Attaches useful user information to the request object:
 *   - req.userId (user ID)
 *   - req.userEmail (user email)
 *   - req.supabase (authenticated Supabase client)
 * - Calls next() to proceed
 *
 * @param {Request} req - Express request object containing Authorization header
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireAuth = async (req, res, next) => {

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authorization token required"
    });
  }

  const supabaseWithAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data, error } = await supabaseWithAuth.auth.getUser();

  if (error || !data?.user) {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Invalid or expired token"
    });
  }

  // attach useful info to request
  req.userId = data.user.id;
  req.userEmail = data.user.email;
  req.supabase = supabaseWithAuth;

  next();
};


/**
 * Middleware: requireAdmin
 *
 * Verifies that the authenticated user has administrator privileges.
 * This middleware should be used after requireAuth.
 *
 * If validation fails:
 * - Returns 404 if profile not found
 * - Returns 403 if user is not an admin
 *
 * If validation succeeds:
 * - Calls next() to proceed to the protected admin route
 *
 * @param {Request} req - Express request object containing authenticated user info
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireAdmin = async (req, res, next) => {

  const supabase = req.supabase;

  const { data: profile, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", req.userId)
    .single();

  if (error || !profile) {
    return res.status(404).json({
      code: "PROFILE_NOT_FOUND",
      message: "User profile not found"
    });
  }

  if (profile.user_role !== "admin") {
    return res.status(403).json({
      code: "UNAUTHORIZED",
      message: "Admin privileges required"
    });
  }

  next();
};