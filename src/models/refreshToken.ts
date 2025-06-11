// models/refreshToken.ts - New model for refresh tokens
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

// Auto-delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

// utils/jwt.ts - Updated JWT utilities
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshToken from '../models/refreshToken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const generateTokens = async (
  userId: string, 
  userAgent?: string, 
  ip?: string
) => {
  // Short-lived access token (15-30 minutes)
  const accessToken = jwt.sign(
    { userId }, 
    JWT_SECRET, 
    { expiresIn: '90d' }
  );
  
  // Generate refresh token
  const refreshTokenString = crypto.randomBytes(64).toString('hex');
  
  // Save refresh token to database
  const refreshToken = new RefreshToken({
    userId,
    token: refreshTokenString,
    deviceInfo: {
      userAgent,
      ip
    }
  });
  
  await refreshToken.save();
  
  return {
    accessToken,
    refreshToken: refreshTokenString
  };
};

export const refreshAccessToken = async (refreshTokenString: string) => {
  const refreshToken = await RefreshToken.findOne({
    token: refreshTokenString,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
  
  if (!refreshToken) {
    throw new Error('Invalid refresh token');
  }
  
  // Generate new access token
  const accessToken = jwt.sign(
    { userId: refreshToken.userId }, 
    JWT_SECRET, 
    { expiresIn: '90d' }
  );
  
  return { accessToken };
};

export const revokeRefreshToken = async (refreshTokenString: string) => {
  await RefreshToken.updateOne(
    { token: refreshTokenString },
    { isRevoked: true }
  );
};