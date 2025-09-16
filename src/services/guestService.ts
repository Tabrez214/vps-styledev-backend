import User, { IUser } from '../models/user';
import jwt from 'jsonwebtoken';

interface GuestUserData {
  email: string;
  phone: string;
  name?: string;
}

interface BillingAddress {
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export class GuestService {
  /**
   * Create or find existing guest user
   * Prevents duplicate users by checking for existing regular users first
   * @param guestData - Email and phone from Razorpay or user input
   */
  static async createOrFindGuest(guestData: GuestUserData): Promise<{ user: IUser; isExistingUser: boolean; userType: 'regular' | 'guest' | 'new' }> {
    try {
      console.log('🔍 Checking for existing users with email:', guestData.email.toLowerCase());

      // First, check if a regular user already exists with this email
      const existingRegularUser = await User.findOne({
        email: guestData.email.toLowerCase(),
        isGuest: false
      });

      console.log('Regular user check result:', existingRegularUser ? 'FOUND' : 'NOT FOUND');

      if (existingRegularUser) {
        console.log('⚠️  Found existing regular user for Express Checkout:', existingRegularUser.email);
        return {
          user: existingRegularUser,
          isExistingUser: true,
          userType: 'regular'
        };
      }

      // Check if guest user already exists with this email
      let guestUser = await User.findOne({
        email: guestData.email.toLowerCase(),
        isGuest: true
      });

      console.log('Guest user check result:', guestUser ? 'FOUND' : 'NOT FOUND');

      if (guestUser) {
        console.log('✅ Found existing guest user:', guestUser.email);
        return {
          user: guestUser,
          isExistingUser: true,
          userType: 'guest'
        };
      }

      // Create new guest user only if no existing user found
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const username = `guest_${timestamp}_${randomSuffix}`;

      console.log('➕ Creating new guest user with email:', guestData.email.toLowerCase());

      guestUser = new User({
        username,
        email: guestData.email.toLowerCase(),
        name: guestData.name || 'Guest User',
        phone: guestData.phone,
        isGuest: true,
        isVerified: false, // Guests are unverified initially
        consent: true, // Assume consent for checkout
        role: 'user'
      });

      await guestUser.save();
      console.log('✅ Created new guest user:', guestUser.email);

      return {
        user: guestUser,
        isExistingUser: false,
        userType: 'new'
      };
    } catch (error: any) {
      console.error('❌ Error creating guest user:', error);

      // Handle duplicate key error specifically
      if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
        console.log('🔄 Duplicate email detected, searching for existing user...');

        // Try to find the existing user with this email
        const existingUser = await User.findOne({
          email: guestData.email.toLowerCase()
        });

        if (existingUser) {
          console.log('🔗 Found existing user for duplicate email:', existingUser.email, 'isGuest:', existingUser.isGuest);

          // Return the existing user regardless of whether they're guest or regular
          return {
            user: existingUser,
            isExistingUser: true,
            userType: existingUser.isGuest ? 'guest' : 'regular'
          };
        }
      }

      throw new Error('Failed to create guest user');
    }
  }

  /**
   * Update guest user with billing address information
   * @param userId - Guest user ID
   * @param billingAddress - Billing address from payment gateway
   */
  static async updateGuestBillingInfo(userId: string, billingAddress: BillingAddress): Promise<IUser | null> {
    try {
      const guestUser = await User.findById(userId);

      if (!guestUser || !guestUser.isGuest) {
        throw new Error('Invalid guest user');
      }

      // Update user information with billing details
      if (billingAddress.name && !guestUser.name.includes('Guest User')) {
        guestUser.name = billingAddress.name;
      }

      if (billingAddress.phone && !guestUser.phone) {
        guestUser.phone = billingAddress.phone;
      }

      // Update address if provided
      if (billingAddress.street || billingAddress.city) {
        guestUser.address = {
          street: billingAddress.street || '',
          city: billingAddress.city || '',
          state: billingAddress.state || '',
          zipCode: billingAddress.zipCode || '',
          country: billingAddress.country || 'India'
        };
      }

      await guestUser.save();
      console.log('✅ Updated guest user billing info:', guestUser.email);

      return guestUser;
    } catch (error) {
      console.error('❌ Error updating guest billing info:', error);
      return null;
    }
  }

  /**
   * Convert guest user to regular user
   * @param userId - Guest user ID
   * @param password - New password
   * @param username - Optional username (will generate if not provided)
   */
  static async claimGuestAccount(userId: string, password: string, username?: string): Promise<IUser> {
    try {
      const guestUser = await User.findById(userId);

      if (!guestUser || !guestUser.isGuest) {
        throw new Error('Invalid guest user');
      }

      // Generate username if not provided
      if (!username) {
        const timestamp = Date.now();
        const emailPrefix = guestUser.email.split('@')[0];
        username = `${emailPrefix}_${timestamp}`;
      }

      // Check if username is already taken
      const existingUser = await User.findOne({ username, isGuest: false });
      if (existingUser) {
        const timestamp = Date.now();
        username = `${username}_${timestamp}`;
      }

      // Update user to regular account
      guestUser.username = username;
      guestUser.password = password; // Will be hashed by pre-save middleware
      guestUser.isGuest = false;
      guestUser.isVerified = true; // Auto-verify claimed accounts

      await guestUser.save();
      console.log('✅ Guest account claimed successfully:', guestUser.email);

      return guestUser;
    } catch (error) {
      console.error('❌ Error claiming guest account:', error);
      throw new Error('Failed to claim guest account');
    }
  }

  /**
   * Find guest user by email
   * @param email - Guest user email
   */
  static async findGuestByEmail(email: string): Promise<IUser | null> {
    try {
      const guestUser = await User.findOne({
        email: email.toLowerCase(),
        isGuest: true
      });

      return guestUser;
    } catch (error) {
      console.error('❌ Error finding guest user:', error);
      return null;
    }
  }

  /**
   * Get all orders for a guest user by email
   * This will be used for showing order history to guests
   * @param email - Guest user email
   */
  static async getGuestOrdersByEmail(email: string) {
    try {
      const guestUser = await this.findGuestByEmail(email);

      if (!guestUser) {
        return [];
      }

      // Import Order model dynamically to avoid circular dependency
      const Order = (await import('../models/order')).default;

      const orders = await Order.find({
        user: guestUser._id,
        status: { $in: ['completed', 'pending'] }
      }).sort({ createdAt: -1 });

      return orders;
    } catch (error) {
      console.error('❌ Error fetching guest orders:', error);
      return [];
    }
  }

  /**
   * Generate temporary token for guest user session
   * @param userId - Guest user ID
   * @param expiresIn - Token expiration time (default: 24h)
   */
  static generateGuestToken(userId: string, expiresIn: string = '24h'): string {
    try {
      const payload = { userId, type: 'guest' };
      const secret = process.env.JWT_SECRET as string;
      const options = { expiresIn: expiresIn as any };

      return jwt.sign(payload, secret, options);
    } catch (error) {
      console.error('❌ Error generating guest token:', error);
      throw new Error('Failed to generate guest token');
    }
  }

  /**
   * Check if an email belongs to a guest user
   * @param email - Email to check
   */
  static async isGuestEmail(email: string): Promise<boolean> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      return user ? user.isGuest : false;
    } catch (error) {
      console.error('❌ Error checking guest email:', error);
      return false;
    }
  }
}