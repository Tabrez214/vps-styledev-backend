// models/Order.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

// Enums for better type safety
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  UPI = 'upi',
  NET_BANKING = 'net_banking',
  WALLET = 'wallet',
  EMI = 'emi'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  SAME_DAY = 'same_day'
}

export enum OrderSource {
  WEB = 'web',
  MOBILE_APP = 'mobile_app',
  CALL_CENTER = 'call_center',
  ADMIN = 'admin'
}

export enum RefundStatus {
  NONE = 'none',
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected'
}

// Interface definitions
export interface IOrderItem {
  productId?: mongoose.Types.ObjectId;
  productName: string;
  name?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  size?: string;
  color?: string;
  quantity: number;
  price: number;
  pricePerItem: number;
  unitPrice: number;
  totalPrice: number;
  total: number;
}

export interface IAddress {
  fullName?: string;
  name?: string;
  street?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
}

export interface ICustomer {
  name: string;
  email: string;
  phone?: string;
  address?: IAddress;
}

export interface IEmailTracking {
  status: OrderStatus;
  sentAt: Date;
  messageId?: string;
  success: boolean;
  error?: string;
}

export interface IOrder extends Document {
  orderId?: string;
  orderNumber?: string;
  customer: ICustomer;
  email?: string;
  shippingAddress: IAddress;
  billingAddress?: IAddress;
  items: IOrderItem[];
  
  // Financial details
  subtotal: number;
  tax: number;
  discount: number;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  total: number;
  
  // Order status and tracking
  status: OrderStatus;
  
  // Payment details
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  
  // Shipping details
  shippingMethod: ShippingMethod;
  trackingNumber?: string;
  courierPartner?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  
  // Discount and coupon details
  couponCode?: string;
  couponDiscount: number;
  
  // Timestamps
  orderDate: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  
  // Additional fields
  notes?: string;
  adminNotes?: string;
  source: OrderSource;
  
  // Email tracking
  emailsSent: IEmailTracking[];
  
  // Return/refund details
  returnRequested: boolean;
  returnReason?: string;
  returnRequestedAt?: Date;
  refundAmount: number;
  refundStatus: RefundStatus;
  
  // Timestamps from mongoose
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  orderAge: number;
  totalItems: number;
  
  // Methods
  updateStatus(newStatus: OrderStatus, emailService?: any): Promise<IOrder>;
}

// Interface for Order model static methods
export interface IOrderModel extends Model<IOrder> {
  findByEmail(email: string): Promise<IOrder[]>;
  findByStatus(status: OrderStatus): Promise<IOrder[]>;
  getOrderStats(): Promise<any[]>;
}

// Alternative approach using declaration merging for statics
export interface IOrderStatics {
  findByEmail(email: string): Promise<IOrder[]>;
  findByStatus(status: OrderStatus): Promise<IOrder[]>;
  getOrderStats(): Promise<any[]>;
}

// Schema definitions
const orderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product'
  },
  productName: {
    type: String,
    required: true
  },
  name: String,
  description: String,
  image: String,
  imageUrl: String,
  size: String,
  color: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  pricePerItem: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

const addressSchema = new Schema<IAddress>({
  fullName: String,
  name: String,
  street: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  postalCode: String,
  country: {
    type: String,
    default: 'India'
  },
  phone: String,
  phoneNumber: String,
  email: String
});

const customerSchema = new Schema<ICustomer>({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string): boolean {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  phone: String,
  address: addressSchema
});

const emailTrackingSchema = new Schema<IEmailTracking>({
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  messageId: String,
  success: {
    type: Boolean,
    default: true
  },
  error: String
});

