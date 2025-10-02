
// services/emailService.ts
import * as nodemailer from 'nodemailer';
import * as puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Type definitions
interface Customer {
  name?: string;
  email?: string;
  phone?: string;
  address?: Address;
}

interface Address {
  street?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  postalCode?: string;
  country?: string;
  fullName?: string;
  name?: string;
  phoneNumber?: string;
  phone?: string;
  email?: string;
}

interface OrderItem {
  productName?: string;
  name?: string;
  description?: string;
  quantity?: number;
  pricePerItem?: number;
  unitPrice?: number;
  price?: any; // Changed to any for compatibility
  totalPrice?: number;
  total?: number;
  color?: any; // Changed to any for compatibility
  size?: any; // Changed to any for compatibility
  image?: string;
  imageUrl?: string | null;
}

interface Order {
  _id?: string;
  orderId?: string;
  orderNumber?: string;
  orderDate?: string | Date;
  createdAt?: string | Date;
  customer?: Customer;
  email?: string;
  shippingAddress?: Address;
  items?: OrderItem[];
  subtotal?: number;
  tax?: number;
  discountAmount?: number;
  discount?: number;
  totalAmount?: number;
  total?: number;
  status?: string;
  name?: string; // Added for compatibility
  user?: string; // Added for compatibility
  amount?: number; // Added for compatibility
  purchaseOrderNumber?: string; // Customer's Purchase Order number
}

interface EmailTemplate {
  subject: string;
  statusLabel: string;
  statusColor: string;
  bgColor: string;
  message: string;
}

interface BulkEmailResult {
  orderId: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  sendWelcomeEmail(email: any, name: any) {
    throw new Error('Method not implemented.');
  }
  static send(arg0: { email: any; name: any; }) {
    throw new Error('Method not implemented.');
  }
  private transporter: nodemailer.Transporter;

