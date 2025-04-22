import { Router } from "express";
import { checkout, verification } from "../controllers/payment";
import { authMiddleware } from "../middleware/authMiddleware";
import { Request, Response, NextFunction } from "express";

const router = Router();

// Create order with authentication
router.post("/create-order", authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  console.log("🔄 Create-order request received:", {
    headers: req.headers,
    body: req.body,
    user: req.user
  });

  if (!req.user) {
    console.log("❌ Unauthorized: No user found in request");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  checkout(req, res).catch(next);
});

// Verification can stay unauthenticated
router.post("/verification", (req: Request, res: Response, next: NextFunction) => {
  console.log("🔄 Verification request received:", {
    body: req.body
  });
  verification(req, res).catch(next);
});

export default router;
