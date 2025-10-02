import mongoose, { Document, Schema } from "mongoose";
import { STANDARD_SIZES, StandardSize } from "../types/standardTypes";

interface ICartItem {
  product: mongoose.Schema.Types.ObjectId;
  productName: string;         // Add for quick access without population
  size: StandardSize;
  quantity: number;
  pricePerItem: number;        // Standardized field name
  totalPrice: number;
  color: string;
  imageUrl?: string;           // Add for frontend consistency
}

interface ICart extends Document {
  user: mongoose.Schema.Types.ObjectId;
  products: ICartItem[];
  totalAmount: number;
  createdAt: Date;
}

const CartSchema = new mongoose.Schema<ICart>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productName: { type: String, required: true }, // Add for quick access
        size: { type: String, required: true, enum: STANDARD_SIZES },
        quantity: { type: Number, required: true, min: 1 },
        pricePerItem: { type: Number, required: true }, // Standardized field name
        totalPrice: { type: Number, required: true },
        color: { type: String, required: true },
        imageUrl: { type: String }, // Add for frontend consistency
      },
    ],
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Cart || mongoose.model<ICart>("Cart", CartSchema);
