
import mongoose, { Schema, Document } from 'mongoose';

export interface IShirtStyle extends Document {
  name: string;
  price: number;
  images: { front: string; back: string; left: string; right: string };
  colors: { name: string; value: string }[];
}

const ShirtStyleSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  images: {
    front: { type: String, required: true },
    back: { type: String, required: true },
    left: { type: String, required: true },
    right: { type: String, required: true }
  },
  colors: [{ name: String, value: String }],
});

export default mongoose.model<IShirtStyle>('ShirtStyle', ShirtStyleSchema);
