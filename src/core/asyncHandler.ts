import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an asynchronous Express route handler and forwards rejected promises
 * to the centralized error middleware so unhandled rejections cannot crash the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
