import mongoose, { Document, Schema } from "mongoose";

export interface IEmailCampaign extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  campaignType: 'welcome' | 'promo_followup';
  status: 'pending' | 'sent' | 'failed';
  scheduledAt: Date;
  sentAt?: Date;
  promoCode?: string;
  metadata?: {
    discountPercentage?: number;
    expiryDate?: Date;
    daysLeft?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EmailCampaignSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  campaignType: {
    type: String,
    enum: ['welcome', 'promo_followup'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  sentAt: {
    type: Date
  },
  promoCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  metadata: {
    discountPercentage: { type: Number },
    expiryDate: { type: Date },
    daysLeft: { type: Number }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
EmailCampaignSchema.index({ userId: 1 });
EmailCampaignSchema.index({ email: 1 });
EmailCampaignSchema.index({ campaignType: 1 });
EmailCampaignSchema.index({ status: 1 });
EmailCampaignSchema.index({ scheduledAt: 1 });

const EmailCampaign = mongoose.models.EmailCampaign || 
  mongoose.model<IEmailCampaign>('EmailCampaign', EmailCampaignSchema);

export default EmailCampaign;