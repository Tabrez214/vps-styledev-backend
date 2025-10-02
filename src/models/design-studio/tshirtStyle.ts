import mongoose, { Schema, Document } from 'mongoose';
import { ITShirtStyle, TShirtColor, TShirtSize, PrintableArea } from '../../interfaces';

// Create a type that extends Document with our interface
export type TShirtStyleDocument = Document & ITShirtStyle;

// Color schema with validation
const tshirtColorSchema = new Schema<TShirtColor>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  hex: {
    type: String,
    required: true,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color code']
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
});

// Size schema with validation
const tshirtSizeSchema = new Schema<TShirtSize>({
  size: {
    type: String,
    required: true,
    enum: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    message: 'Size must be one of the standard sizes'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  additionalCost: {
    type: Number,
    default: 0,
    min: [0, 'Additional cost cannot be negative']
  }
});

// Printable area schema with validation
// Updated printable areas definition - make them optional
const printableAreaSchema = new Schema<PrintableArea>({
  width: {
    type: Number,
    required: true,
    min: [1, 'Width must be at least 1 pixel']
  },
  height: {
    type: Number,
    required: true,
    min: [1, 'Height must be at least 1 pixel']
  },
  x: {
    type: Number,
    required: true,
    min: [0, 'X position cannot be negative']
  },
  y: {
    type: Number,
    required: true,
    min: [0, 'Y position cannot be negative']
  }
});

// Modified schema with optional printable areas
const tshirtStyleSchema = new Schema<TShirtStyleDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  basePrice: {
    type: Number,
    required: true,
    min: [1, 'Base price must be at least 1']
  },
  availableColors: [tshirtColorSchema],
  availableSizes: [tshirtSizeSchema],
  images: {
    front: {
      type: String,
      required: [true, 'Front image URL is required'],
      validate: {
        validator: function (v) {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format for front image'
      }
    },
    back: {
      type: String,
      required: [true, 'Back image URL is required'],
      validate: {
        validator: function (v) {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format for back image'
      }
    },
    left: {
      type: String,
      required: [true, 'Left image URL is required'],
      validate: {
        validator: function (v) {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format for left image'
      }
    },
    right: {
      type: String,
      required: [true, 'Right image URL is required'],
      validate: {
        validator: function (v) {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format for right image'
      }
    }
  },
  printableAreas: {
    front: { type: printableAreaSchema, required: false },
    back: { type: printableAreaSchema, required: false },
    left: { type: printableAreaSchema, required: false },
    right: { type: printableAreaSchema, required: false }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Validate that at least one color and size is available
tshirtStyleSchema.pre('save', function (next) {
  const tshirtStyle = this as TShirtStyleDocument;

  // Check if at least one color is available
  const hasAvailableColor = tshirtStyle.availableColors.some(color => color.isAvailable);
  if (!hasAvailableColor) {
    return next(new Error('At least one color must be available'));
  }

  // Check if at least one size is available
  const hasAvailableSize = tshirtStyle.availableSizes.some(size => size.isAvailable);
  if (!hasAvailableSize) {
    return next(new Error('At least one size must be available'));
  }

  next();
});

// Create indexes for better query performance
tshirtStyleSchema.index({ isActive: 1 });

// Create and export the model
const TShirtStyle = mongoose.models.TShirtStyle || mongoose.model<TShirtStyleDocument>('TShirtStyle', tshirtStyleSchema);

export default TShirtStyle;