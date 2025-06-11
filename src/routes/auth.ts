import { Router, Request, Response } from 'express';
import validator from 'validator';
import bcrypt from 'bcrypt';
import User from '../models/user';
import { sendOTPEmail } from '../lib/emailService';
import { generateOTP, storeOTP, verifyOTP } from '../lib/otpService';
import { generateToken } from '../utils/jwt';
import { UserSchema } from '../schemas/user';
import { tempUserStore } from '../lib/tempUserStore';
import { sendPasswordResetEmail } from '../lib/emailService';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body using Zod
    const parsedResult = UserSchema.safeParse(req.body);
    if (!parsedResult.success) {
      res.status(400).json({ 
        error: "Validation failed",
        message: "Invalid input data",
        details: parsedResult.error.errors 
      });
      return;
    }

    const { username, email, password, role } = parsedResult.data;

    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(400).json({ 
        error: "Email exists",
        message: "Email already registered"
      });
      return;
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(400).json({ 
        error: "Username exists",
        message: "Username already taken"
      });
      return;
    }

    // Create user with isVerified set to false
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user',
      name: username,
      isVerified: false // Set to false to require email verification
    });

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      // If email fails to send, still create the user but inform the client
      console.error('Failed to send OTP email to:', email);
      res.status(200).json({ 
        message: "Account created but verification email failed to send. Please use the resend verification option.",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: false
        }
      });
      return;
    }

    console.log('Registration successful:', {
      email,
      userId: user._id,
      username: user.username,
      otpSent: true
    });

    res.status(200).json({ 
      message: "Registration successful. Please check your email for verification code.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: false
      }
    });
    return;
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: "Registration failed",
      message: "Failed to create account",
      details: error instanceof Error ? error.message : "Unknown error"
    });
    return;
  }
});

// Login
// Login route with improved error handling
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      res.status(400).json({ 
        error: "Missing credentials",
        message: "Please provide both email and password"
      });
      return;
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      res.status(400).json({ 
        error: "Invalid email",
        message: "Please enter a valid email address"
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login attempt: User not found for email:', email);
      res.status(400).json({ 
        error: "User not found",
        message: "No account found with this email address"
      });
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      console.log('Login attempt: User not verified:', email);
      res.status(400).json({ 
        error: "Email not verified",
        message: "Please verify your email address before signing in"
      });
      return;
    }

    // Compare passwords using the User model's method
    const isPasswordValid = await user.comparePassword(password);
    console.log('Login attempt:', {
      email,
      userId: user._id,
      isPasswordValid
      // Remove password logging for security
    });

    if (!isPasswordValid) {
      console.log('Login attempt: Invalid password for user:', email);
      res.status(400).json({ 
        error: "Invalid password",
        message: "Incorrect password"
      });
      return;
    }

    // Generate JWT token
    const token = generateToken(user);

    console.log('Login successful for user:', email);
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
    return;
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: "Server error",
      message: "An error occurred during login. Please try again."
    });
    return;
  }
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!verifyOTP(email, otp)) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    // Find and update the user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Update user verification status
    user.isVerified = true;
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    res.status(200).json({ 
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// Resend OTP
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!validator.isEmail(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ error: "Email already verified" });
      return;
    }

    // Generate and store new OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      res.status(500).json({ error: "Failed to send verification email" });
      return;
    }

    res.status(200).json({ message: "New verification code sent to your email" });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: "Failed to resend verification code" });
  }
});

// Add these routes to your existing auth router

// Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      res.status(400).json({ 
        error: "Missing email",
        message: "Please provide an email address"
      });
      return;
    }

    if (!validator.isEmail(email)) {
      res.status(400).json({ 
        error: "Invalid email",
        message: "Please enter a valid email address"
      });
      return;
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if user exists or not
      res.status(200).json({ 
        message: "If an account with this email exists, you will receive a password reset email shortly."
      });
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      res.status(400).json({ 
        error: "Email not verified",
        message: "Please verify your email address first before resetting password"
      });
      return;
    }

    // Generate and store OTP for password reset
    const otp = generateOTP();
    storeOTP(`reset_${email}`, otp); // Use prefix to differentiate from registration OTPs

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(email, otp);
    if (!emailSent) {
      console.error('Failed to send password reset email to:', email);
      res.status(500).json({ 
        error: "Email service error",
        message: "Failed to send password reset email. Please try again later."
      });
      return;
    }

    console.log('Password reset email sent:', {
      email,
      userId: user._id,
      timestamp: new Date()
    });

    res.status(200).json({ 
      message: "If an account with this email exists, you will receive a password reset email shortly."
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: "Server error",
      message: "An error occurred while processing your request. Please try again."
    });
  }
});

// Reset password with OTP
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate input
    if (!email || !otp || !newPassword) {
      res.status(400).json({ 
        error: "Missing fields",
        message: "Please provide email, OTP, and new password"
      });
      return;
    }

    if (!validator.isEmail(email)) {
      res.status(400).json({ 
        error: "Invalid email",
        message: "Please enter a valid email address"
      });
      return;
    }

    // Validate password strength (you can customize this)
    if (newPassword.length < 6) {
      res.status(400).json({ 
        error: "Weak password",
        message: "Password must be at least 6 characters long"
      });
      return;
    }

    // Verify OTP for password reset
    if (!verifyOTP(`reset_${email}`, otp)) {
      res.status(400).json({ 
        error: "Invalid OTP",
        message: "Invalid or expired verification code"
      });
      return;
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ 
        error: "User not found",
        message: "No account found with this email address"
      });
      return;
    }

    // Update password
    user.password = newPassword; // The pre-save hook will hash it
    await user.save();

    console.log('Password reset successful:', {
      email,
      userId: user._id,
      timestamp: new Date()
    });

    res.status(200).json({ 
      message: "Password reset successful. You can now login with your new password."
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: "Server error",
      message: "An error occurred while resetting your password. Please try again."
    });
  }
});

// Optional: Verify reset OTP (to check if OTP is valid before showing password reset form)
router.post('/verify-reset-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ 
        error: "Missing fields",
        message: "Please provide both email and OTP"
      });
      return;
    }

    if (!validator.isEmail(email)) {
      res.status(400).json({ 
        error: "Invalid email",
        message: "Please enter a valid email address"
      });
      return;
    }

    // Verify OTP
    if (!verifyOTP(`reset_${email}`, otp)) {
      res.status(400).json({ 
        error: "Invalid OTP",
        message: "Invalid or expired verification code"
      });
      return;
    }

    // Check if user exists (additional security)
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ 
        error: "User not found",
        message: "No account found with this email address"
      });
      return;
    }

    res.status(200).json({ 
      message: "OTP verified successfully. You can now reset your password."
    });

  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ 
      error: "Server error",
      message: "An error occurred while verifying OTP. Please try again."
    });
  }
});

export default router;