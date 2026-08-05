export const MESSAGES = {
  AUTH: {
    REGISTER_SUCCESS: "User registration completed successfully.",
    LOGIN_SUCCESS: "User login completed successfully.",
    LOGOUT_SUCCESS: "User logged out successfully.",
    UNAUTHORIZED: "Missing or invalid authorization token.",
    REFRESH_SUCCESS: "Access token refreshed successfully.",
    FORGOT_PASSWORD_SUCCESS: "A password reset link has been dispatched to your email address.",
    RESET_PASSWORD_SUCCESS: "Password updated successfully.",
    INVALID_CREDENTIALS: "Invalid email or password credentials provided.",
    EMAIL_ALREADY_EXISTS: "An account has already been registered with this email address.",
    FORBIDDEN: "Access denied. You do not possess the required user roles for this Resource.",
    USER_NOT_FOUND: "No user account matches the provided identifier.",
  },
  VALIDATION: {
    FAILED: "Request input validation checks failed.",
  },
  SYSTEM: {
    HEALTHY: "Server and ecosystem components are operational.",
    NOT_FOUND: "The requested route resource could not be located on the server.",
    ERROR: "An unexpected internal server exception occurred.",
  },
};
