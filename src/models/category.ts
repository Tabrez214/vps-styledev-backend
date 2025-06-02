import mongoose, { Document, Schema } from "mongoose";
import slugify from 'slugify';

interface ICategory extends Document {
  name: string;
  slug?: string; // Made optional
  featured: boolean;
  parent?: mongoose.Schema.Types.ObjectId | ICategory | null;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;
  imageAlt?: string;
  ancestors?: { _id: mongoose.Schema.Types.ObjectId; name: string; slug: string }[];
  createdAt: Date;
  updatedAt: Date;
  getSlug(): string; // Virtual method to get slug
  updateAncestors(): Promise<void>;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    slug: { 
      type: String, 
      sparse: true, // Allows null/undefined values, only enforces uniqueness on non-null values
      index: true 
    },
    featured: { type: Boolean, default: false },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    ancestors: [{
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      name: String,
      slug: String
    }],
    description: {
      type: String,
      set: (val: string) => {
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

// Virtual method to get slug (stored or generated)
CategorySchema.methods.getSlug = function(): string {
  return this.slug || slugify(this.name, { lower: true, strict: true });
};

// Add virtual field for easy access
CategorySchema.virtual('effectiveSlug').get(function() {
  return this.getSlug();
});

// Middleware to handle slug generation only when explicitly set
CategorySchema.pre<ICategory>('save', async function(next) {
  // Only process slug if it's being explicitly set
  if (this.isModified('slug') && this.slug) {
    // Ensure custom slug uniqueness
    const CategoryModel = this.constructor as mongoose.Model<ICategory>;
    const existingWithSlug = await CategoryModel.findOne({ 
      slug: this.slug, 
      _id: { $ne: this._id } 
    });
    
    if (existingWithSlug) {
      throw new Error(`Slug '${this.slug}' already exists`);
    }
  }
  next();
});

// Update ancestors to use effective slugs
CategorySchema.methods.updateAncestors = async function() {
  if (!this.parent) {
    this.ancestors = [];
  } else {
    const parentCategory = await mongoose.model<ICategory>('Category')
      .findById(this.parent)
      .select('name slug ancestors')
      .exec();
      
    if (parentCategory) {
      const parentSlug = parentCategory.getSlug();
      this.ancestors = parentCategory.ancestors ? [
        ...parentCategory.ancestors,
        { _id: parentCategory._id, name: parentCategory.name, slug: parentSlug }
      ] : [
        { _id: parentCategory._id, name: parentCategory.name, slug: parentSlug }
      ];
    } else {
      this.ancestors = [];
      this.parent = null;
    }
  }
  
  await mongoose.model<ICategory>('Category').updateOne(
    { _id: this._id }, 
    { $set: { ancestors: this.ancestors, parent: this.parent } }
  );
};

export default mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);