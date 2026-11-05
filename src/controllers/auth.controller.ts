import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { sendSuccess } from "../utils/response";

/**
 * HTTP handlers for staff authentication, profile introspection, and session revocation.
 */
export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  /**
   * Authenticates staff credentials and returns a signed JWT alongside user profile details.
   */
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Returns the identity and role claims resolved by the JWT authentication middleware.
   */
  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccess(res, { user: req.user });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists active staff accounts eligible for CRM lead and schedule assignments.
   */
  getStaffUsers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.authService.getStaffUsers();
      return sendSuccess(res, users);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Invalidates all active JWTs for the target user by incrementing their session version.
   */
  revokeSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const executedById = req.user!.id;

      const result = await this.authService.revokeSessions(id, reason, executedById);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a new staff account. Route-level `requireAdmin` already limits access.
   */
  createStaffUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.createStaffUser(req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates a staff member's identity or active status.
   */
  updateStaffUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await this.authService.updateStaffUser(
        id,
        req.body,
        req.user!.id
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Resets another staff member's password without asking for their old password.
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { password } = req.body;
      const result = await this.authService.resetPassword(
        id,
        password,
        req.user!.id
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Changes the authenticated user's own password after verifying the current one.
   */
  changeOwnPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await this.authService.changeOwnPassword(
        req.user!.id,
        currentPassword,
        newPassword
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
