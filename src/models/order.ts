import mongoose, { Document } from "mongoose";
import { STANDARD_SIZES, StandardSize, StandardAddress } from "../types/standardTypes";

// Use standardized address interface
interface IBillingAddress extends StandardAddress {
  // All fields inherited from StandardAddress for consistency
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

// Order Item interface - Standardized
interface IOrderItem {
  productId?: mongoose.Types.ObjectId; // Consistent ObjectId type
  product?: {                          // Optional populated product data
    _id: mongoose.Types.ObjectId;
    name: string;
    images?: string[];
  };
  designId?: mongoose.Types.ObjectId;
  quantity: number;
  pricePerItem: number;               // Standardized field name (was 'price')
  totalPrice: number;                 // Add for consistency
  color: string;                      // Explicit color field
  size: StandardSize;                 // Use standard size enum
  designData?: any;                   // For design order specific data
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
  verificationToken?: string;
  tokenExpiry?: Date;
  status: 'pending' | 'completed' | 'failed';
  statusHistory?: Array<{
    previousStatus: string;
    newStatus: string;
    changedAt: Date;
    changedBy: string;
    reason?: string;
    automaticChange: boolean;
  }>;
  invoice?: mongoose.Types.ObjectId;
  designOrderData?: any;
  linkedDesignOrders?: mongoose.Types.ObjectId[]; // References to DesignOrder documents
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
    // Billing address from payment gateway (for express checkout) - Standardized
    billingAddress: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      street: { type: String, required: true, trim: true }, // Standardized field name
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      zipCode: { type: String, required: true, trim: true }, // Standardized field name
      country: { type: String, required: true, trim: true, default: 'India' },
      gstNumber: { type: String, trim: true }, // For invoice generation
    },
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId, // Consistent ObjectId type
        ref: "Product",
        required: false, // Optional for design orders
      },
      product: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        name: { type: String },
        images: [{ type: String }]
      },
      designId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Design",
        required: false,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      pricePerItem: {                    // Standardized field name (was 'price')
        type: Number,
        required: true,
        min: 0
      },
      totalPrice: {                      // Add for consistency
        type: Number,
        required: true,
        min: 0
      },
      color: {                           // Explicit color field
        type: String,
        required: true,
        trim: true
      },
      size: {                            // Use standard size enum
        type: String,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        required: true,
        trim: true
      },
      // Enhanced Image Storage - New fields for complete image management
      productName: {
        type: String,
        required: true,
        trim: true,
      },
      primaryImage: {
        url: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          default: "",
        },
        imageId: {
          type: String,
          default: "",
        },
      },
      fallbackImages: [{
        url: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          default: "",
        },
        imageId: {
          type: String,
          default: "",
        },
      }],
      imageMetadata: {
        colorId: {
          type: String,
          default: "",
        },
        totalImagesAvailable: {
          type: Number,
          default: 0,
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
      },
      // Legacy fields for backward compatibility
      image: {
        type: String,
        default: "",
      },
      designData: {                      // For design order specific data
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
    // Secure verification token for thank you page access
    verificationToken: {
      type: String,
      default: null,
    },
    tokenExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "processing", "shipped", "delivered", "cancelled", "returned", "refunded"],
      default: "pending",
    },
    statusHistory: [{
      previousStatus: { type: String, required: true },
      newStatus: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String, required: true },
      reason: { type: String },
      automaticChange: { type: Boolean, default: false }
    }],
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    designOrderData: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    linkedDesignOrders: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignOrder",
    }],
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