
import mongoose, { Schema, Document } from 'mongoose';

export interface IClipart extends Document {
  name: string;
  svg: string;
  category: string;
}

const ClipartSchema: Schema = new Schema({
  name: { type: String, required: true },
  svg: { type: String, required: true },
  category: { type: String, required: true },
});

export default mongoose.model<IClipart>('Clipart', ClipartSchema);
