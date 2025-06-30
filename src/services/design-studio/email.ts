import nodemailer from 'nodemailer';
import config from '../../config/config';
import { OrderDocument } from '../../models/design-studio/order';
import { DesignDocument } from '../../models/design-studio/design';
import { OrderCost } from 'interfaces';

/**
 * Email transport configuration
 */
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS
  }
});

/**
 * Send design confirmation email
 * @param designId The design ID
 * @param email Recipient email address
 * @param customMessage Optional custom message to include
 */
export const sendDesignEmail = async (
  designId: string,
  email: string,
  customMessage?: string
): Promise<void> => {
  // Import models here to avoid circular dependencies
  const Design = require('../models/designModel').default;
  
  // Find the design
  const design = await Design.findById(designId).exec();
  if (!design) {
    throw new Error(`Design not found: ${designId}`);
  }
  
  // Generate view link
  const viewLink = `${config.FRONTEND_URL}/design/${design.shareableId}?token=${design.accessToken}`;
  
  // Generate email HTML
  const emailHtml = generateDesignEmailTemplate(design, viewLink, customMessage);
  
  // Send email
  await transporter.sendMail({
    from: `"Styledev.in" <${config.EMAIL_FROM}>`,
    to: email,
    subject: 'Your t-shirt design is ready!',
    html: emailHtml
  });
};

/**
 * Send order confirmation email
 * @param orderId The order ID
 */
export const sendOrderConfirmationEmail = async (orderId: string): Promise<void> => {
  // Import models here to avoid circular dependencies
  const Order = require('../models/orderModel').default;
  const Design = require('../models/designModel').default;
  
  // Find the order
  const order = await Order.findById(orderId).exec();
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }
  
  // Find the design
  const design = await Design.findById(order.designId).exec();
  if (!design) {
    throw new Error(`Design not found for order: ${orderId}`);
  }
  
  // Generate order details link
  const orderLink = `${config.FRONTEND_URL}/orders/${order.orderNumber}`;
  
  // Generate email HTML
  const emailHtml = generateOrderEmailTemplate(order, design, orderLink);
  
  // Send email
  await transporter.sendMail({
    from: `"Styledev.in" <${config.EMAIL_FROM}>`,
    to: order.customer.email,
    subject: `Your order #${order.orderNumber} has been received`,
    html: emailHtml
  });
};

/**
 * Generate HTML template for design confirmation email
 * @param design The design document
 * @param viewLink Link to view the design
 * @param customMessage Optional custom message to include
 * @returns HTML email content
 */
