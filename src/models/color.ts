import mongoose, { Schema, Document } from "mongoose";

export interface IColorImage {
  url: string;
  caption?: string;
  isDefault?: boolean;
  imageAlt?: string;
}

export interface IColor extends Document {
  name: string;
  hexCode: string;
  images?: IColorImage[];
}

const ColorImageSchema = new Schema<IColorImage>({
  url: { type: String, required: true },
  caption: { type: String },
  isDefault: { type: Boolean, default: false },
  imageAlt: { type: String },
});

const ColorSchema = new Schema<IColor>({
  name: { type: String, required: true },
  hexCode: { type: String, required: true },
  images: [ColorImageSchema],
});

const Color = mongoose.models.Color || mongoose.model<IColor>("Color", ColorSchema);

export default Color;
