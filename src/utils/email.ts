import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import Design, { IDesign } from '../models/design';

/**
 * Creates an email transporter
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = () => {
  // In production, use actual SMTP credentials
  // For development, use a test account or local mail server
  return nodemailer.createTransport({
    service: 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'user@example.com',
      pass: process.env.EMAIL_PASSWORD || 'password'
    }
  });
};

/**
 * Generates HTML email template for design confirmation
 * @param {Object} design - The design document
 * @param {string} message - Optional custom message
 * @returns {string} HTML email content
 */
const generateEmailTemplate = (design: IDesign, message = '') => {
  const baseUrl = process.env.FRONTEND_URL || 'https://styledev.in';
  const designLink = design.isPublic 
    ? `${baseUrl}/share/${design.shareableId}`
    : `${baseUrl}/design/${design.shareableId}?token=${design.accessToken}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; padding: 20px; }
    .logo { max-width: 150px; }
    .content { background-color: #f9f9e8; padding: 20px; text-align: center; }
    .title { color: #0047AB; font-size: 24px; margin-bottom: 10px; }
    .subtitle { color: #666; font-size: 16px; margin-bottom: 20px; }
    .button { 
      display: inline-block; 
      background-color: #0047AB; 
      color: white; 
      padding: 12px 30px; 
      text-decoration: none; 
      border-radius: 4px; 
      margin: 20px 0;
    }
    .design-images { 
      display: flex; 
      justify-content: center; 
      margin: 20px 0; 
    }
    .design-image { 
      width: 45%; 
      margin: 0 5px; 
    }
    .shipping-info {
      display: flex;
      justify-content: space-around;
      background-color: #f9f9e8;
      padding: 20px;
      margin-top: 20px;
    }
    .shipping-option {
      text-align: center;
      width: 45%;
    }
    .shipping-icon {
      width: 50px;
      height: 50px;
      margin: 0 auto;
      background-color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .shipping-title {
      font-weight: bold;
      margin: 10px 0;
    }
    .shipping-subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .shipping-time {
      color: #0047AB;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
    .custom-message {
      font-style: italic;
      margin: 20px 0;
      padding: 10px;
      border-left: 3px solid #0047AB;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${baseUrl}/logo.png" alt="Styledev.in" class="logo">
      <div class="customer-service">
        Customer Service<br>
        (888) 257-1518
      </div>
    </div>
    
    <div class="content">
      <h1 class="title">Your t-shirt design is ready!</h1>
      <p class="subtitle">Looking good! Keep this email handy to get back to your design.</p>
      
      ${message ? `<div class="custom-message">${message}</div>` : ''}
      
      <a href="${designLink}" class="button">View your design</a>
      
      <div class="design-images">
        <img src="${baseUrl}${design.previewImages.front}" alt="Front Design" class="design-image">
        <img src="${baseUrl}${design.previewImages.back}" alt="Back Design" class="design-image">
      </div>
    </div>
    
    <div class="shipping-info">
      <div class="shipping-option">
        <div class="shipping-icon">📅</div>
        <div class="shipping-title">Free Shipping</div>
        <div class="shipping-subtitle">Guaranteed delivery in</div>
        <div class="shipping-time">2 weeks</div>
      </div>
      
      <div class="shipping-option">
        <div class="shipping-icon">🚚</div>
        <div class="shipping-title">Rush Shipping</div>
        <div class="shipping-subtitle">Guaranteed delivery in</div>
        <div class="shipping-time">3 days</div>
      </div>
    </div>
    
    <div class="footer">
      <p>Lowest prices guaranteed</p>
      <p>© ${new Date().getFullYear()} Styledev.in. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Sends an email with design preview
 * @param {string} designId - The design document ID
 * @param {string} email - Recipient email address
 * @param {string} message - Optional custom message
 * @returns {Promise<Object>} Email sending result
 */
const sendDesignEmail = async (designId: string, email: string | string[] , message = '') => {
  try {
    // Get design from database
    const design = await Design.findById(designId);
    
    if (!design) {
      throw new Error('Design not found');
    }
    
    // Generate preview images if not already created
    if (!design.previewImages || !design.previewImages.front) {
      const { generatePreviewImages } = require('./imageUtils');
      design.previewImages = await generatePreviewImages(design);
      await design.save();
    }
    
    // Create email content using the template
    const emailHtml = generateEmailTemplate(design, message);
    // Get absolute paths for attachments
    const frontImagePath = path.join(__dirname, '../../', design.previewImages.front?.replace(/^\//, '') || '');
    const backImagePath = path.join(__dirname, '../../', design.previewImages.back?.replace(/^\//, '') || '');
    
    // Create email content
    const emailContent = {
      from: `"Styledev.in" <${process.env.EMAIL_FROM || 'designs@styledev.in'}>`,
      to: email,
      subject: `Your T-Shirt Design is Ready!`,
      html: emailHtml,
      attachments: [
        {
          filename: 'design-front.jpg',
          path: frontImagePath,
          cid: 'design-front' // Content ID for embedding in HTML
        },
        {
          filename: 'design-back.jpg',
          path: backImagePath,
          cid: 'design-back' // Content ID for embedding in HTML
        }
      ]
    };
    
    // Create transporter and send email
    const transporter = createTransporter();
    const info = await transporter.sendMail(emailContent);
    
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending design email:', error);
    throw error;
  }
};

export { sendDesignEmail };
