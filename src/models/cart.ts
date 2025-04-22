import mongoose, { Document, Schema } from "mongoose";

interface ICart extends Document {
  user: mongoose.Schema.Types.ObjectId;
  products: {
    product: mongoose.Schema.Types.ObjectId;
    size: string;
    quantity: number;
    pricePerItem: number;
    totalPrice: number;
    color: string; // Add color field for clarity
  }[];
  totalAmount: number;
  createdAt: Date;
}

const CartSchema = new mongoose.Schema<ICart>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        size: { type: String, required: true, enum: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] },
        quantity: { type: Number, required: true, min: 1 },
        pricePerItem: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        color: { type: String, required: true }, // Store color
      },
    ],
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ICart>("Cart", CartSchema);
