import { supabase } from "../services/supabaseClient.js";


export const requireAuth = async (req, res, next) => {

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authorization token required"
    });
  }

  // verify token with Supabase
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Invalid or expired token"
    });
  }

  // attach useful info to request
  req.userId = data.user.id;
  req.userEmail = data.user.email;

  next();
};


export const requireAdmin = async (req, res, next) => {

  const { data: profile, error } = await supabase
    .schema("userservice")
    .from("profiles")
    .select("user_role")
    .eq("id", req.userId)
    .single();

  if (error || !profile) {
    console.log("Error fetching user profile:", error);
    return res.status(404).json({
      code: "PROFILE_NOT_FOUND",
      message: "User profile not found"
    });
  }

  if (profile.user_role !== "admin") {
    return res.status(403).json({
      code: "UNATHORIZED",
      message: "Admin privileges required"
    });
  }

  next();
};