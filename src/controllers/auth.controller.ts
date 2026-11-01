import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { sendSuccess } from "../utils/response";

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccess(res, { user: req.user });
    } catch (err) {
      next(err);
    }
  };

  getStaffUsers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.authService.getStaffUsers();
      return sendSuccess(res, users);
    } catch (err) {
      next(err);
    }
  };

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
}
