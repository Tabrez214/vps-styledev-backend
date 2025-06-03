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
  designId: mongoose.Types.ObjectId;
  customer: CustomerInfo;
  sizes: Record<string, number>; // 'S', 'M', etc.
  totalQuantity: number;
  priceBreakdown: PriceBreakdown;
  printerChallanUrl?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  paymentStatus: 'pending' | 'paid' | 'failed';
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
  };
}

const designOrderSchema = new Schema<IDesignOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
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
      enum: ['pending', 'processing', 'shipped', 'delivered'],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
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

const DesignOrder = mongoose.model<IDesignOrder>('DesignOrder', designOrderSchema);
export default DesignOrder;
