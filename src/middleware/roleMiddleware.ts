import { Response, NextFunction } from "express";
import { RequestWithUser } from "./authMiddleware";

export const authorizeRoles = (...roles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Access denied: Unauthorized role" });
      return;
    }
    next(); // ✅ Ensure next() is called
  };
};
