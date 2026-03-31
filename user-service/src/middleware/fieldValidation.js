export const validatePassword = (req, res, next) => {
  const password = req.body.password;

  if (!password) {
    return res.status(400).json({
      code: "INVALID_PASSWORD",
      message: "Password is required"
    });
  }

  if ((password.length < 8) || 
    (!/[A-Z]/.test(password)) ||
    (!/[a-z]/.test(password)) ||
    (!/[0-9]/.test(password)) || 
    (!/[!@#$%^&*()]/.test(password))) {
        return res.status(400).json({
            code: "INVALID_PASSWORD",
            message: "Passsword is too weak"
            });
  }
  next();
};


export const validateUsername = (req, res, next) => {
  const username = req.body.username;

  if (!username) {
    return res.status(400).json({
      code: "INVALID_USERNAME",
      message: "Username is required"
    });
  }

  if (
    (username.length > 20) ||
    (/\s/.test(username)) ||
    (!/^[a-z0-9_-]+$/.test(username))
  ) {
    return res.status(400).json({
      code: "INVALID_USERNAME",
      message: "Invalid username format"
    });
  }

  next();
};