  constructor() {
    // Ensure required environment variables exist
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables are required');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword
      }
    });
  }

  // Generate PDF invoice
  async generateInvoicePDF(order: Order): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      const invoiceHTML = this.generateInvoiceHTML(order);
      
      await page.setContent(invoiceHTML, {
        waitUntil: 'networkidle0'
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        printBackground: true
      });

      // Convert Uint8Array to Buffer
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  // Generate invoice HTML
  generateInvoiceHTML(order: Order): string {
    const orderNumber = order.orderId || order.orderNumber || order._id || '-';
    const date = order.orderDate
      ? new Date(order.orderDate).toLocaleDateString('en-IN')
      : order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');
    
    const shipping = order.shippingAddress || {};
    const customer = order.customer || {};
    const name = customer.name || shipping.fullName || shipping.name || '-';
    const email = customer.email || order.email || shipping.email || '-';
    const phone = customer.phone || shipping.phoneNumber || shipping.phone || '-';
    const address = customer.address || shipping || {};
    
    const formatAddress = (): string => {
      const street = address.street || address.address || '';
      const city = address.city || '';
      const state = address.state || '';
      const zipCode = address.zipCode || address.postalCode || '';
      const country = address.country || 'India';
      
      const parts = [
        street,
        [city, state, zipCode].filter(Boolean).join(', '),
        country
      ].filter(part => part && part.trim());
      return parts.length > 0 ? parts.join('<br>') : '-';
    };

    const items = order.items || [];
    const subtotal = order.subtotal || 0;
    const tax = order.tax || 0;
    const discount = order.discountAmount || order.discount || 0;
    const total = order.totalAmount || order.total || 0;
    const status = order.status || 'pending';

    const itemsHTML = items.map((item, index) => {
      const productName = item.productName || item.name || item.description || '-';
      const quantity = item.quantity || 0;
      const unitPrice = item.pricePerItem || item.unitPrice || item.price || 0;
      const itemTotal = item.totalPrice || item.total || (unitPrice * quantity);
      const color = item.color || '-';
      const size = item.size || '-';
      const imageUrl = item.image || item.imageUrl || '';

      return `
        <tr style="${index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
          <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">
            ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 40px; height: 40px; background-color: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #6b7280;">No Img</div>'}
          </td>
          <td style="padding: 12px 16px; border-right: 1px solid #e5e7eb;">${productName}</td>
          <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">${size}</td>
          <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">${color}</td>
          <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e5e7eb;">${quantity}</td>
          <td style="padding: 12px 16px; text-align: right; border-right: 1px solid #e5e7eb;">₹${Number(unitPrice).toFixed(2)}</td>
          <td style="padding: 12px 16px; text-align: right;">₹${Number(itemTotal).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice ${orderNumber}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #000;
            }
            .logo {
              font-size: 2.5rem;
              font-weight: bold;
              letter-spacing: 3px;
              color: #000;
            }
            .company-info {
              text-align: right;
              font-size: 0.9rem;
              color: #666;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .invoice-number {
              font-size: 1.5rem;
              font-weight: bold;
              color: #000;
            }
            .customer-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border: 1px solid #e5e7eb;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              color: #374151;
            }
            .totals {
              width: 300px;
              margin-left: auto;
              margin-top: 20px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .total-row.final {
              font-weight: bold;
              font-size: 1.2rem;
              border-bottom: 2px solid #000;
              border-top: 2px solid #000;
              padding: 12px 0;
            }
            .status-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: bold;
              text-transform: uppercase;
              color: white;
              background: ${status === 'delivered' ? '#10b981' : status === 'shipped' ? '#3b82f6' : status === 'processing' ? '#f59e0b' : '#6b7280'};
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #666;
              font-size: 0.8rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">AJIO</div>
              <div class="company-info">
                Reliance Retail Limited<br>
                304 4A/30 FF & SF Nr Power House,<br>
                Medical Mod, Delhi Rohtak,<br>
                ROHTAK, HR - 124001<br>
                India
              </div>
            </div>

            <div class="invoice-details">
              <div>
                <div class="invoice-number">INVOICE #${orderNumber}</div>
                <div style="color: #666; margin-top: 5px;">Date: ${date}</div>
                ${order.purchaseOrderNumber ? `<div style="color: #666; margin-top: 5px;"><strong>Purchase Order No.:</strong> ${order.purchaseOrderNumber}</div>` : ''}
                <div style="margin-top: 10px;">
                  <span class="status-badge">${status.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div class="customer-info">
              <h3 style="margin: 0 0 15px 0; color: #000;">Bill To:</h3>
              <div style="font-weight: bold; margin-bottom: 5px;">${name}</div>
              <div style="margin-bottom: 5px;">${formatAddress()}</div>
              ${phone !== '-' ? `<div style="margin-bottom: 5px;">Phone: ${phone}</div>` : ''}
              ${email !== '-' ? `<div>Email: ${email}</div>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">S.No</th>
                  <th style="width: 12%; text-align: center;">Image</th>
                  <th style="width: 30%;">Product</th>
                  <th style="width: 10%; text-align: center;">Size</th>
                  <th style="width: 10%; text-align: center;">Color</th>
                  <th style="width: 10%; text-align: center;">Qty</th>
                  <th style="width: 10%; text-align: right;">Unit Price</th>
                  <th style="width: 10%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="totals">
              ${subtotal > 0 ? `
              <div class="total-row">
                <span>Subtotal:</span>
                <span>₹${Number(subtotal).toFixed(2)}</span>
              </div>` : ''}
              ${tax > 0 ? `
              <div class="total-row">
                <span>Tax:</span>
                <span>₹${Number(tax).toFixed(2)}</span>
              </div>` : ''}
              ${discount > 0 ? `
              <div class="total-row">
                <span>Discount:</span>
                <span>-₹${Number(discount).toFixed(2)}</span>
              </div>` : ''}
              <div class="total-row final">
                <span>Total Amount:</span>
                <span>₹${Number(total).toFixed(2)}</span>
              </div>
            </div>

            <div class="footer">
              <p><strong>Thank you for your business!</strong></p>
              <p>This is a computer-generated invoice. Print Date: ${new Date().toLocaleString('en-IN')}</p>
              <p>For any queries, contact us at customercare@ajio.com</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Get email template based on status
  getEmailTemplate(status: string): EmailTemplate {
    const templates: Record<string, EmailTemplate> = {
      pending: {
        subject: 'Order Confirmed - {{orderId}}',
        statusLabel: 'Order Confirmed',
        statusColor: '#f59e0b',
        bgColor: '#fef3c7',
        message: `Your order has been confirmed and is being prepared for processing. We'll notify you once it's ready for shipment.<br><br>Thank you for choosing AJIO!`
      },
      processing: {
        subject: 'Order Processing - {{orderId}}',
        statusLabel: 'Order Processing',
        statusColor: '#10b981',
        bgColor: '#d1fae5',
        message: `Great news! Your order is now being processed and will be shipped soon. We're carefully preparing your items for delivery.<br><br>Expected shipping: Within 1-2 business days`
      },
      shipped: {
        subject: 'Order Shipped - {{orderId}}',
        statusLabel: 'Out for Delivery',
        statusColor: '#3b82f6',
        bgColor: '#dbeafe',
        message: `Your order is out for delivery! The courier will contact you to schedule the delivery.<br><br>Track your package to get real-time updates.`
      },
      delivered: {
        subject: 'Order Delivered - {{orderId}}',
        statusLabel: 'Order Delivered',
        statusColor: '#10b981',
        bgColor: '#d1fae5',
        message: `Your order has been successfully delivered! We hope you love your new items.<br><br>Thank you for shopping with AJIO. We'd love to hear about your experience!`
      },
      cancelled: {
        subject: 'Order Cancelled - {{orderId}}',
        statusLabel: 'Order Cancelled',
        statusColor: '#ef4444',
        bgColor: '#fee2e2',
        message: `Your order has been cancelled as requested. If you paid online, the refund will be processed within 5-7 business days.<br><br>We hope to serve you again soon!`
      }
    };

    return templates[status] || templates.pending;
  }

  // Generate modern email HTML
  generateEmailHTML(order: Order, template: EmailTemplate): string {
    const orderNumber = order.orderId || order.orderNumber || order._id || '-';
    const date = order.orderDate
      ? new Date(order.orderDate).toLocaleDateString('en-IN')
      : order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN')
        : new Date().toLocaleDateString('en-IN');
    
    const shipping = order.shippingAddress || {};
    const customer = order.customer || {};
    const name = customer.name || shipping.fullName || shipping.name || 'Valued Customer';
    const email = customer.email || order.email || shipping.email || '';
    const phone = customer.phone || shipping.phoneNumber || shipping.phone || '';
    const address = customer.address || shipping || {};
    
    const formatAddress = (): string => {
      const street = address.street || address.address || '';
      const city = address.city || '';
      const state = address.state || '';
      const zipCode = address.zipCode || address.postalCode || '';
      const country = address.country || 'India';
      
      const parts = [
        street,
        [city, state, zipCode].filter(Boolean).join(', '),
        country
      ].filter(part => part && part.trim());
      return parts.length > 0 ? parts.join('<br>') : '-';
    };

    const items = order.items || [];
    const subtotal = order.subtotal || 0;
    const tax = order.tax || 0;
    const discount = order.discountAmount || order.discount || 0;
    const total = order.totalAmount || order.total || 0;

    const itemsHTML = items.map((item, index) => {
      const productName = item.productName || item.name || item.description || 'Product';
      const quantity = item.quantity || 0;
      const price = item.pricePerItem || item.unitPrice || item.price || 0;
      const imageUrl = item.image || item.imageUrl || '';
      const size = item.size || '';
      const color = item.color || '';

      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 60px; vertical-align: top;">
                  ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" width="50" height="50" style="object-fit: cover; border-radius: 4px;">` : '<div style="width: 50px; height: 50px; background-color: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #6b7280;">No Img</div>'}
                </td>
                <td style="padding-left: 10px; vertical-align: top;">
                  <p style="margin: 0; font-weight: bold; color: #333;">${productName}</p>
                  ${size ? `<p style="margin: 0; font-size: 12px; color: #666;">Size: ${size}</p>` : ''}
                  ${color ? `<p style="margin: 0; font-size: 12px; color: #666;">Color: ${color}</p>` : ''}
                  <p style="margin: 0; font-size: 12px; color: #666;">Qty: ${quantity} x ₹${Number(price).toFixed(2)}</p>
                </td>
                <td style="text-align: right; vertical-align: top; font-weight: bold; color: #333;">₹${Number(quantity * price).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${template.subject.replace('{{orderId}}', orderNumber)}</title>
          <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
              .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
              .header { background-color: #007bff; padding: 20px; text-align: center; color: #ffffff; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 20px 30px; line-height: 1.6; color: #333333; }
              .status-banner { background-color: ${template.bgColor}; color: ${template.statusColor}; padding: 15px 30px; text-align: center; font-size: 18px; font-weight: bold; }
              .order-summary { background-color: #f9f9f9; padding: 20px 30px; border-top: 1px solid #eeeeee; border-bottom: 1px solid #eeeeee; }
              .order-summary table { width: 100%; border-collapse: collapse; }
              .order-summary th, .order-summary td { padding: 8px 0; text-align: left; border-bottom: 1px solid #eeeeee; }
              .order-summary th { font-weight: bold; color: #555555; }
              .order-summary .total-row { font-weight: bold; color: #000000; }
              .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #777777; }
              .button { display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 20px; }
              .product-image { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 10px; }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <h1>AJIO</h1>
              </div>
              <div class="status-banner">
                  ${template.statusLabel}
              </div>
              <div class="content">
                  <p>Dear ${name},</p>
                  <p>${template.message}</p>
                  <p><strong>Order ID:</strong> ${orderNumber}</p>
                  <p><strong>Order Date:</strong> ${date}</p>
                  
                  <div class="order-summary">
                      <h3 style="margin-top: 0;">Order Summary</h3>
                      <table>
                          <thead>
                              <tr>
                                  <th>Item</th>
                                  <th style="text-align: right;">Price</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${itemsHTML}
                              <tr>
                                  <td style="padding: 10px 0; text-align: right;">Subtotal:</td>
                                  <td style="padding: 10px 0; text-align: right;">₹${Number(subtotal).toFixed(2)}</td>
                              </tr>
                              ${discount > 0 ? `
                              <tr>
                                  <td style="padding: 10px 0; text-align: right;">Discount:</td>
                                  <td style="padding: 10px 0; text-align: right;">-₹${Number(discount).toFixed(2)}</td>
                              </tr>` : ''}
                              ${tax > 0 ? `
                              <tr>
                                  <td style="padding: 10px 0; text-align: right;">Tax:</td>
                                  <td style="padding: 10px 0; text-align: right;">₹${Number(tax).toFixed(2)}</td>
                              </tr>` : ''}
                              <tr class="total-row">
                                  <td style="padding: 10px 0; text-align: right;">Total:</td>
                                  <td style="padding: 10px 0; text-align: right;">₹${Number(total).toFixed(2)}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>

                  <h3 style="margin-top: 20px;">Shipping Address</h3>
                  <p style="margin: 0;"><strong>${name}</strong></p>
                  <p style="margin: 0;">${formatAddress()}</p>
                  ${phone ? `<p style="margin: 0;">Phone: ${phone}</p>` : ''}
                  ${email ? `<p style="margin: 0;">Email: ${email}</p>` : ''}

                  <p style="text-align: center;">
                      <a href="#" class="button">View Order Details</a>
                  </p>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} AJIO. All rights reserved.</p>
                  <p>Reliance Retail Limited</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  // Send email method
  async sendEmail(to: string, subject: string, html: string, attachments: any[] = []) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: to, // List of recipients
        subject: subject, // Subject line
        html: html, // HTML body
        attachments: attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send order status email
  async sendOrderStatusEmail(order: Order, status: string) {
    const template = this.getEmailTemplate(status);
    const subject = template.subject.replace('{{orderId}}', order.orderId || order.orderNumber || order._id || 'N/A');
    const html = this.generateEmailHTML(order, template);

    let attachments: any[] = [];
    if (status === 'pending' || status === 'delivered') { // Attach invoice for initial confirmation and delivery
      try {
        const pdfBuffer = await this.generateInvoicePDF(order);
        attachments.push({
          filename: `invoice_${order.orderId || order._id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
      } catch (pdfError) {
        console.error(`Failed to generate PDF for order ${order.orderId}:`, pdfError);
        // Continue sending email even if PDF generation fails
      }
    }

    const recipientEmail = order.customer?.email || order.email || order.shippingAddress?.email;
    if (!recipientEmail) {
      console.error(`No recipient email found for order ${order.orderId}`);
      throw new Error('No recipient email found');
    }

    await this.sendEmail(recipientEmail, subject, html, attachments);
  }

  // Send newsletter email
  async sendNewsletterEmail(email: string, subject: string, message: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Newsletter</h1>
        </div>
        <div style="padding: 30px; background: white;">
          <div style="margin-bottom: 30px;">
            ${message}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            This is a newsletter from StyleDev. If you no longer wish to receive these emails, please contact support.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  // Static methods for Status Management Service
  static async sendStatusUpdateEmail(data: {
    orderId: string;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    customerName: string;
    customerEmail?: string;
    statusDescription: string;
    estimatedDelivery?: string | null;
  }): Promise<void> {
    if (!data.customerEmail) {
      console.log('⚠️ No customer email available for order:', data.orderId);
      return;
    }

    // For now, just log the email. In production, use the existing email service
    console.log('📧 Status Update Email:', {
      to: data.customerEmail,
      subject: `Order ${data.orderNumber} Status Update: ${data.newStatus}`,
      orderNumber: data.orderNumber,
      status: data.newStatus,
      description: data.statusDescription,
      estimatedDelivery: data.estimatedDelivery
    });

    // TODO: Use the existing emailService instance to send actual emails
    // const emailService = new EmailService();
    // await emailService.sendOrderStatusEmail(mockOrder, data.newStatus);
  }

  static async sendInternalAlert(data: {
    orderId: string;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    customerEmail?: string;
  }): Promise<void> {
    console.log('🚨 Internal Alert:', {
      type: 'Order Status Alert',
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      status: data.newStatus,
      customer: data.customerEmail,
      message: `Order ${data.orderNumber} changed to ${data.newStatus}`
    });

    // TODO: Send to admin email or Slack notification
  }
}

export default EmailService;