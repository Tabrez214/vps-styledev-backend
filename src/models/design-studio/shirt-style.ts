
import mongoose, { Schema, Document } from 'mongoose';

export interface IShirtStyle extends Document {
  name: string;
  price: number;
  image: string;
  colors: { name: string; value: string }[];
}

const ShirtStyleSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  colors: [{ name: String, value: String }],
});

export default mongoose.model<IShirtStyle>('ShirtStyle', ShirtStyleSchema);
