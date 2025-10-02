import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/config';
import { OrderDocument } from '../../models/design-studio/order';
import { DesignDocument } from '../../models/design-studio/design';

/**
 * Generate a printer challan PDF for an order
 * @param orderId The order ID
 * @returns Path to the generated PDF file
 */
export const generatePrinterChallan = async (orderId: string): Promise<string> => {
  // Ensure the challans directory exists
  if (!fs.existsSync(config.DESIGNS_CHALLANS_DIR)) {
    fs.mkdirSync(config.DESIGNS_CHALLANS_DIR, { recursive: true });
  }
  
  // Import models here to avoid circular dependencies
  const Order = require('../models/orderModel').default;
  const Design = require('../models/designModel').default;
  
  // Find the order with populated design
  const order = await Order.findById(orderId).exec();
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }
  
  // Find the design
  const design = await Design.findById(order.designId).exec();
  if (!design) {
    throw new Error(`Design not found for order: ${orderId}`);
  }
  
  // Create a unique filename for this challan
  const challanFilename = `challan-${order.orderNumber}-${uuidv4()}.pdf`;
  const challanPath = path.join(config.DESIGNS_CHALLANS_DIR, challanFilename);
  
  // Generate the PDF
  await generateChallanPDF(order, design, challanPath);
  
  // Return the relative URL path
  return `/uploads/designs/challans/${challanFilename}`;
};

/**
 * Generate the actual PDF document for a printer challan
 * @param order The order document
 * @param design The design document
 * @param outputPath Path where the PDF should be saved
 */
const generateChallanPDF = async (
  order: OrderDocument,
  design: DesignDocument,
  outputPath: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Pipe the PDF to a file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Add header
      doc.fontSize(20).text('PRINTER CHALLAN', { align: 'center' });
      doc.moveDown();
      
      // Add order information
      doc.fontSize(12).text(`Order Number: ${order.orderNumber}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();
      
      // Add customer information
      doc.fontSize(14).text('Customer Information', { underline: true });
      doc.fontSize(12).text(`Name: ${order.customer.name}`);
      doc.text(`Email: ${order.customer.email}`);
      doc.text(`Phone: ${order.customer.phone}`);
      doc.moveDown();
      
      // Add order details
      doc.fontSize(14).text('Order Details', { underline: true });
      doc.fontSize(12).text(`T-Shirt Style: ${design.tshirt.style}`);
      doc.text(`Color: ${design.tshirt.color}`);
      doc.moveDown();
      
      // Add size breakdown
      doc.fontSize(14).text('Size Breakdown', { underline: true });
      doc.fontSize(12);
      
      // Convert Map to object for iteration
      const sizes = order.sizes instanceof Map 
        ? Object.fromEntries(order.sizes) 
        : order.sizes;

      Object.entries(sizes).forEach(([size, quantity]) => {
        if (typeof quantity === 'number' && quantity > 0) {
          doc.text(`${size}: ${quantity}`);
        }
      });
      
      doc.text(`Total Quantity: ${order.totalQuantity}`);
      doc.moveDown();
      
      // Add design dimensions
      doc.fontSize(14).text('Design Dimensions', { underline: true });
      doc.fontSize(12);
      
      ['front', 'back', 'left', 'right'].forEach(view => {
        const viewDimensions = design.dimensions[view as keyof typeof design.dimensions];
        if (viewDimensions.widthInches > 0 && viewDimensions.heightInches > 0) {
          doc.text(`${view.charAt(0).toUpperCase() + view.slice(1)}: ${viewDimensions.widthInches.toFixed(2)}" × ${viewDimensions.heightInches.toFixed(2)}"`);
        }
      });
      
      doc.moveDown();
      
      // Add design preview images
      doc.fontSize(14).text('Design Previews', { underline: true });
      doc.moveDown();
      
      // Check if preview images exist and add them to the PDF
      if (design.previewImages) {
        const previewViews = ['front', 'back', 'left', 'right'] as const;
        let row = 0;
        let col = 0;
        
        for (const view of previewViews) {
          const previewPath = design.previewImages[view];
          
          if (previewPath) {
            const fullPath = path.join(process.cwd(), 'public', previewPath);
            
            if (fs.existsSync(fullPath)) {
              // Calculate position for 2x2 grid
              const x = 50 + (col * 250);
              const y = 500 + (row * 250);
              
              // Add image and label
              doc.image(fullPath, x, y, { width: 200 });
              doc.text(view.toUpperCase(), x, y + 210, { width: 200, align: 'center' });
              
              // Update grid position
              col++;
              if (col >= 2) {
                col = 0;
                row++;
              }
            }
          }
        }
      }
      
      // Add printing instructions
      doc.addPage();
      doc.fontSize(14).text('Printing Instructions', { underline: true });
      doc.fontSize(12);
      
      // Count elements by type and view
      const elementCounts = {
        front: { text: 0, image: 0, clipart: 0 },
        back: { text: 0, image: 0, clipart: 0 },
        left: { text: 0, image: 0, clipart: 0 },
        right: { text: 0, image: 0, clipart: 0 }
      };
      
      design.elements.forEach(element => {
        const view = element.view as keyof typeof elementCounts;
        const type = element.type as keyof typeof elementCounts.front;
        elementCounts[view][type]++;
      });
      
      // Add element counts to instructions
      Object.entries(elementCounts).forEach(([view, counts]) => {
        const totalElements = counts.text + counts.image + counts.clipart;
        if (totalElements > 0) {
          doc.text(`${view.toUpperCase()} PRINT:`);
          if (counts.text > 0) doc.text(`- ${counts.text} text elements`, { indent: 20 });
          if (counts.image > 0) doc.text(`- ${counts.image} image elements`, { indent: 20 });
          if (counts.clipart > 0) doc.text(`- ${counts.clipart} clipart elements`, { indent: 20 });
          doc.moveDown();
        }
      });
      
      // Add footer
      const footerText = 'This challan was automatically generated by the Styledev.in T-Shirt Design System.';
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const footerFontSize = 10;
      doc.fontSize(footerFontSize);

      // Calculate text width to center it
      const textWidth = doc.widthOfString(footerText);
      const x = (pageWidth - textWidth) / 2;
      const y = pageHeight - 50; // 50 units from the bottom

      doc.text(footerText, x, y);
      // Finalize the PDF
      doc.end();
      
      // Handle stream events
      stream.on('finish', () => {
        resolve();
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};
