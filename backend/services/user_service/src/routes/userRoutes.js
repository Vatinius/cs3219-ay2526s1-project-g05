import { Router } from "express";

/**
 * @typedef User
 * @property {string} id.required - The unique identifier of the user
 * @property {string} username.required - The unique username chosen by the user
 * @property {string} email.required - The email address associated with the user
 * @property {string} createdAt.required - ISO timestamp describing when the user was created
 * @property {string} updatedAt.required - ISO timestamp describing when the user was last updated
 */

/**
 * @typedef RegisterRequest
 * @property {string} username.required - Desired username (3-30 characters)
 * @property {string} email.required - Valid email address
 * @property {string} password.required - Password that meets the configured complexity rules
 */

/**
 * @typedef LoginRequest
 * @property {string} email.required - Registered email address
 * @property {string} password.required - User password
 */

/**
 * @typedef UpdateUserRequest
 * @property {string} [username] - New username (if changing)
 * @property {string} [email] - New email address (if changing)
 * @property {string} [password] - New password that meets complexity rules
 */

/**
 * @typedef DeleteUserRequest
 * @property {string} password.required - Current password (used for confirmation)
 */

/**
 * @typedef PasswordResetRequest
 * @property {string} email.required - Email address to send the reset instructions to
 */

/**
 * @typedef PasswordResetConfirmRequest
 * @property {string} token.required - Password reset token received via email
 * @property {string} password.required - New password that meets complexity rules
 */

export const createUserRouter = (controller) => {
  const router = Router();

  /**
   * POST /api/users/register
   * @summary Register a new user account
   * @param {RegisterRequest} request.body.required - Registration payload
   * @return {object} 201 - User successfully registered
   * @return {User} 201.user - The created user (without sensitive fields)
   * @return {object} 400 - Validation failed
   * @return {object} 409 - Email or username already taken
   */
  router.post("/register", controller.register);

  /**
   * POST /api/users/login
   * @summary Authenticate a user with email and password
   * @param {LoginRequest} request.body.required - Login credentials
   * @return {object} 200 - Login successful
   * @return {User} 200.user - The authenticated user (without sensitive fields)
   * @return {object} 400 - Validation failed
   * @return {object} 401 - Invalid email or password
   * @return {object} 423 - Account temporarily locked due to failed attempts
   */
  router.post("/login", controller.login);

  /**
   * GET /api/users/{id}
   * @summary Retrieve a user by their identifier
   * @param {string} id.path.required - The user identifier
   * @return {object} 200 - Success response
   * @return {User} 200.user - The requested user
   * @return {object} 404 - User not found
   */
  router.get("/:id", controller.getById);

  /**
   * PATCH /api/users/{id}
   * @summary Update a user profile
   * @param {string} id.path.required - The user identifier
   * @param {UpdateUserRequest} request.body.required - Fields to update
   * @return {object} 200 - User updated successfully
   * @return {User} 200.user - The updated user
   * @return {object} 400 - Validation failed
   * @return {object} 404 - User not found
   * @return {object} 409 - Email or username conflict
   */
  router.patch("/:id", controller.update);

  /**
   * DELETE /api/users/{id}
   * @summary Delete a user account
   * @param {string} id.path.required - The user identifier
   * @param {DeleteUserRequest} request.body.required - Confirmation payload
   * @return {object} 200 - User deleted successfully
   * @return {object} 400 - Password confirmation missing
   * @return {object} 401 - Invalid password
   * @return {object} 404 - User not found
   */
  router.delete("/:id", controller.delete);

  /**
   * POST /api/users/password-reset/request
   * @summary Request a password reset email
   * @param {PasswordResetRequest} request.body.required - Password reset request payload
   * @return {object} 200 - Response indicating whether the request was accepted
   * @return {string} 200.message - Human readable status message
   * @return {string} [200.resetToken] - Reset token (returned only in non-production environments)
   * @return {string} [200.expiresAt] - Token expiry timestamp (returned only in non-production environments)
   * @return {object} 400 - Invalid email address provided
   */
  router.post("/password-reset/request", controller.requestPasswordReset);

  /**
   * POST /api/users/password-reset/confirm
   * @summary Reset a user's password using a reset token
   * @param {PasswordResetConfirmRequest} request.body.required - Password reset confirmation payload
   * @return {object} 200 - Password reset successfully
   * @return {User} 200.user - The user with the updated password
   * @return {object} 400 - Invalid token or password
   */
  router.post("/password-reset/confirm", controller.resetPassword);

  return router;
};
