import EmailCampaign, { IEmailCampaign } from '../models/emailCampaign';
import DiscountCode from '../models/discount-codes';
import Order from '../models/order';
import User from '../models/user';
import { sendWelcomeEmail, sendPromoFollowupEmail } from '../lib/emailService';

export class EmailCampaignService {

  /**
   * Schedule welcome email for new user
   */
  static async scheduleWelcomeEmail(userId: string, email: string, username: string): Promise<void> {
    try {
      // Send welcome email immediately
      const emailSent = await sendWelcomeEmail(email, { username, userId });

      // Create campaign record
      await EmailCampaign.create({
        userId,
        email,
        campaignType: 'welcome',
        status: emailSent ? 'sent' : 'failed',
        scheduledAt: new Date(),
        sentAt: emailSent ? new Date() : undefined
      });

      // Schedule promo follow-up email for 2 days later
      const followupDate = new Date();
      followupDate.setDate(followupDate.getDate() + 2);

      await EmailCampaign.create({
        userId,
        email,
        campaignType: 'promo_followup',
        status: 'pending',
        scheduledAt: followupDate
      });

      console.log('Welcome email campaign scheduled for user:', userId);
    } catch (error) {
      console.error('Error scheduling welcome email campaign:', error);
    }
  }

  /**
   * Process pending email campaigns
   */
  static async processPendingCampaigns(): Promise<void> {
    try {
      const now = new Date();

      // Get pending campaigns that are due
      const pendingCampaigns = await EmailCampaign.find({
        status: 'pending',
        scheduledAt: { $lte: now }
      }).populate('userId');

      console.log(`Processing ${pendingCampaigns.length} pending email campaigns`);

      for (const campaign of pendingCampaigns) {
        try {
          await this.processCampaign(campaign);
        } catch (error) {
          console.error(`Error processing campaign ${campaign._id}:`, error);
          // Mark campaign as failed
          campaign.status = 'failed';
          await campaign.save();
        }
      }
    } catch (error) {
      console.error('Error processing pending campaigns:', error);
    }
  }

  /**
   * Process individual campaign
   */
  private static async processCampaign(campaign: IEmailCampaign): Promise<void> {
    const user = campaign.userId as any;

    if (campaign.campaignType === 'promo_followup') {
      // Check if user has made any purchases
      const hasOrders = await Order.findOne({
        user: campaign.userId,
        status: 'completed'
      });

      if (hasOrders) {
        // User has already made a purchase, skip promo email
        campaign.status = 'sent'; // Mark as sent to avoid reprocessing
        await campaign.save();
        console.log(`Skipping promo email for user ${user.email} - already made purchase`);
        return;
      }

      // Generate or get existing promo code for this user
      const promoCode = await this.getOrCreatePromoCode(campaign.userId.toString(), user.email);

      if (!promoCode) {
        throw new Error('Failed to create promo code');
      }

      // Calculate expiry date (7 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const promoData = {
        promoCode: promoCode.code,
        discountPercentage: promoCode.discountValue,
        expiryDate: expiryDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        daysLeft: 7
      };

      // Send promo email
      const emailSent = await sendPromoFollowupEmail(
        campaign.email,
        { username: user.username, userId: user._id.toString() },
        promoData
      );

      // Update campaign
      campaign.status = emailSent ? 'sent' : 'failed';
      campaign.sentAt = emailSent ? new Date() : undefined;
      campaign.promoCode = promoCode.code;
      campaign.metadata = {
        discountPercentage: promoData.discountPercentage,
        expiryDate: expiryDate,
        daysLeft: promoData.daysLeft
      };

      await campaign.save();
    }
  }

  /**
   * Get or create promo code for user
   */
  private static async getOrCreatePromoCode(userId: string, email: string): Promise<any> {
    try {
      // Check if user already has a welcome promo code
      const existingCode = await DiscountCode.findOne({
        description: { $regex: `Welcome discount for ${email}`, $options: 'i' }
      });

      if (existingCode && existingCode.isActive && existingCode.expiryDate > new Date()) {
        return existingCode;
      }

      // Generate unique promo code
      const codeBase = 'WELCOME' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create new discount code
      const promoCode = await DiscountCode.create({
        code: codeBase,
        description: `Welcome discount for ${email}`,
        discountType: 'PERCENTAGE',
        discountValue: 15, // 15% discount
        minPurchaseAmount: 299, // Minimum purchase of ₹299
        maxDiscountAmount: 500, // Maximum discount of ₹500
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        usageLimit: 1, // One time use
        isActive: true,
        createdBy: userId
      });

      console.log(`Created promo code ${promoCode.code} for user ${email}`);
      return promoCode;
    } catch (error) {
      console.error('Error creating promo code:', error);
      return null;
    }
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(): Promise<any> {
    try {
      const stats = await EmailCampaign.aggregate([
        {
          $group: {
            _id: {
              campaignType: '$campaignType',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      return stats;
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      return [];
    }
  }

  /**
   * Clean up old campaigns (older than 30 days)
   */
  static async cleanupOldCampaigns(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await EmailCampaign.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        status: { $in: ['sent', 'failed'] }
      });

      console.log(`Cleaned up ${result.deletedCount} old email campaigns`);
    } catch (error) {
      console.error('Error cleaning up old campaigns:', error);
    }
  }
}

export default EmailCampaignService;