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
    if (!transporter) {
      console.error('Email not configured: EMAIL_USER and EMAIL_PASSWORD environment variables are required');
      console.error('Please set EMAIL_USER and EMAIL_PASSWORD in your .env file');
      return false;
    }
    
    const fs = require('fs');
    const path = require('path');
    
    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', 'design-success.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders with actual data
    htmlTemplate = htmlTemplate
      .replace(/{{designName}}/g, designData.designName)
      .replace(/{{designId}}/g, designData.designId)
      .replace(/{{designLink}}/g, designData.designLink)
      .replace(/{{tshirtStyle}}/g, designData.tshirtStyle)
      .replace(/{{tshirtColor}}/g, designData.tshirtColor)
      .replace(/{{elementCount}}/g, designData.elementCount.toString())
      .replace(/{{createdDate}}/g, designData.createdDate);

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

    console.log('Design success email sent successfully to:', email);
    return true;

  } catch (error) {
    console.error('Error sending design success email:', error);
    return false;
  }
};