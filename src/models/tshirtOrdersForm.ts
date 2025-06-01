import mongoose, { Document, Schema } from 'mongoose';

// Interface for TypeScript type checking
export interface ITShirtOrder extends Document {
  name: string;
  email: string;
  phone: string;
  tShirtType: string;
  quantity: number;
  sizes: { size: string; quantity: number }[];
  colorPreference: string;
  customText?: string;
  fileUpload?: string; // Store file path/URL
  deliveryLocation: string;
  deliveryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose Schema
const TShirtOrderFormSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  tShirtType: {
    type: String,
    required: [true, 'T-shirt type is required'],
    enum: {
      values: ['Round Neck', 'Polo', 'Hoodie', 'Crop Top', 'Kids T-shirt', 'Other'],
      message: 'Please select a valid t-shirt type'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [10000, 'Quantity cannot exceed 10,000']
  },
  sizes: [
    {
      size: {
        type: String,
        enum: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
        required: true,
      },
      quantity: { type: Number, required: true, min: 0 },
    },
  ],
  colorPreference: {
    type: String,
    required: [true, 'Color preference is required'],
    trim: true,
    maxlength: [100, 'Color preference cannot exceed 100 characters']
  },
  customText: {
    type: String,
    trim: true,
    maxlength: [1000, 'Custom text cannot exceed 1000 characters']
  },
  fileUpload: {
    type: String, // Store file path or URL
    trim: true
  },
  deliveryLocation: {
    type: String,
    required: [true, 'Delivery location is required'],
    trim: true,
    maxlength: [200, 'Delivery location cannot exceed 200 characters']
  },
  deliveryDate: {
    type: Date,
    required: [true, 'Delivery date is required'],
    validate: {
      validator: function(date: Date) {
        return date > new Date();
      },
      message: 'Delivery date must be in the future'
    }
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'tshirt_orders_form'
});

// Index for better query performance
TShirtOrderFormSchema.index({ email: 1 });
TShirtOrderFormSchema.index({ createdAt: -1 });

// Export the model
export default mongoose.model<ITShirtOrder>('TShirtOrderForm', TShirtOrderFormSchema);