import express, {Request, RequestHandler, Response} from 'express'
import { authMiddleware, RequestWithUser } from "../middleware/authMiddleware";
import { authorizeRoles } from "../middleware/roleMiddleware";
import User from '../models/user';
import { giveConsent, getConsentStatus, getMyActivity, trackUserActivity } from '../controllers/user';
import { getAllUserActivities } from 'controllers/admin';

const router = express.Router();

// Get current user
router.get('/user', authMiddleware, async (req: RequestWithUser, res: Response) => {
  res.json({ user: req.user });
});


router.post('/api/consent', async (req, res) => {
  const { userId } = req.body;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        consent: true,
        consentTimestamp: new Date()
      }
    }
  );

  res.json({ message: 'Consent recorded' });
});

router.post("/track", authMiddleware, trackUserActivity as RequestHandler);
router.get("/my-activity", authMiddleware, getMyActivity as RequestHandler);
router.get("/consent-status", authMiddleware, getConsentStatus);
router.post("/consent", authMiddleware, giveConsent);

// Admin route
router.get("/admin", authMiddleware, authorizeRoles("admin"), (req: Request, res: Response) => {
  res.json({ message: "Welcome Admin!" });
});

router.get("/admin/user-activity", authMiddleware, authorizeRoles("admin"), getAllUserActivities);

export default router;