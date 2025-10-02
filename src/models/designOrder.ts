import mongoose, { Document, Schema } from 'mongoose';

interface PriceBreakdown {
  basePrice: number;
  additionalCosts: { description: string; amount: number }[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

interface CustomerInfo {
  email: string;
  name: string;
  address: string;
  phone?: string;
}

export interface IDesignOrder extends Document {
  orderNumber: string;
  mainOrderId?: mongoose.Types.ObjectId; // Reference to main Order document
  designId: mongoose.Types.ObjectId;
  customer: CustomerInfo;
  sizes: Record<string, number>; // 'S', 'M', etc.
  totalQuantity: number;
  priceBreakdown: PriceBreakdown;
  printerChallanUrl?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  statusHistory?: Array<{
    previousStatus: string;
    newStatus: string;
    changedAt: Date;
    changedBy: string;
    reason?: string;
    automaticChange: boolean;
  }>;
  paymentStatus: 'pending' | 'paid' | 'failed';
  // Design data for manufacturing
  designData?: any; // Complete design data including elements, shirt style, etc.
  manufacturingInfo?: {
    tempDesignReference?: string;
    isTemporaryDesign?: boolean;
    designInfo?: any;
    originalDesignId?: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
  };
}

const designOrderSchema = new Schema<IDesignOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    mainOrderId: { type: Schema.Types.ObjectId, ref: 'Order' }, // Reference to main order
    designId: { type: Schema.Types.ObjectId, ref: 'Design', required: true },
    customer: {
      email: { type: String, required: true },
      name: { type: String, required: true },
      address: { type: String, required: true },
      phone: { type: String }
    },
    sizes: {
      S: { type: Number, default: 0 },
      M: { type: Number, default: 0 },
      L: { type: Number, default: 0 },
      XL: { type: Number, default: 0 },
      '2XL': { type: Number, default: 0 },
      '3XL': { type: Number, default: 0 },
      '4XL': { type: Number, default: 0 },
      '5XL': { type: Number, default: 0 }
    },
    totalQuantity: { type: Number, required: true },
    priceBreakdown: {
      basePrice: { type: Number, required: true },
      additionalCosts: [{ description: String, amount: Number }],
      subtotal: { type: Number, required: true },
      tax: { type: Number, required: true },
      shipping: { type: Number, required: true },
      total: { type: Number, required: true }
    },
    printerChallanUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'],
      default: 'pending'
    },
    statusHistory: [{
      previousStatus: { type: String, required: true },
      newStatus: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String, required: true },
      reason: { type: String },
      automaticChange: { type: Boolean, default: false }
    }],
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    // Design data for manufacturing
    designData: {
      elements: [Schema.Types.Mixed], // Design elements (images, text, etc.)
      selectedShirt: Schema.Types.Mixed, // Shirt style and color info
      printLocations: Schema.Types.Mixed, // Front, back, left, right print info
      printType: String, // screen, digital, etc.
      productName: String,
      shirtInfo: Schema.Types.Mixed
    },
    manufacturingInfo: {
      tempDesignReference: String,
      isTemporaryDesign: { type: Boolean, default: false },
      designInfo: Schema.Types.Mixed,
      originalDesignId: String
    },
    metadata: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      ipAddress: String
    }
  },
  { timestamps: true }
);

designOrderSchema.pre<IDesignOrder>('save', function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

designOrderSchema.index({ 'customer.email': 1 });
designOrderSchema.index({ status: 1 });
designOrderSchema.index({ paymentStatus: 1 });
designOrderSchema.index({ 'metadata.createdAt': 1 });

const DesignOrder = mongoose.models.DesignOrder || mongoose.model<IDesignOrder>('DesignOrder', designOrderSchema);
export default DesignOrder;
