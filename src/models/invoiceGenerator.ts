import mongoose, { Schema, Document } from 'mongoose';
import { STANDARD_SIZES, StandardSize } from '../types/standardTypes';

export interface IInvoiceItem {
  id?: string;                 // Add unique identifier
  description: string;
  size: StandardSize;          // Use standard size enum
  color: string;
  customColor?: string;
  quantity: number;
  unitPrice: number;           // Same as pricePerItem
  total: number;               // Same as tot  alPrice
  image?: string;
  isDesignItem?: boolean;      // Add for design order items
  designData?: any;            // Add for design order specific data
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  invoiceType: 'tax' | 'proforma'; // Added invoice type
  date: Date;
  dueDate: Date;
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerGstNumber?: string; // Added customer GST number
  billingAddress: string; // Added specific billing address
  shippingAddress?: string; // Added optional shipping address
  items: IInvoiceItem[];
  subtotal: number;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  discountAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  // Company information - removed as they are hardcoded in PDF
  gstNumber?: string; // Company GST number
  // Order reference
  orderId?: string; // Reference to the order ID
  order?: mongoose.Schema.Types.ObjectId; // Reference to the Order document
  purchaseOrderNumber?: string; // Customer's Purchase Order number
  // Conversion tracking
  convertedFrom?: mongoose.Schema.Types.ObjectId; // Reference to proforma invoice if converted
  convertedTo?: mongoose.Schema.Types.ObjectId; // Reference to tax invoice if converted
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  id: {
    type: String,
    default: () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    required: true,
    enum: STANDARD_SIZES            // Use standardized size enum
  },
  color: {
    type: String,
    required: true
  },
  customColor: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String,
    trim: true
  },
  isDesignItem: {                   // Add for design order items
    type: Boolean,
    default: false
  },
  designData: {                     // Add for design order specific data
    type: Schema.Types.Mixed
  }
});

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceType: {
    type: String,
    required: true,
    enum: ['tax', 'proforma'],
    default: 'tax'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  customerAddress: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerGstNumber: { // Added customer GST number
    type: String,
    trim: true
  },
  billingAddress: { // Added specific billing address
    type: String,
    required: true,
    trim: true
  },
  shippingAddress: { // Added optional shipping address
    type: String,
    trim: true
  },
  items: {
    type: [InvoiceItemSchema],
    required: true,
    validate: {
      validator: function (items: IInvoiceItem[]) {
        return items.length > 0;
      },
      message: 'Invoice must have at least one item'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'amount'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  cgst: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 9
  },
  sgst: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 9
  },
  igst: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  cgstAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  sgstAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  igstAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  // Company information
  gstNumber: { // Company GST number
    type: String,
    trim: true
  },
  // Order reference fields
  orderId: {
    type: String,
    trim: true,
    index: true // Add index for faster queries
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true // Add index for faster queries
  },
  purchaseOrderNumber: {
    type: String,
    trim: true,
    index: true // Add index for faster queries
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  // Conversion tracking fields
  convertedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    index: true
  },
  convertedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    index: true
  }
}, {
  timestamps: true
});

InvoiceSchema.index({ customerName: 1 });
InvoiceSchema.index({ date: -1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ invoiceType: 1 });

export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);