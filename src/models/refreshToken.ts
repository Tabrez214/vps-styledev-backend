import mongoose, { Document, Schema } from "mongoose";

export interface IRefreshToken extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  deviceInfo?: {
    userAgent: string;
    ip: string;
    deviceId?: string;
  };
  createdAt: Date;
}

/**
 * Schema for refresh tokens
 */
const RefreshTokenSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    deviceId: String
  }
}, {
  timestamps: true
});

// Auto-delete expired tokens using MongoDB TTL index
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create indexes for better query performance - only for non-unique fields
RefreshTokenSchema.index({ userId: 1 });
// token index removed since unique: true already creates an index
RefreshTokenSchema.index({ isRevoked: 1 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);