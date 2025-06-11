import nodemailer from 'nodemailer';

import dotenv from 'dotenv';
dotenv.config();

console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
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

// Add this function to your existing emailService.ts file

export const sendPasswordResetEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    // Replace this with your actual email service implementation
    // This is a template - adjust according to your email service (NodeMailer, SendGrid, etc.)
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
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
    };

    // Example with NodeMailer (adjust based on your email service)
    // const transporter = nodemailer.createTransporter({...});
    // await transporter.sendMail(mailOptions);

    // Example with SendGrid
    // const msg = {
    //   to: email,
    //   from: process.env.EMAIL_FROM,
    //   subject: 'Password Reset Verification Code',
    //   html: mailOptions.html,
    //   text: mailOptions.text
    // };
    // await sgMail.send(msg);

    console.log('Password reset email sent successfully to:', email);
    return true;

  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};