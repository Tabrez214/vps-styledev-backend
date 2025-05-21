import { RequestWithUser } from "../middleware/authMiddleware";
import { Response } from "express";
import User from "../models/user";

export const getAllUserActivities = async (_req: RequestWithUser, res: Response) => {
  const users = await User.find({ role: "user" }, { username: 1, email: 1, activityLog: 1 });
  res.json(users);
};

export const getUserActivity = async (req: RequestWithUser, res: Response) => {
  const { userId } = req.params;
  const user = await User.findById(userId, { activityLog: 1 });
  res.json(user);
};
