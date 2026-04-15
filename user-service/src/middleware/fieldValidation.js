/**
 * Middleware: validatePassword
 *
 * Validates the strength and presence of a password in the request body.
 *
 * Checks:
 * - Password must be provided
 * - Minimum length of 8 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one numeric digit
 * - Contains at least one special character (!@#$%^&*())
 *
 * If validation fails:
 * - Returns 400 Bad Request with error message
 *
 * If validation passes:
 * - Calls next() to proceed to the next middleware or controller
 *
 * @param {Request} req - Express request object containing password in req.body
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
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

/**
 * Middleware: validateUsername
 *
 * Validates the format and presence of a username in the request body.
 *
 * Checks:
 * - Username must be provided
 * - Maximum length of 20 characters
 * - Must not contain whitespace
 * - Must only contain lowercase letters, numbers, underscores, or hyphens
 *
 * If validation fails:
 * - Returns 400 Bad Request with error message
 *
 * If validation passes:
 * - Calls next() to proceed to the next middleware or controller
 *
 * @param {Request} req - Express request object containing username in req.body
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
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