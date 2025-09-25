import mongoose, { Document, Schema } from "mongoose";

interface IAddress extends Document {
  user: mongoose.Schema.Types.ObjectId;
  fullName: string;
  phoneNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  gstNumber?: string;
  isDefault: boolean;
  createdAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    gstNumber: { 
      type: String, 
      trim: true, 
      default: '',
      uppercase: true // Auto-convert to uppercase for GST format (e.g., 27AABCU9603R1ZX)
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Address || mongoose.model<IAddress>("Address", AddressSchema);
