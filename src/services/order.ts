// services/emailService.ts
import * as nodemailer from 'nodemailer';
import * as puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import * as path from 'path';

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
  price?: number;
  totalPrice?: number;
  total?: number;
  color?: string;
  size?: string;
  image?: string;
  imageUrl?: string;
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
      return parts.join('<br>');
    };

    const items = order.items || [];
    const total = order.totalAmount || order.total || 0;
    const discount = order.discountAmount || order.discount || 0;

    const itemsHTML = items.map(item => {
      const productName = item.productName || item.name || item.description || 'Product';
      const quantity = item.quantity || 1;
      const unitPrice = item.pricePerItem || item.unitPrice || item.price || 0;
      const size = item.size || '';
      const color = item.color || '';
      const imageUrl = item.image || item.imageUrl || '';

      return `
        <div style="display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="width: 64px; height: 64px; margin-right: 16px; background: #f8fafc; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="width: 100%; height: 100%; object-fit: cover;">` : '<div style="font-size: 12px; color: #64748b;">No Image</div>'}
          </div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">${productName}</h4>
            ${size || color ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b;">${[size, color].filter(Boolean).join(' • ')}</p>` : ''}
            <p style="margin: 0; font-size: 14px; color: #64748b;">Quantity: ${quantity}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 600; color: #1e293b;">₹${Number(unitPrice * quantity).toFixed(2)}</div>
            <div style="font-size: 14px; color: #64748b;">₹${Number(unitPrice).toFixed(2)} each</div>
          </div>
        </div>
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
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
            }
            .header {
              background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .logo {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 4px;
              margin-bottom: 16px;
            }
            .status-badge {
              display: inline-block;
              padding: 12px 24px;
              border-radius: 24px;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              background: ${template.statusColor};
              color: white;
            }
            .content {
              padding: 32px 24px;
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              margin-bottom: 16px;
              color: #1e293b;
            }
            .message {
              color: #64748b;
              line-height: 1.7;
              margin-bottom: 32px;
              font-size: 16px;
            }
            .order-summary {
              background: #f8fafc;
              border-radius: 12px;
              padding: 24px;
              margin: 24px 0;
              border: 1px solid #e2e8f0;
            }
            .order-summary h3 {
              margin: 0 0 20px 0;
              color: #1e293b;
              font-size: 18px;
              font-weight: 600;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              font-size: 14px;
            }
            .summary-label {
              color: #64748b;
              font-weight: 500;
            }
            .summary-value {
              color: #1e293b;
              font-weight: 600;
            }
            .total-amount {
              border-top: 2px solid #e2e8f0;
              padding-top: 16px;
              margin-top: 16px;
            }
            .total-amount .summary-row {
              font-size: 18px;
              font-weight: 700;
              color: #1e293b;
            }
            .address-section {
              background: #f8fafc;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
              border-left: 4px solid ${template.statusColor};
            }
            .address-section h4 {
              margin: 0 0 12px 0;
              color: #1e293b;
              font-size: 16px;
              font-weight: 600;
            }
            .address-text {
              color: #64748b;
              line-height: 1.6;
            }
            .cta-button {
              display: inline-block;
              background: ${template.statusColor};
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
              transition: all 0.2s;
            }
            .footer {
              background: #1e293b;
              color: #94a3b8;
              padding: 32px 24px;
              text-align: center;
              font-size: 14px;
            }
            .footer a {
              color: ${template.statusColor};
              text-decoration: none;
            }
            .footer .logo-small {
              font-size: 20px;
              font-weight: bold;
              letter-spacing: 2px;
              color: white;
              margin-bottom: 16px;
            }
            @media (max-width: 600px) {
              .container {
                margin: 0;
              }
              .content {
                padding: 24px 16px;
              }
              .header {
                padding: 24px 16px;
              }
              .logo {
                font-size: 28px;
              }
              .order-summary {
                padding: 16px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">AJIO</div>
              <div class="status-badge">${template.statusLabel}</div>
            </div>
            
            <div class="content">
              <div class="greeting">Hi ${name},</div>
              <div class="message">${template.message}</div>
              
              <div class="order-summary">
                <h3>Order Summary</h3>
                <div class="summary-row">
                  <span class="summary-label">Order ID:</span>
                  <span class="summary-value">${orderNumber}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Order Date:</span>
                  <span class="summary-value">${date}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Items:</span>
                  <span class="summary-value">${items.length} item(s)</span>
                </div>
                ${discount > 0 ? `
                <div class="summary-row">
                  <span class="summary-label">Discount:</span>
                  <span class="summary-value" style="color: #10b981;">-₹${Number(discount).toFixed(2)}</span>
                </div>` : ''}
                <div class="total-amount">
                  <div class="summary-row">
                    <span>Total Amount:</span>
                    <span>₹${Number(total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              ${items.length > 0 ? `
              <div style="margin: 32px 0;">
                <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin-bottom: 16px;">Items in your order:</h3>
                ${itemsHTML}
              </div>` : ''}

              ${formatAddress() ? `
              <div class="address-section">
                <h4>Delivery Address</h4>
                <div class="address-text">${formatAddress()}</div>
                ${phone ? `<div class="address-text" style="margin-top: 8px;">Phone: ${phone}</div>` : ''}
              </div>` : ''}
            </div>
            
            <div class="footer">
              <div class="logo-small">AJIO</div>
              <p>Need help? Contact us at <a href="mailto:customercare@ajio.com">customercare@ajio.com</a></p>
              <p>Thank you for shopping with us!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Send order status email with PDF attachment
  async sendOrderStatusEmail(order: Order, status: string = 'pending'): Promise<nodemailer.SentMessageInfo> {
    try {
      const template = this.getEmailTemplate(status);
      const emailHTML = this.generateEmailHTML(order, template);
      const pdfBuffer = await this.generateInvoicePDF(order);
      
      const orderNumber = order.orderId || order.orderNumber || order._id || 'Unknown';
      const customerEmail = order.customer?.email || order.email || order.shippingAddress?.email;
      
      if (!customerEmail) {
        throw new Error('Customer email not found');
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"AJIO" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: template.subject.replace('{{orderId}}', orderNumber),
        html: emailHTML,
        attachments: [
          {
            filename: `invoice-${orderNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send bulk emails
  async sendBulkEmails(orders: Order[], status: string): Promise<BulkEmailResult[]> {
    const results: BulkEmailResult[] = [];
    
    for (const order of orders) {
      try {
        const result = await this.sendOrderStatusEmail(order, status);
        results.push({ 
          orderId: order._id || order.orderId || order.orderNumber || 'unknown', 
          success: true, 
          messageId: result.messageId 
        });
      } catch (error) {
        results.push({ 
          orderId: order._id || order.orderId || order.orderNumber || 'unknown',
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  // Test email configuration
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email configuration is valid');
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      return false;
    }
  }
}

export default EmailService;