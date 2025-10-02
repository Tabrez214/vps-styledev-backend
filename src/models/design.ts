import mongoose, { Document, Schema } from 'mongoose';

// TypeScript interfaces
export interface IDesignElement {
  id: string;
  type: 'text' | 'clipart' | 'image';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  rotation?: number;
  layer: number;
  view: 'front' | 'back' | 'left' | 'right';
  properties?: {
    // For text
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
    fontWeight?: string;
    fontStyle?: string;
    // For images/clipart
    src?: string;
    originalWidth?: number;
    originalHeight?: number;
  };
}

export interface IDesign extends Document {
  name: string;
  shareableId: string;
  accessToken?: string;
  tshirt: {
    style: string;
    color: string;
  };
  elements: IDesignElement[];
  dimensions: {
    front: { widthInches: number; heightInches: number };
    back: { widthInches: number; heightInches: number };
    left: { widthInches: number; heightInches: number };
    right: { widthInches: number; heightInches: number };
  };
  previewImages: {
    front?: string;
    back?: string;
    left?: string;
    right?: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  isPublic: boolean;
  expiresAt?: Date;
}

const designElementSchema = new Schema<IDesignElement>({
  id: { type: String, required: true },
  type: { type: String, enum: ['text', 'clipart', 'image'], required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  size: {
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  rotation: { type: Number, default: 0 },
  layer: { type: Number, required: true },
  view: { type: String, enum: ['front', 'back', 'left', 'right'], required: true },
  properties: {
    text: { type: String },
    fontFamily: { type: String },
    fontSize: { type: Number },
    fontColor: { type: String },
    fontWeight: { type: String },
    fontStyle: { type: String },
    src: { type: String },
    originalWidth: { type: Number },
    originalHeight: { type: Number }
  }
});

const designSchema = new Schema<IDesign>({
  name: { type: String, required: true, trim: true },
  shareableId: { type: String, required: true, unique: true },
  accessToken: { type: String },
  tshirt: {
    style: { type: String, required: true },
    color: { type: String, required: true }
  },
  elements: [designElementSchema],
  dimensions: {
    front: {
      widthInches: { type: Number, default: 0 },
      heightInches: { type: Number, default: 0 }
    },
    back: {
      widthInches: { type: Number, default: 0 },
      heightInches: { type: Number, default: 0 }
    },
    left: {
      widthInches: { type: Number, default: 0 },
      heightInches: { type: Number, default: 0 }
    },
    right: {
      widthInches: { type: Number, default: 0 },
      heightInches: { type: Number, default: 0 }
    }
  },
  previewImages: {
    front: { type: String },
    back: { type: String },
    left: { type: String },
    right: { type: String }
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    email: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  isPublic: { type: Boolean, default: false },
  expiresAt: { type: Date }
}, {
  timestamps: true
});

designSchema.pre<IDesign>('save', function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

designSchema.index({ 'metadata.email': 1 });
designSchema.index({ isPublic: 1 });
designSchema.index({ expiresAt: 1 });

const Design = mongoose.models.Design || mongoose.model<IDesign>('Design', designSchema);
export default Design;
