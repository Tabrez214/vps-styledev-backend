import mongoose, { Document, Schema } from "mongoose";
import slugify from 'slugify'; // Import slugify

interface ICategory extends Document {
  name: string;
  slug: string; // Added slug field
  featured: boolean;
  parent?: mongoose.Schema.Types.ObjectId | ICategory | null; // Allow population
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;
  imageAlt?: string;
  // Added for slug path generation
  ancestors?: { _id: mongoose.Schema.Types.ObjectId; name: string; slug: string }[];
  createdAt: Date;
  updatedAt: Date;
  updateAncestors(): Promise<void>; // Method signature
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true, index: true }, // Added slug field, unique and indexed
    featured: { type: Boolean, default: false },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // Store ancestor path for easier slug lookup
    ancestors: [{
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      name: String,
      slug: String
    }],
    description: {
      type: String,
      set: (val: string) => {
        // Basic sanitization (consider a more robust library like DOMPurify if needed)
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

// Middleware to generate slug before saving
CategorySchema.pre<ICategory>('save', async function(next) {
  if (this.isModified('name') && !this.slug) {
    // Only auto-generate slug if it's not already set
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug uniqueness
    const CategoryModel = this.constructor as mongoose.Model<ICategory>;
    while (await CategoryModel.findOne({ slug: slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    this.slug = slug;
  }
  next();
});

// Middleware to update ancestors path after saving
CategorySchema.post<ICategory>('save', async function(doc, next) {
  if (doc.isModified('parent') || doc.isNew) {
    await doc.updateAncestors();
  }
  next();
});

// Method to rebuild the ancestors array
CategorySchema.methods.updateAncestors = async function() {
  if (!this.parent) {
    this.ancestors = [];
  } else {
    const parentCategory = await mongoose.model<ICategory>('Category')
      .findById(this.parent)
      .select('name slug ancestors')
      .exec();
      
    if (parentCategory) {
      this.ancestors = parentCategory.ancestors ? [
        ...parentCategory.ancestors,
        { _id: parentCategory._id, name: parentCategory.name, slug: parentCategory.slug }
      ] : [
        { _id: parentCategory._id, name: parentCategory.name, slug: parentCategory.slug }
      ];
    } else {
      // Handle case where parent might not be found (though validation should prevent this)
      this.ancestors = [];
      this.parent = null; // Clear invalid parent reference
    }
  }
  
  // Save the document without triggering pre-save hooks again for slug
  await mongoose.model<ICategory>('Category').updateOne(
    { _id: this._id }, 
    { $set: { ancestors: this.ancestors, parent: this.parent } }
  );
};

export default mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);