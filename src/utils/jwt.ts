import jwt from "jsonwebtoken";
import { IUser } from "../models/user";
import crypto from 'crypto';
import RefreshToken from '../models/refreshToken';

/**
 * Interface for JWT token payload
 */
interface TokenPayload {
  userId: string;
  role: string;
  consent: boolean;
}

/**
 * Generate a JWT access token for a user
 * @param user The user object to generate a token for
 * @returns JWT token string
 */
export const generateToken = (user: IUser) => {
  return jwt.sign(
    { 
      userId: user._id, 
      role: user.role, 
      consent: user.consent 
    }, 
    process.env.JWT_SECRET as string, 
    {
      expiresIn: "90d",
    }
  );
};

/**
 * Verify and decode a JWT token
 * @param token The token to verify
 * @returns Decoded token payload
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};

/**
 * Generate both access and refresh tokens
 * @param userId User ID for the tokens
 * @param userAgent User agent for device tracking (optional)
 * @param ip IP address for device tracking (optional)
 * @returns Object containing access token and refresh token
 */
export const generateTokenPair = async (
  userId: string,
  role: string = 'user',
  consent: boolean = false,
  userAgent?: string,
  ip?: string
) => {
  // Generate access token
  const accessToken = jwt.sign(
    { userId, role, consent },
    process.env.JWT_SECRET as string,
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

/**
 * Refresh an access token using a refresh token
 * @param refreshTokenString The refresh token string
 * @returns New access token
 */
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
    { 
      userId: refreshToken.userId,
      // You would need to get these from the user document
      role: 'user', // Default, should be replaced with actual user role
      consent: false // Default, should be replaced with actual user consent
    }, 
    process.env.JWT_SECRET as string, 
    { expiresIn: '90d' }
  );
  
  return { accessToken };
};

/**
 * Revoke a refresh token
 * @param refreshTokenString The refresh token to revoke
 */
export const revokeRefreshToken = async (refreshTokenString: string) => {
  await RefreshToken.updateOne(
    { token: refreshTokenString },
    { isRevoked: true }
  );
};