const orderSchema = new Schema<IOrder>({
  orderId: {
    type: String,
    unique: true,
    sparse: true
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  customer: {
    type: customerSchema,
    required: true
  },
  
  // Alternative email field (used in email service)
  email: {
    type: String,
    validate: {
      validator: function(v: string): boolean {
        return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  
  // Shipping address
  shippingAddress: {
    type: addressSchema,
    required: true
  },
  
  // Billing address (optional, defaults to shipping if not provided)
  billingAddress: addressSchema,
  
  // Order items
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(v: IOrderItem[]): boolean {
        return v && v.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  
  // Financial details
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Order status and tracking
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING
  },
  
  // Payment details
  paymentMethod: {
    type: String,
    enum: Object.values(PaymentMethod),
    required: true
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING
  },
  paymentId: String,
  
  // Shipping details
  shippingMethod: {
    type: String,
    enum: Object.values(ShippingMethod),
    default: ShippingMethod.STANDARD
  },
  trackingNumber: String,
  courierPartner: String,
  estimatedDeliveryDate: Date,
  actualDeliveryDate: Date,
  
  // Discount and coupon details
  couponCode: String,
  couponDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Timestamps
  orderDate: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  
  // Additional fields
  notes: String,
  adminNotes: String,
  source: {
    type: String,
    enum: Object.values(OrderSource),
    default: OrderSource.WEB
  },
  
  // Email tracking
  emailsSent: [emailTrackingSchema],
  
  // Return/refund details
  returnRequested: {
    type: Boolean,
    default: false
  },
  returnReason: String,
  returnRequestedAt: Date,
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundStatus: {
    type: String,
    enum: Object.values(RefundStatus),
    default: RefundStatus.NONE
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ trackingNumber: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ orderNumber: 1 });

// Pre-save middleware to generate order ID/number if not provided
orderSchema.pre<IOrder>('save', function(next) {
  if (!this.orderId && !this.orderNumber) {
    // Generate a unique order ID (you can customize this format)
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderId = `AJ${timestamp.slice(-6)}${random}`;
    this.orderNumber = this.orderId;
  }
  
  // Ensure both total and totalAmount are set
  if (this.totalAmount && !this.total) {
    this.total = this.totalAmount;
  } else if (this.total && !this.totalAmount) {
    this.totalAmount = this.total;
  }
  
  // Ensure discount fields are consistent
  if (this.discountAmount && !this.discount) {
    this.discount = this.discountAmount;
  } else if (this.discount && !this.discountAmount) {
    this.discountAmount = this.discount;
  }
  
  next();
});

// Virtual for order age in days
orderSchema.virtual('orderAge').get(function(this: IOrder): number {
  return Math.floor((Date.now() - this.orderDate.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function(this: IOrder): number {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to update order status and send email
orderSchema.methods.updateStatus = async function(
  this: IOrder,
  newStatus: OrderStatus,
  emailService?: any
): Promise<IOrder> {
  this.status = newStatus;
  
  // Set timestamp based on status
  switch (newStatus) {
    case OrderStatus.CONFIRMED:
      this.confirmedAt = new Date();
      break;
    case OrderStatus.SHIPPED:
      this.shippedAt = new Date();
      break;
    case OrderStatus.DELIVERED:
      this.deliveredAt = new Date();
      break;
    case OrderStatus.CANCELLED:
      this.cancelledAt = new Date();
      break;
  }
  
  await this.save();
  
  // Send email notification if email service is provided
  if (emailService) {
    try {
      const result = await emailService.sendOrderStatusEmail(this, newStatus);
      
      // Track email sent
      this.emailsSent.push({
        status: newStatus,
        sentAt: new Date(),
        messageId: result.messageId,
        success: true
      });
      
      await this.save();
    } catch (error: any) {
      // Track email failure
      this.emailsSent.push({
        status: newStatus,
        sentAt: new Date(),
        success: false,
        error: error.message
      });
      
      await this.save();
      throw error;
    }
  }
  
  return this;
};

// Static method to find orders by email
orderSchema.statics.findByEmail = function(email: string) {
  return this.find({
    $or: [
      { 'customer.email': email },
      { email: email },
      { 'shippingAddress.email': email }
    ]
  });
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status: OrderStatus) {
  return this.find({ status });
};

// Static method to get order statistics
orderSchema.statics.getOrderStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Create the model with proper typing
const Order = mongoose.model<IOrder>('Order', orderSchema) as Model<IOrder> & IOrderStatics;

export default Order;