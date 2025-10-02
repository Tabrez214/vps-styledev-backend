import Session, { ISession } from '../models/session';
import crypto from 'crypto';

export class SessionService {
  /**
   * Create a new session
   */
  static async createSession(
    userId: string,
    userAgent?: string,
    ip?: string
  ): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    await Session.create({
      userId,
      sessionId,
      deviceInfo: {
        userAgent,
        ip,
        deviceId: this.generateDeviceId(userAgent, ip)
      },
      expiresAt
    });

    return sessionId;
  }

  /**
   * Validate session
   */
  static async validateSession(sessionId: string): Promise<ISession | null> {
    const session = await Session.findOne({
      sessionId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      await session.save();
    }

    return session;
  }

  /**
   * Revoke session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    await Session.updateOne(
      { sessionId },
      { isActive: false }
    );
  }

  /**
   * Revoke all sessions for a user
   */
  static async revokeAllUserSessions(userId: string): Promise<void> {
    await Session.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );
  }

  /**
   * Get active sessions for user
   */
  static async getUserSessions(userId: string): Promise<ISession[]> {
    return Session.find({
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ lastActivity: -1 });
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    await Session.deleteMany({
      expiresAt: { $lt: new Date() }
    });
  }

  /**
   * Generate device ID from user agent and IP
   */
  private static generateDeviceId(userAgent?: string, ip?: string): string {
    const data = `${userAgent || 'unknown'}-${ip || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}