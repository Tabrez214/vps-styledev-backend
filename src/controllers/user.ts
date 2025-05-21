import { RequestWithUser } from "../middleware/authMiddleware";
import { Response } from "express";
import User from "../models/user";

export const trackUserActivity = async (req: RequestWithUser, res: Response) => {
  const { action, route } = req.body;
  const userId = req.user?.userId;

  const user = await User.findById(userId);
  if (!user || !user.consent) {
    return res.status(403).json({ message: "Tracking not allowed" });
  }

  user.activityLog.push({ action, route, timestamp: new Date() });
  await user.save();

  res.json({ message: "Activity tracked" });
};

export const getMyActivity = async (req: RequestWithUser, res: Response) => {
  const user = await User.findById(req.user?.userId, { activityLog: 1 });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json(user.activityLog);
};

export const giveConsent = async (req: RequestWithUser, res: Response) => {
  const userId = req.user?.userId;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        consent: true,
        consentTimestamp: new Date(),
      },
    }
  );

  res.json({ message: "Consent recorded" });
};

export const getConsentStatus = async (req: RequestWithUser, res: Response) => {
  const userId = req.user?.userId;
  const user = await User.findById(userId, { consent: 1 });
  res.json({ consent: user?.consent });
};
