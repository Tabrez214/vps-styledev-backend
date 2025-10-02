import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');

// Check if email configuration is available
const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

const transporter = emailConfigured ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
}) : null;

export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      return false;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email',
      html: `
        <h1>Email Verification</h1>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
      `,
    });
    return true;
  } catch (error: any) {
    console.error('Email sending error:', error.message, error);
    return false;
  }
};

export const sendPasswordResetEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      return false;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password. Please use the verification code below:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          
          <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `,
      text: `
        Password Reset Request
        
        You have requested to reset your password. Please use the verification code below:
        
        Verification Code: ${otp}
        
        This code will expire in 10 minutes.
        
        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
      `
    });

    console.log('Password reset email sent successfully to:', email);
    return true;

  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Design Success Email Service
// Welcome Email Service
export const sendWelcomeEmail = async (
  email: string,
  userData: {
    username: string;
    userId: string;
  }
): Promise<boolean> => {
  try {
    console.log('=== WELCOME EMAIL DEBUG ===');
    console.log('EMAIL_USER configured:', !!process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD configured:', !!process.env.EMAIL_PASSWORD);
    console.log('Transporter available:', !!transporter);

    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      return false;
    }

    const fs = require('fs');
    const path = require('path');

    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', 'welcome.html');
    let htmlTemplate;

    try {
      if (fs.existsSync(templatePath)) {
        htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      } else {
        console.warn('Welcome email template not found, using fallback HTML');
        // Fallback HTML template
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Welcome to StyleDev! 🎨</h1>
            <p>Hi {{username}}!</p>
            <p>Welcome to StyleDev! We're thrilled to have you join our community of creative minds and fashion enthusiasts.</p>
            <h3>What you can do:</h3>
            <ul>
              <li>Create custom t-shirt designs with our Design Studio</li>
              <li>Browse our collection of premium t-shirts and apparel</li>
              <li>Get fast delivery right to your doorstep</li>
              <li>Enjoy 24/7 customer support</li>
            </ul>
            <p><a href="{{designStudioUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visit Design Studio</a></p>
            <p>Thank you for choosing StyleDev!</p>
            <p>- StyleDev Team</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error reading welcome email template:', error);
      return false;
    }

    // Replace placeholders with actual data
    const baseUrl = process.env.FRONTEND_URL || 'https://styledev.in';
    htmlTemplate = htmlTemplate
      .replace(/{{username}}/g, userData.username)
      .replace(/{{designStudioUrl}}/g, `${baseUrl}/design-studio`)
      .replace(/{{shopUrl}}/g, `${baseUrl}/products`)
      .replace(/{{supportUrl}}/g, `${baseUrl}/contact`)
      .replace(/{{unsubscribeUrl}}/g, `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`);

    console.log('Attempting to send welcome email to:', email);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to StyleDev - Let\'s Create Something Amazing! 🎨',
      html: htmlTemplate,
      text: `
        Welcome to StyleDev!
        
        Hi ${userData.username}!
        
        Welcome to StyleDev! We're thrilled to have you join our community of creative minds and fashion enthusiasts.
        
        What you can do:
        • Create custom t-shirt designs with our Design Studio
        • Browse our collection of premium t-shirts and apparel
        • Get fast delivery right to your doorstep
        • Enjoy 24/7 customer support
        
        Ready to get started?
        Visit our Design Studio: ${baseUrl}/design-studio
        Browse Products: ${baseUrl}/products
        
        Thank you for choosing StyleDev!
        
        - StyleDev Team
      `
    });

    console.log('SUCCESS: Welcome email sent successfully to:', email);
    return true;

  } catch (error) {
    console.error('ERROR: Failed to send welcome email:', error);
    return false;
  }
};

// Promotional Follow-up Email Service
export const sendPromoFollowupEmail = async (
  email: string,
  userData: {
    username: string;
    userId: string;
  },
  promoData: {
    promoCode: string;
    discountPercentage: number;
    expiryDate: string;
    daysLeft: number;
  }
): Promise<boolean> => {
  try {
    console.log('=== PROMO FOLLOWUP EMAIL DEBUG ===');
    console.log('EMAIL_USER configured:', !!process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD configured:', !!process.env.EMAIL_PASSWORD);
    console.log('Transporter available:', !!transporter);

    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      return false;
    }

    const fs = require('fs');
    const path = require('path');

    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', 'promo-followup.html');
    let htmlTemplate;

    try {
      if (fs.existsSync(templatePath)) {
        htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      } else {
        console.warn('Promo followup email template not found, using fallback HTML');
        // Fallback HTML template
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">🎁 Special {{discountPercentage}}% OFF Just for You!</h1>
            <p>Hi {{username}}!</p>
            <p>We noticed you joined StyleDev recently but haven't made your first purchase yet.</p>
            <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
              <h2 style="color: #007bff; margin: 0;">{{discountPercentage}}% OFF Your First Order</h2>
              <p style="font-size: 24px; font-weight: bold; color: #333; margin: 10px 0;">{{promoCode}}</p>
              <p style="color: #666;">Valid until: {{expiryDate}}</p>
            </div>
            <p><a href="{{shopUrl}}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a></p>
            <p><a href="{{designStudioUrl}}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Designing</a></p>
            <p>This exclusive discount expires in {{daysLeft}} days.</p>
            <p>- StyleDev Team</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error reading promo email template:', error);
      return false;
    }

    // Replace placeholders with actual data
    const baseUrl = process.env.FRONTEND_URL || 'https://styledev.in';
    htmlTemplate = htmlTemplate
      .replace(/{{username}}/g, userData.username)
      .replace(/{{promoCode}}/g, promoData.promoCode)
      .replace(/{{discountPercentage}}/g, promoData.discountPercentage.toString())
      .replace(/{{expiryDate}}/g, promoData.expiryDate)
      .replace(/{{daysLeft}}/g, promoData.daysLeft.toString())
      .replace(/{{designStudioUrl}}/g, `${baseUrl}/design-studio`)
      .replace(/{{shopUrl}}/g, `${baseUrl}/products`)
      .replace(/{{supportUrl}}/g, `${baseUrl}/contact`)
      .replace(/{{unsubscribeUrl}}/g, `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`);

    console.log('Attempting to send promo followup email to:', email);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `🎁 Special ${promoData.discountPercentage}% OFF Just for You - ${promoData.promoCode}`,
      html: htmlTemplate,
      text: `
        Special Offer Just for You!
        
        Hi ${userData.username}!
        
        We noticed you joined StyleDev recently but haven't made your first purchase yet.
        We'd love to help you get started with a special welcome discount!
        
        ${promoData.discountPercentage}% OFF Your First Order
        
        Use code: ${promoData.promoCode}
        Valid until: ${promoData.expiryDate}
        
        This exclusive discount expires in ${promoData.daysLeft} days.
        
        Shop now: ${baseUrl}/products
        Start designing: ${baseUrl}/design-studio
        
        Why Choose StyleDev?
        ✅ Premium quality materials
        ✅ Professional printing technology
        ✅ Fast delivery across India
        ✅ 100% satisfaction guarantee
        ✅ Easy-to-use design tools
        
        - StyleDev Team
      `
    });

    console.log('SUCCESS: Promo followup email sent successfully to:', email);
    return true;

  } catch (error) {
    console.error('ERROR: Failed to send promo followup email:', error);
    return false;
  }
};

export const sendDesignSuccessEmail = async (
  email: string,
  designData: {
    designName: string;
    designId: string;
    designLink: string;
    tshirtStyle: string;
    tshirtColor: string;
    elementCount: number;
    createdDate: string;
  }
): Promise<boolean> => {
  try {
    console.log('=== DESIGN EMAIL DEBUG ===');
    console.log('EMAIL_USER configured:', !!process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD configured:', !!process.env.EMAIL_PASSWORD);
    console.log('Transporter available:', !!transporter);

    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      console.error('Please set EMAIL_USER and EMAIL_PASSWORD in your .env file');
      return false;
    }

    const fs = require('fs');
    const path = require('path');

    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', 'design-success.html');
    let htmlTemplate;

    try {
      if (fs.existsSync(templatePath)) {
        htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      } else {
        console.warn('Design success email template not found, using fallback HTML');
        // Fallback HTML template
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Your Design is Ready! 🎨</h1>
            <p>Congratulations! You've successfully created a custom t-shirt design.</p>
            <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3>Design Details:</h3>
              <p><strong>Name:</strong> {{designName}}</p>
              <p><strong>ID:</strong> {{designId}}</p>
              <p><strong>T-Shirt Style:</strong> {{tshirtStyle}}</p>
              <p><strong>Color:</strong> {{tshirtColor}}</p>
              <p><strong>Elements:</strong> {{elementCount}} design elements</p>
              <p><strong>Created:</strong> {{createdDate}}</p>
            </div>
            <p><a href="{{designLink}}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Design</a></p>
            <p>What you can do next:</p>
            <ul>
              <li>Share your design with friends and family</li>
              <li>Edit your design anytime using the link above</li>
              <li>Order your custom t-shirt</li>
            </ul>
            <p>Happy designing!</p>
            <p>- Design Studio Team</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error reading design success email template:', error);
      return false;
    }

    // Replace placeholders with actual data
    htmlTemplate = htmlTemplate
      .replace(/{{designName}}/g, designData.designName)
      .replace(/{{designId}}/g, designData.designId)
      .replace(/{{designLink}}/g, designData.designLink)
      .replace(/{{tshirtStyle}}/g, designData.tshirtStyle)
      .replace(/{{tshirtColor}}/g, designData.tshirtColor)
      .replace(/{{elementCount}}/g, designData.elementCount.toString())
      .replace(/{{createdDate}}/g, designData.createdDate);

    console.log('Attempting to send email to:', email);
    console.log('Email subject: Your Design is Ready! - Design Studio');
    console.log('Template path used:', templatePath);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Design is Ready! - Design Studio',
      html: htmlTemplate,
      text: `
        Congratulations! Your Design is Ready!
        
        Hi there!
        
        You've successfully created a custom t-shirt design. Here are the details:
        
        Design Name: ${designData.designName}
        Design ID: ${designData.designId}
        T-Shirt Style: ${designData.tshirtStyle}
        T-Shirt Color: ${designData.tshirtColor}
        Elements: ${designData.elementCount} design elements
        Created: ${designData.createdDate}
        
        View your design: ${designData.designLink}
        
        What you can do next:
        • Share your design with friends and family
        • Edit your design anytime using the link above
        • Order your custom t-shirt
        
        Pro Tip: Bookmark the design link for easy access later!
        
        If you have any questions or need help with your design, feel free to reach out to our support team.
        
        Happy designing!
        
        - Design Studio Team
      `
    });

    console.log('SUCCESS: Design success email sent successfully to:', email);
    return true;

  } catch (error) {
    if (error instanceof Error) {
      console.error('ERROR: Failed to send design success email:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('ERROR: Failed to send design success email:', error);
    }
    return false;
  }
};