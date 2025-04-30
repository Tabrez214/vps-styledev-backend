import mongoose, { Document, Schema } from "mongoose";
import Color from "./color";

interface IProduct extends Document {
  name: string;
  description: string;
  pricePerItem: number;
  minimumOrderQuantity: number;
  sizes: { size: string; stock: number }[];
  colors: { name: string; hexCode: string }[];
  images: { url: string; caption?: string; isDefault?: boolean }[];
  categories: mongoose.Schema.Types.ObjectId[];
  isActive: boolean; // New field for status
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { 
      type: String, 
      required: true,
      set: (val: string) => {
        // Sanitize HTML content
        return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    },
    pricePerItem: { type: Number, required: true },
    minimumOrderQuantity: { type: Number, required: true },
    sizes: [
      {
        size: {
          type: String,
          enum: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
          required: true,
        },
        stock: { type: Number, default: 0 },
      },
    ],
    colors: [{ type: Color.schema, required: true }],
    images: [
      {
        url: { type: String, required: true },
        caption: { type: String },
        isDefault: { type: Boolean, default: false },
      },
    ],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }],
    isActive: { type: Boolean, default: true }, // Default is active
  },
  { timestamps: true }
);

const Product = mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
