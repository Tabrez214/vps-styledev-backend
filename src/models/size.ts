import mongoose, { Schema, Document } from "mongoose";

export interface ISize extends Document {
  XS: number;
  S: number;
  M: number;
  L: number;
  XL: number;
  "2XL": number;
  "3XL": number;
}

const SizeSchema = new Schema<ISize>({
  XS: { type: Number, default: 0 },
  S: { type: Number, default: 0 },
  M: { type: Number, default: 0 },
  L: { type: Number, default: 0 },
  XL: { type: Number, default: 0 },
  "2XL": { type: Number, default: 0 },
  "3XL": { type: Number, default: 0 },
});

const Size = mongoose.model<ISize>("Size", SizeSchema);

export default Size;
