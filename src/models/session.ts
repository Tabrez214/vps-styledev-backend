// models/session.ts - Session model
import mongoose, { Document, Schema } from "mongoose";

export interface ISession extends Document {
  userId: string;
  sessionId: string;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo: {
    userAgent: string;
    ip: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
    location?: string;
  };
  lastActivity: Date;
  createdAt: Date;
}

const SessionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deviceInfo: {
    userAgent: { type: String, required: true },
    ip: { type: String, required: true },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
      default: 'desktop'
    },
    location: String
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance - only for non-unique fields
// sessionId index removed since unique: true already creates an index
SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>('Session', SessionSchema);

// utils/session.ts - Session utilities
import crypto from 'crypto';
import Session from '../models/session';
import User from '../models/user';

export const createSession = async (
  userId: string,
  userAgent: string,
  ip: string
) => {
  const sessionId = crypto.randomBytes(32).toString('hex');

  // Detect device type
  const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' :
    userAgent.toLowerCase().includes('tablet') ? 'tablet' : 'desktop';

  const session = new Session({
    userId,
    sessionId,
    deviceInfo: {
      userAgent,
      ip,
      deviceType
    }
  });

  await session.save();
  return sessionId;
};

export const validateSession = async (sessionId: string) => {
  const session = await Session.findOne({
    sessionId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('userId');

  if (!session) {
    return null;
  }

  // Update last activity
  session.lastActivity = new Date();
  await session.save();

  return session.userId;
};

export const extendSession = async (sessionId: string) => {
  await Session.updateOne(
    { sessionId },
    {
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      lastActivity: new Date()
    }
  );
};

export const revokeSession = async (sessionId: string) => {
  await Session.updateOne(
    { sessionId },
    { isActive: false }
  );
};

// Get all active sessions for a user (for "Manage Devices" feature)
export const getUserSessions = async (userId: string) => {
  return await Session.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};