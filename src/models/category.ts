import mongoose, { Document, Schema } from "mongoose";
import slugify from 'slugify';

interface ICategory extends Document {
  name: string;
  slug?: string;
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
  getSlug(): string;
  updateAncestors(): Promise<void>;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true
    },
    slug: { 
      type: String, 
      unique: true,
      sparse: true,
      index: true,
      trim: true
    },
    featured: { 
      type: Boolean, 
      default: false 
    },
    parent: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Category', 
      default: null 
    },
    ancestors: [{
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      name: String,
      slug: String
    }],
    description: {
      type: String,
      default: '',
      set: (val: string) => {
        if (!val) return '';
        // Remove script tags for security
        return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    },
    metaTitle: { 
      type: String,
      default: ''
    },
    metaDescription: { 
      type: String,
      default: ''
    },
    imageUrl: { 
      type: String,
      default: ''
    },
    imageAlt: { 
      type: String,
      default: ''
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
CategorySchema.index({ name: 1 });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parent: 1 });
CategorySchema.index({ featured: 1 });

// Virtual method to get slug (stored or generated)
CategorySchema.methods.getSlug = function(): string {
  if (this.slug) return this.slug;
  return slugify(this.name, { lower: true, strict: true });
};

// Virtual field for easy access
CategorySchema.virtual('effectiveSlug').get(function() {
  return this.getSlug();
});

// Pre-save middleware for slug handling
CategorySchema.pre<ICategory>('save', async function(next) {
  try {
    // Only auto-generate slug if it's not set and this is a new document
    if (this.isNew && !this.slug) {
      this.slug = await generateUniqueSlug(this.name);
    }
    
    // If slug is being modified, ensure it's unique
    if (this.isModified('slug') && this.slug) {
      const CategoryModel = this.constructor as mongoose.Model<ICategory>;
      const existingWithSlug = await CategoryModel.findOne({ 
        slug: this.slug, 
        _id: { $ne: this._id } 
      });
      
      if (existingWithSlug) {
        const error = new Error(`Slug '${this.slug}' already exists`);
        return next(error);
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Helper function to generate unique slug
async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const CategoryModel = mongoose.model('Category');
  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;
  
  const query: any = { slug: slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  while (await CategoryModel.findOne(query)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    query.slug = slug;
  }
  
  return slug;
}

// Method to update ancestors
CategorySchema.methods.updateAncestors = async function() {
  try {
    if (!this.parent) {
      this.ancestors = [];
    } else {
      const CategoryModel = mongoose.model<ICategory>('Category');
      const parentCategory = await CategoryModel
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
    
    // Update the document in database
    await mongoose.model<ICategory>('Category').updateOne(
      { _id: this._id }, 
      { 
        $set: { 
          ancestors: this.ancestors, 
          parent: this.parent 
        } 
      }
    );
  } catch (error) {
    console.error('Error updating ancestors:', error);
    throw error;
  }
};

// Post-save middleware to update child categories' ancestors
CategorySchema.post<ICategory>('save', async function(doc) {
  try {
    // Update all child categories' ancestors when this category is updated
    const CategoryModel = mongoose.model<ICategory>('Category');
    const children = await CategoryModel.find({ parent: doc._id });
    
    for (const child of children) {
      await child.updateAncestors();
    }
  } catch (error) {
    console.error('Error updating child ancestors:', error);
  }
});

// Ensure model is not re-compiled
export default mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);