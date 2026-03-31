import { createClient } from "@supabase/supabase-js";


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