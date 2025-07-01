import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceItem {
  description: string;
  size: string;
  color: string;
  customColor?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  image?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
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
  // Company information
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  gstNumber?: string; // Company GST number
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  description: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    required: true,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
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
  }
});

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
      validator: function(items: IInvoiceItem[]) {
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
  companyName: {
    type: String,
    required: true,
    trim: true,
    default: 'Styledev'
  },
  companyAddress: {
    type: String,
    required: true,
    trim: true,
    default: '123 Business Street, City, State - 123456'
  },
  companyPhone: {
    type: String,
    required: true,
    trim: true,
    default: '+91 98765 43210'
  },
  companyEmail: {
    type: String,
    required: true,
    trim: true,
    default: 'info@styledev.com'
  },
  gstNumber: { // Company GST number
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Index for faster queries
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ customerName: 1 });
InvoiceSchema.index({ date: -1 });
InvoiceSchema.index({ status: 1 });

export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);