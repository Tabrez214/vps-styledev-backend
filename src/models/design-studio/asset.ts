import mongoose, { Schema, Document } from 'mongoose';
import { IAsset, AssetDimensions, AssetMetadata } from '../../interfaces';

export type AssetDocument = Document & IAsset;

const assetSchema = new Schema<AssetDocument>({
  type: {
    type: String,
    required: [true, 'Asset type is required'],
    enum: {
      values: ['clipart', 'uploaded'],
      message: 'Type must be either clipart or uploaded'
    },
    index: true
  },
  category: {
    type: String,
    trim: true,
    index: true,
    maxlength: [50, 'Category name cannot exceed 50 characters'],
    validate: {
      validator: function(this: AssetDocument, v: string): boolean {
        return this.type !== 'clipart' || (!!v && v.length > 0);
      },
      message: 'Category is required for clipart assets'
    }
  },
  name: { // Added for better frontend display
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  url: {
    type: String,
    required: [true, 'Asset URL is required'],
    trim: true
  },
  thumbnailUrl: {
    type: String,
    required: [true, 'Thumbnail URL is required'],
    trim: true
  },
  svg: { // Added for clipart SVG content
    type: String,
    validate: {
      validator: function(this: AssetDocument, v: string): boolean {
        // SVG is required for clipart but optional for uploaded images
        return this.type !== 'clipart' || (!!v && v.length > 0);
      },
      message: 'SVG content is required for clipart assets'
    }
  },
  dimensions: {
    width: {
      type: Number,
      required: [true, 'Width is required'],
      min: [1, 'Width must be at least 1 pixel'],
      max: [10000, 'Width cannot exceed 10000 pixels']
    },
    height: {
      type: Number,
      required: [true, 'Height is required'],
      min: [1, 'Height must be at least 1 pixel'],
      max: [10000, 'Height cannot exceed 10000 pixels']
    }
  },
  metadata: {
    uploadedBy: {
      type: String,
      required: [true, 'UploadedBy is required'],
      trim: true,
      maxlength: [100, 'UploadedBy cannot exceed 100 characters']
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
      maxlength: [255, 'Filename cannot exceed 255 characters']
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative'],
      max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'] // Increased limit
    },
    mimeType: {
      type: String,
      validate: {
        validator: function(v: string) {
          const allowedTypes = /^image\/(jpeg|jpg|png|gif|svg\+xml|webp)$/;
          return allowedTypes.test(v);
        },
        message: 'Invalid mime type'
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Enhanced indexes for better query performance
assetSchema.index({ type: 1, category: 1 });
assetSchema.index({ type: 1, isActive: 1 });
assetSchema.index({ tags: 1, isActive: 1 });
assetSchema.index({ name: 'text', tags: 'text', category: 'text' }); // Full-text search

// Instance method to format for frontend clipart library
assetSchema.methods.toClipartFormat = function() {
  return {
    id: this._id.toString(),
    name: this.name,
    svg: this.svg,
    category: this.category,
    tags: this.tags,
    thumbnailUrl: this.thumbnailUrl
  };
};

const Asset = mongoose.models.Asset || mongoose.model<AssetDocument>('Asset', assetSchema);

export default Asset;
