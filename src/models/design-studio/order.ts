import mongoose, { Schema, Document } from 'mongoose';
import { IOrder, OrderCost } from '../../interfaces';

// Create a type that extends Document with our interface
export interface OrderDocument extends Document, IOrder { }

// Order cost schema with validation
const orderCostSchema = new Schema<OrderCost>({
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  }
});

// Order schema with enhanced validation
const orderSchema = new Schema<OrderDocument>({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  designId: {
    type: String,
    required: true
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    address: {
      street: {
        type: String,
        required: true,
        trim: true
      },
      city: {
        type: String,
        required: true,
        trim: true
      },
      state: {
        type: String,
        required: true,
        trim: true
      },
      zipCode: {
        type: String,
        required: true,
        trim: true
      },
      country: {
        type: String,
        required: true,
        trim: true
      }
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9+\-\s()]{7,20}$/, 'Please enter a valid phone number']
    }
  },
  sizes: {
    type: Map,
    of: Number,
    required: true,
    validate: {
      validator: function (sizes: Map<string, number>) {
        return Array.from(sizes.values()).some(qty => qty > 0);
      },
      message: 'At least one size must have a quantity greater than 0'
    }
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: [1, 'Total quantity must be at least 1']
  },
  priceBreakdown: {
    basePrice: {
      type: Number,
      required: true,
      min: [0, 'Base price cannot be negative']
    },
    additionalCosts: [orderCostSchema],
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    tax: {
      type: Number,
      required: true,
      min: [0, 'Tax cannot be negative']
    },
    shipping: {
      type: Number,
      required: true,
      min: [0, 'Shipping cost cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  printerChallanUrl: {
    type: String,
    trim: true
  },
  metadata: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Validate price breakdown totals
orderSchema.pre('save', function (next) {
  const order = this as OrderDocument;

  const additionalCostsTotal = order.priceBreakdown.additionalCosts.reduce(
    (sum, cost) => sum + cost.amount, 0
  );

  const expectedSubtotal = order.priceBreakdown.basePrice + additionalCostsTotal;

  if (Math.abs(order.priceBreakdown.subtotal - expectedSubtotal) > 0.01) {
    return next(new Error('Subtotal does not match the sum of base price and additional costs'));
  }

  const expectedTotal = order.priceBreakdown.subtotal + order.priceBreakdown.tax + order.priceBreakdown.shipping;

  if (Math.abs(order.priceBreakdown.total - expectedTotal) > 0.01) {
    return next(new Error('Total does not match the sum of subtotal, tax, and shipping'));
  }

  next();
});

// Create indexes for better query performance
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Create and export the model
const Order = mongoose.models.Order || mongoose.model<OrderDocument>('Order', orderSchema);

export default Order;