const generateDesignEmailTemplate = (
  design: DesignDocument,
  viewLink: string,
  customMessage?: string
): string => {
  // Get preview images
  const frontPreview = design.previewImages?.front || '';
  const backPreview = design.previewImages?.back || '';
  
  // Build the HTML email
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your t-shirt design is ready!</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #0ea5e9; /* bg-sky-600 */
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          background-color: #f9f9f9;
          padding: 20px;
          border: 1px solid #eee;
        }
        .button {
          display: inline-block;
          background-color: #0ea5e9; /* bg-sky-600 */
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .preview-images {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
        }
        .preview-image {
          max-width: 45%;
        }
        .shipping-info {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
          text-align: center;
        }
        .shipping-option {
          width: 45%;
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your t-shirt design is ready!</h1>
        </div>
        <div class="content">
          <p>Looking good! Keep this email handy to get back to your design.</p>
          
          <div style="text-align: center;">
            <a href="${viewLink}" class="button">View your design</a>
          </div>
          
          <div class="preview-images">
            ${frontPreview ? `<img src="${config.FRONTEND_URL}${frontPreview}" alt="Front view" class="preview-image">` : ''}
            ${backPreview ? `<img src="${config.FRONTEND_URL}${backPreview}" alt="Back view" class="preview-image">` : ''}
          </div>
          
          ${customMessage ? `<p>${customMessage}</p>` : ''}
          
          <div class="shipping-info">
            <div class="shipping-option">
              <h3>Free Shipping</h3>
              <p>Guaranteed delivery in<br>2 weeks</p>
            </div>
            <div class="shipping-option">
              <h3>Rush Shipping</h3>
              <p>Guaranteed delivery in<br>3 days</p>
            </div>
          </div>
          
          <p>Ready to order? Click the button above to view your design and place an order.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Styledev.in. All rights reserved.</p>
          <p>Customer Service: <a href="tel:+918001234567">+91 800 123 4567</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML template for order confirmation email
 * @param order The order document
 * @param design The design document
 * @param orderLink Link to view the order details
 * @returns HTML email content
 */
const generateOrderEmailTemplate = (
  order: OrderDocument,
  design: DesignDocument,
  orderLink: string
): string => {
  // Get preview images
  const frontPreview = design.previewImages?.front || '';
  const backPreview = design.previewImages?.back || '';
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };
  
  // Convert sizes map to array for display
  const sizesArray = order.sizes instanceof Map
    ? Array.from(order.sizes.entries())
    : Object.entries(order.sizes);
  
  // Build the HTML email
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation #${order.orderNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #0ea5e9; /* bg-sky-600 */
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          background-color: #f9f9f9;
          padding: 20px;
          border: 1px solid #eee;
        }
        .button {
          display: inline-block;
          background-color: #0ea5e9; /* bg-sky-600 */
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .preview-images {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
        }
        .preview-image {
          max-width: 45%;
        }
        .order-details {
          margin: 20px 0;
        }
        .order-details table {
          width: 100%;
          border-collapse: collapse;
        }
        .order-details th, .order-details td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .order-details th {
          background-color: #f2f2f2;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
          <p>Order #${order.orderNumber}</p>
        </div>
        <div class="content">
          <p>Thank you for your order! We've received your t-shirt design and are processing it now.</p>
          
          <div style="text-align: center;">
            <a href="${orderLink}" class="button">View Order Details</a>
          </div>
          
          <div class="preview-images">
            ${frontPreview ? `<img src="${config.FRONTEND_URL}${frontPreview}" alt="Front view" class="preview-image">` : ''}
            ${backPreview ? `<img src="${config.FRONTEND_URL}${backPreview}" alt="Back view" class="preview-image">` : ''}
          </div>
          
          <div class="order-details">
            <h3>Order Summary</h3>
            <table>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
              </tr>
              <tr>
                <td>${design.tshirt.style} T-Shirt (${design.tshirt.color})</td>
                <td>${order.totalQuantity}</td>
                <td>${formatCurrency(order.priceBreakdown.basePrice)}</td>
              </tr>
              ${order.priceBreakdown.additionalCosts.map((cost: OrderCost) => `
                <tr>
                  <td>${cost.description}</td>
                  <td>-</td>
                  <td>${formatCurrency(cost.amount)}</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="2"><strong>Subtotal</strong></td>
                <td><strong>${formatCurrency(order.priceBreakdown.subtotal)}</strong></td>
              </tr>
              <tr>
                <td colspan="2">Tax</td>
                <td>${formatCurrency(order.priceBreakdown.tax)}</td>
              </tr>
              <tr>
                <td colspan="2">Shipping</td>
                <td>${formatCurrency(order.priceBreakdown.shipping)}</td>
              </tr>
              <tr>
                <td colspan="2"><strong>Total</strong></td>
                <td><strong>${formatCurrency(order.priceBreakdown.total)}</strong></td>
              </tr>
            </table>
          </div>
          
          <div class="order-details">
            <h3>Size Breakdown</h3>
            <table>
              <tr>
                <th>Size</th>
                <th>Quantity</th>
              </tr>
              ${(sizesArray as [string, number][]).filter((entry) => entry[1] > 0).map(([size, qty]) => `
                <tr>
                  <td>${size}</td>
                  <td>${qty}</td>
                </tr>
              `).join('')}
            </table>
          </div>
          
          <div class="order-details">
            <h3>Shipping Address</h3>
            <p>
              ${order.customer.name}<br>
              ${order.customer.address}<br>
              Phone: ${order.customer.phone}
            </p>
          </div>
          
          <p>If you have any questions about your order, please contact our customer service.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Styledev.in. All rights reserved.</p>
          <p>Customer Service: <a href="tel:+918001234567">+91 800 123 4567</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};  

export default {
  sendDesignEmail,
  sendOrderConfirmationEmail
};
