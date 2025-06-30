import express, { type Response } from "express"
import { authMiddleware, type RequestWithUser } from "../middleware/authMiddleware"
import { authorizeRoles } from "../middleware/roleMiddleware"
import User from "../models/user";
import EmailService from '../services/emailService';

const router = express.Router()

// Instantiate EmailService
const emailService = new EmailService();

// Newsletter endpoint
router.post('/send-newsletter', authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    const { subject, message, recipients } = req.body;

    if (!subject || !message) {
      res.status(400).json({ message: "Subject and message are required" });
      return;
    }

    // If no recipients specified, send to all subscribed users
    let emailList = recipients;
    if (!emailList || emailList.length === 0) {
      const subscribedUsers = await User.find({ newsletterSubscribed: true }).select('email');
      emailList = subscribedUsers.map(user => user.email);
    }

    if (emailList.length === 0) {
      res.status(400).json({ message: "No recipients found" });
      return;
    }

    // Send newsletter emails
    const results = await Promise.allSettled(
      emailList.map(async (email: string) => {
        return emailService.sendNewsletterEmail(email, subject, message);
      })
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    res.status(200).json({
      message: `Newsletter sent successfully`,
      stats: {
        total: emailList.length,
        successful,
        failed
      }
    });
  } catch (error) {
    console.error("Error sending newsletter:", error);
    res.status(500).json({ message: "Failed to send newsletter", error });
  }
});

export default router