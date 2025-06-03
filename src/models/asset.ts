import mongoose, { Document, Schema } from 'mongoose';

export interface IAsset extends Document {
  type: 'clipart' | 'uploaded';
  category?: string;
  tags?: string[];
  url: string;
  thumbnailUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
  metadata: {
    createdAt?: Date;
    uploadedBy?: string;
    originalFilename?: string;
  };
  isActive: boolean;
}

const assetSchema = new Schema<IAsset>(
  {
    type: { type: String, enum: ['clipart', 'uploaded'], required: true },
    category: {
      type: String,
      required: function () {
        return this.type === 'clipart';
      }
    },
    tags: [String],
    url: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    metadata: {
      createdAt: { type: Date, default: Date.now },
      uploadedBy: String,
      originalFilename: String
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

assetSchema.index({ type: 1, category: 1 });
assetSchema.index({ tags: 1 });
assetSchema.index({ isActive: 1 });

const Asset = mongoose.model<IAsset>('Asset', assetSchema);
export default Asset;
