import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { sendSuccess } from "../utils/response";

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, { user: req.user });
    } catch (err) {
      next(err);
    }
  }

  async getStaffUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await authService.getStaffUsers();
      return sendSuccess(res, users);
    } catch (err) {
      next(err);
    }
  }

  async revokeSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const executedById = req.user!.id;

      const result = await authService.revokeSessions(id, reason, executedById);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
