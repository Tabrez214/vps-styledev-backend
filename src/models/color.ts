import mongoose, { Schema, Document } from "mongoose";

export interface IColor extends Document {
  name: string;
  hexCode: string;
}

const ColorSchema = new Schema<IColor>({
  name: { type: String, required: true },
  hexCode: { type: String, required: true },
});

const Color = mongoose.model<IColor>("Color", ColorSchema);

export default Color;
