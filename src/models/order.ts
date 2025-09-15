import mongoose, { Document } from "mongoose";

// Billing Address interface
interface IBillingAddress {
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  gstNumber?: string;
}

// Guest Session Data interface
interface IGuestSessionData {
  guestToken?: string;
  sessionExpiry?: Date;
  allowAccountClaim?: boolean;
}

// Express Checkout Metadata interface
interface IExpressCheckoutMetadata {
  isExistingUserExpressCheckout?: boolean;
  userAccountMessage?: string;
  originalEmail?: string;
}

// Order Item interface
interface IOrderItem {
  productId?: any; // Mixed type for flexibility
  designId?: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  sizes?: any; // Mixed type for design orders
  designData?: any; // Mixed type for design orders
}

// Main Order interface
export interface IOrder extends Document {
  name: string;
  amount: number;
  discountCode?: mongoose.Types.ObjectId;
  discountAmount: number;
  subtotal: number;
  totalAmount: number;
  order_id: string;
  user: mongoose.Types.ObjectId;
  address: any; // Mixed type - can be ObjectId or direct object
  isExpressCheckout: boolean;
  isGuestOrder: boolean;
  billingAddress?: IBillingAddress;
  items: IOrderItem[];
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  status: 'pending' | 'completed' | 'failed';
  invoice?: mongoose.Types.ObjectId;
  designOrderData?: any;
  checkoutType: 'regular' | 'express';
  guestSessionData?: IGuestSessionData;
  expressCheckoutMetadata?: IExpressCheckoutMetadata;
  paymentSource: 'cart' | 'express-checkout' | 'design-studio';
  purchaseOrderNumber?: string; // Customer's Purchase Order number
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    discountCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiscountCode",
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    order_id: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
      type: mongoose.Schema.Types.Mixed, // Made flexible to support both ObjectId and direct address objects
      required: true,
    },
    // Express checkout and guest order fields
    isExpressCheckout: {
      type: Boolean,
      default: false,
    },
    isGuestOrder: {
      type: Boolean,
      default: false,
    },
    // Billing address from payment gateway (for express checkout)
    billingAddress: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' },
      gstNumber: { type: String, trim: true }, // For invoice generation
    },
    items: [{
      productId: {
        type: mongoose.Schema.Types.Mixed, // Made flexible to support design orders
        ref: "Product",
        required: false, // Made optional for design orders
      },
      designId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Design",
        required: false,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      // Design order specific fields
      sizes: {
        type: mongoose.Schema.Types.Mixed,
        required: false,
      },
      designData: {
        type: mongoose.Schema.Types.Mixed,
        required: false,
      }
    }],
    razorpay_payment_id: {
      type: String,
      default: null,
    },
    razorpay_order_id: {
      type: String,
      default: null,
    },
    razorpay_signature: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    designOrderData: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    // Express checkout metadata
    checkoutType: {
      type: String,
      enum: ['regular', 'express'],
      default: 'regular',
    },
    // Guest session information
    guestSessionData: {
      guestToken: { type: String },
      sessionExpiry: { type: Date },
      allowAccountClaim: { type: Boolean, default: true },
    },
    // Express checkout metadata for tracking user scenarios
    expressCheckoutMetadata: {
      isExistingUserExpressCheckout: { type: Boolean, default: false },
      userAccountMessage: { type: String },
      originalEmail: { type: String, trim: true, lowercase: true },
    },
    // Payment source tracking
    paymentSource: {
      type: String,
      enum: ['cart', 'express-checkout', 'design-studio'],
      default: 'cart',
    },
    // Customer's Purchase Order number
    purchaseOrderNumber: {
      type: String,
      trim: true,
      index: true // Add index for faster queries
    },
  },
  {
    timestamps: true,
  }
);

const orderModel = mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
export default orderModel;