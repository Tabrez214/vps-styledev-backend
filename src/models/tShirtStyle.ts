import mongoose, { Document, Schema } from 'mongoose';

interface IColor {
  name: string;
  hex: string;
  isAvailable?: boolean;
}

interface ISize {
  size: string;
  isAvailable?: boolean;
  additionalCost?: number;
}

interface IImageSet {
  front: string;
  back: string;
  left: string;
  right: string;
}

interface IPrintableArea {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ITShirtStyle extends Document {
  name: string;
  description: string;
  basePrice: number;
  availableColors: IColor[];
  availableSizes: ISize[];
  images: IImageSet;
  printableAreas: {
    front: IPrintableArea;
    back: IPrintableArea;
    left: IPrintableArea;
    right: IPrintableArea;
  };
  isActive: boolean;
}

const tshirtStyleSchema = new Schema<ITShirtStyle>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    basePrice: { type: Number, required: true },
    availableColors: [{
      name: { type: String, required: true },
      hex: { type: String, required: true },
      isAvailable: { type: Boolean, default: true }
    }],
    availableSizes: [{
      size: { type: String, required: true },
      isAvailable: { type: Boolean, default: true },
      additionalCost: { type: Number, default: 0 }
    }],
    images: {
      front: { type: String, required: true },
      back: { type: String, required: true },
      left: { type: String, required: true },
      right: { type: String, required: true }
    },
    printableAreas: {
      front: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      },
      back: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      },
      left: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      },
      right: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

tshirtStyleSchema.index({ name: 1 });
tshirtStyleSchema.index({ isActive: 1 });
tshirtStyleSchema.index({ 'availableSizes.size': 1 });

const TShirtStyle = mongoose.model<ITShirtStyle>('TShirtStyle', tshirtStyleSchema);
export default TShirtStyle;
