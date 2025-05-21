import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        consent: boolean;
      };
    }
  }
}

export type RequestWithUser = Request;

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    console.log("🔄 Auth Middleware - Headers:", {
      authorization: req.headers.authorization
    });

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("❌ No authorization header found");
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    // Clean up the token by removing any extra spaces or characters
    const token = authHeader.replace(/^[Bb]earer[e]?\s+/, '').trim();

    if (!token) {
      console.log("❌ No token found after Bearer prefix");
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    console.log("🔄 Attempting to verify token");
    const decoded = verifyToken(token);
    console.log("✅ Token verified successfully:", decoded);

    req.user = decoded;
    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ message: "Unauthorized: Token has expired" });
    } else {
      res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  }
};
