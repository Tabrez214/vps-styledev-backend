import mongoose, { Document, Schema } from "mongoose";
import Color from "./color";

interface IBulkPricing {
  quantity: number;
  pricePerItem: number;
}

interface IProduct extends Document {
  name: string;
  shortDescription: string;
  description: string;
  pricePerItem: number;
  minimumOrderQuantity: number;
  stock: number;
  sizes: { size: string; stock: number }[];
  colors: { name: string; hexCode: string; images?: { url: string; caption?: string; isDefault?: boolean; imageAlt?: string }[] }[];
  images: { url: string; caption?: string; isDefault?: boolean; imageAlt?: string }[];
  categories: mongoose.Schema.Types.ObjectId[];
  isActive: boolean;
  bulkPricing: IBulkPricing[];
  rushOrderAvailable: boolean;
  superRushAvailable: boolean;
  rushOrderDays: number;
  superRushOrderDays: number;
  metaTitle?: string;
  metaDescription?: string;
  rating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const BulkPricingSchema = new Schema<IBulkPricing>({
  quantity: { type: Number, required: true },
  pricePerItem: { type: Number, required: true },
});

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    shortDescription: { 
      type: String, 
      required: true,
      maxlength: 300,
      set: (val: string) => {
        // Sanitize HTML content
        return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    },
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
    stock: { type: Number, required: true, default: 0 },
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
        imageAlt: { type: String },
      },
    ],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }],
    isActive: { type: Boolean, default: true },
    bulkPricing: [BulkPricingSchema],
    rushOrderAvailable: { type: Boolean, default: false },
    superRushAvailable: { type: Boolean, default: false },
    rushOrderDays: { type: Number, default: 10 },
    superRushOrderDays: { type: Number, default: 3 },
    metaTitle: {
      type: String,
      maxlength: 60,
      trim: true
    },
    metaDescription: {
      type: String,
      maxlength: 160,
      trim: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0
    },
  },
  { timestamps: true }
);

const Product = mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
