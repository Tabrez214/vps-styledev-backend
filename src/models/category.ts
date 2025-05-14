import mongoose, { Document, Schema } from "mongoose";

interface ICategory extends Document {
  name: string;
  featured: boolean;
  parent?: mongoose.Schema.Types.ObjectId;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;
  imageAlt?: string;
}

const CategorySchema = new Schema<ICategory> (
  {
    name: { type: String, required: true, unique: true},
    featured: { type: Boolean, default: false},
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null},
    description: { 
      type: String,
      set: (val: string) => {
        // Sanitize HTML content
        return val?.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    },
    metaTitle: { type: String },
    metaDescription: { type: String },
    imageUrl: { type: String },
    imageAlt: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<ICategory>("Category", CategorySchema)