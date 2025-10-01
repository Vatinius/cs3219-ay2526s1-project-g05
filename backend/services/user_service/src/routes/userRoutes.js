import { Router } from "express";

/**
 * @typedef RegisterBody
 * @property {string} username.required - Username for the new user
 * @property {string} email.required - Email for the new user
 * @property {string} password.required - Password for the new user
 */

/**
 * @typedef LoginBody
 * @property {string} email.required - Email of the user
 * @property {string} password.required - Password of the user
 */

/**
 * @typedef UpdateUserBody
 * @property {string} username - New username for the user
 * @property {string} email - New email for the user
 */

/**
 * @typedef PasswordResetRequestBody
 * @property {string} email.required - Email of the user
 */

/**
 * @typedef PasswordResetConfirmBody
 * @property {string} token.required - Password reset token
 * @property {string} newPassword.required - New password for the user
 */


export const createUserRouter = (controller) => {
  const router = Router();

  /**
   * POST /register
   * @summary Register a new user
   * @param {RegisterBody} request.body.required - Registration payload
   * @return {object} 201 - User created successfully
   * @return {object} 400 - Bad request
   */
  router.post("/register", controller.register);

  /**
   * POST /login
   * @summary Login a user
   * @param {LoginBody} request.body.required - Login payload
   * @return {object} 200 - Login successful
   * @return {object} 400 - Bad request
   * @return {object} 401 - Unauthorized
   */
  router.post("/login", controller.login);

  /**
   * GET /:id
   * @summary Get user by ID
   * @param {string} id.path.required - ID of the user
   * @return {object} 200 - User found
   * @return {object} 404 - User not found
   */
  router.get("/:id", controller.getById);

  /**
   * PATCH /:id
   * @summary Update user by ID
   * @param {string} id.path.required - ID of the user
   * @param {UpdateUserBody} request.body - Fields to update
   * @return {object} 200 - User updated successfully
   * @return {object} 400 - Bad request
   * @return {object} 404 - User not found
   */
  router.patch("/:id", controller.update);

  /**
   * DELETE /:id
   * @summary Delete user by ID
   * @param {string} id.path.required - ID of the user
   * @return {object} 200 - User deleted successfully
   * @return {object} 404 - User not found
   */
  router.delete("/:id", controller.delete);

  /**
   * POST /password-reset/request
   * @summary Request a password reset
   * @param {PasswordResetRequestBody} request.body.required - Email payload
   * @return {object} 200 - Password reset email sent
   * @return {object} 400 - Bad request
   * @return {object} 404 - User not found
   */
  router.post("/password-reset/request", controller.requestPasswordReset);

  /**
   * POST /password-reset/confirm
   * @summary Confirm a password reset
   * @param {PasswordResetConfirmBody} request.body.required - Reset payload
   * @return {object} 200 - Password reset successful
   * @return {object} 400 - Bad request
   * @return {object} 404 - User not found
   */
  router.post("/password-reset/confirm", controller.resetPassword);

  return router;
};
