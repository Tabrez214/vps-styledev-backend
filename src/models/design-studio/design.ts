import mongoose, { Schema, Document } from 'mongoose';
import { IDesign, DesignMetadata, DesignElement, TShirtStyle, ViewDimensions } from '../../interfaces';

// Create a type that extends Document with our interface
export type DesignDocument = Document & IDesign;

// Design element schema (nested structure from interfaces)
const designElementSchema = new Schema<DesignElement>({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'clipart'],
    required: true
  },
  position: {
    x: {
      type: Number,
      required: true
    },
    y: {
      type: Number,
      required: true
    }
  },
  size: {
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    }
  },
  rotation: {
    type: Number,
    default: 0
  },
  layer: {
    type: Number,
    default: 0
  },
  view: {
    type: String,
    enum: ['front', 'back', 'left', 'right'],
    required: true
  },
  properties: {
    // Text properties
    text: String,
    fontFamily: String,
    fontSize: Number,
    fontColor: String, // Note: backend uses fontColor, frontend uses color
    fontWeight: String,
    fontStyle: String,
    textAlign: {
      type: String,
      enum: ['left', 'center', 'right']
    },
    lineHeight: Number,
    letterSpacing: Number,
    textPath: String,
    
    // Image properties
    src: String,
    opacity: Number,
    filter: String,
    originalWidth: Number,
    originalHeight: Number,
    
    // File metadata for uploaded images
    fileId: String,
    originalFilename: String,
    fileSize: Number,
    mimeType: String,
    uploadedAt: Date
  }
});

// T-Shirt style schema
const tshirtStyleSchema = new Schema({
  style: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  }
});

// Dimensions schema
const dimensionsSchema = new Schema({
  widthInches: {
    type: Number,
    required: true
  },
  heightInches: {
    type: Number,
    required: true
  }
});

// View dimensions schema
const viewDimensionsSchema = new Schema<ViewDimensions>({
  front: dimensionsSchema,
  back: dimensionsSchema,
  left: dimensionsSchema,
  right: dimensionsSchema
});

// Design metadata schema
const designMetadataSchema = new Schema<DesignMetadata>({
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  ipAddress: String,
  userAgent: String,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Main design schema
const designSchema = new Schema<DesignDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Design name cannot exceed 100 characters']
  },
  shareableId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accessToken: {
    type: String,
    index: true
  },
  tshirt: {
    type: tshirtStyleSchema,
    required: true
  },
  elements: [designElementSchema],
  dimensions: viewDimensionsSchema,
  previewImages: {
    front: String,
    back: String,
    left: String,
    right: String
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    type: designMetadataSchema,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
designSchema.index({ shareableId: 1 });
designSchema.index({ 'metadata.email': 1 });
designSchema.index({ isPublic: 1, createdAt: -1 });
designSchema.index({ 'metadata.isDeleted': 1, createdAt: -1 });

// Instance method to generate shareable URL
designSchema.methods.getShareableUrl = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/design/${this.shareableId}`;
};

// Instance method to check if design is editable
designSchema.methods.isEditableBy = function(email: string) {
  return this.metadata.email === email || this.isPublic;
};

// Create and export the model
const Design = mongoose.models.Design || mongoose.model<DesignDocument>('Design', designSchema);

export default Design;
