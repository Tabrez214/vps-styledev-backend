import express, {Request, RequestHandler, Response} from 'express'
import { authMiddleware, RequestWithUser } from "../middleware/authMiddleware";
import { authorizeRoles } from "../middleware/roleMiddleware";


const router = express.Router();

// Get current user
router.get('/user', authMiddleware, async (req: RequestWithUser, res: Response) => {
  res.json({ user: req.user });
});

// Admin route
router.get("/admin", authMiddleware, authorizeRoles("admin"), (req: Request, res: Response) => {
  res.json({ message: "Welcome Admin!" });
});

export default router;