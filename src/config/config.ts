import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  // Server configuration
  PORT: number;
  NODE_ENV: string;

  // MongoDB configuration
  MONGODB_URI: string;

  // JWT configuration
  JWT_SECRET: string;
  JWT_EXPIRY: string;

  // Email configuration
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;

  // Frontend URL for links in emails
  FRONTEND_URL: string;

  // File storage paths
  UPLOADS_DIR: string;
  DESIGNS_PREVIEWS_DIR: string;
  DESIGNS_CHALLANS_DIR: string;
  CLIPART_DIR: string;
  USER_UPLOADS_DIR: string;

  // Pricing configuration
  BASE_TSHIRT_PRICE: number;
  TEXT_PRINTING_COST: number;
  IMAGE_PRINTING_COST: number;
  BACK_DESIGN_COST: number;
  STANDARD_SHIPPING_COST: number;
  RUSH_SHIPPING_COST: number;
  TAX_RATE: number;

}

/**
 * Generate a secure random string for JWT_SECRET
 */
const generateSecureSecret = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Ensure directory exists
 */
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Validate environment configuration
 */
const validateConfig = (config: EnvironmentConfig): void => {
  // Check for critical configuration in production
  if (config.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      console.warn('WARNING: Using auto-generated JWT_SECRET in production. Set a secure JWT_SECRET environment variable.');
    }

    if (!process.env.MONGODB_URI) {
      console.warn('WARNING: Using default MongoDB URI in production. Set a MONGODB_URI environment variable.');
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('WARNING: Email configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    }
  }

  // Ensure upload directories exist
  ensureDirectoryExists(config.UPLOADS_DIR);
  ensureDirectoryExists(config.DESIGNS_PREVIEWS_DIR);
  ensureDirectoryExists(config.DESIGNS_CHALLANS_DIR);
  ensureDirectoryExists(config.CLIPART_DIR);
  ensureDirectoryExists(config.USER_UPLOADS_DIR);
};

/**
 * Create and validate environment configuration
 */
const config: EnvironmentConfig = {
  // Server configuration
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/tshirt-design-app',

  // JWT configuration - ensure a secure secret is always used
  JWT_SECRET: process.env.JWT_SECRET || generateSecureSecret(),
  JWT_EXPIRY: process.env.JWT_EXPIRY || '30d',

  // Email configuration
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.example.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || 'user@example.com',
  SMTP_PASS: process.env.SMTP_PASS || 'password',
  EMAIL_FROM: process.env.EMAIL_FROM || 'designs@styledev.in',

  // Frontend URL for links in emails
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://styledev.in',

  // File storage paths - using absolute paths for consistency
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  DESIGNS_PREVIEWS_DIR: process.env.DESIGNS_PREVIEWS_DIR || path.join(process.cwd(), 'uploads/designs/previews'),
  DESIGNS_CHALLANS_DIR: process.env.DESIGNS_CHALLANS_DIR || path.join(process.cwd(), 'uploads/designs/challans'),
  CLIPART_DIR: process.env.CLIPART_DIR || path.join(process.cwd(), 'uploads/clipart'),
  USER_UPLOADS_DIR: process.env.USER_UPLOADS_DIR || path.join(process.cwd(), 'uploads/user-uploads'),

  // Pricing configuration
  BASE_TSHIRT_PRICE: parseInt(process.env.BASE_TSHIRT_PRICE || '250', 10),
  TEXT_PRINTING_COST: parseInt(process.env.TEXT_PRINTING_COST || '100', 10),
  IMAGE_PRINTING_COST: parseInt(process.env.IMAGE_PRINTING_COST || '100', 10),
  BACK_DESIGN_COST: parseInt(process.env.BACK_DESIGN_COST || '100', 10),
  STANDARD_SHIPPING_COST: parseInt(process.env.STANDARD_SHIPPING_COST || '100', 10),
  RUSH_SHIPPING_COST: parseInt(process.env.RUSH_SHIPPING_COST || '300', 10),
  TAX_RATE: parseFloat(process.env.TAX_RATE || '5'), // 5% as percentage number
};

// Validate the configuration
validateConfig(config);

export default config;
