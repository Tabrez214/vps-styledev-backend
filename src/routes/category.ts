import express from 'express';
import mongoose from 'mongoose'; // Import mongoose
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import Category from '../models/category'; // Assuming this path points to the updated model
// Remove CategorySchema import if validation is handled by Mongoose or within routes
// import { CategorySchema } from '../schemas/category'; 
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import slugify from 'slugify'; // Add slugify import

const router = express.Router();

// --- Multer Setup (Keep as is) ---
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `category-${Date.now()}${path.extname(file.originalname)}`)
});
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    (req as any).fileValidationError = 'Only image files are allowed!';
    cb(null, false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
// --- End Multer Setup ---

// Helper function to generate unique slug
const generateUniqueSlug = async (name: string, excludeId?: string): Promise<string> => {
  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;
  
  const query: any = { slug: slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  while (await Category.findOne(query)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    query.slug = slug;
  }
  
  return slug;
};

// ✅ PUBLIC: Get all categories (including slugs and ancestors for linking)
router.get("/", async (req, res) => {
  try {
    // Populate parent to potentially build links on the frontend if needed
    // Select necessary fields including slug and ancestors
    const categories = await Category.find().select('name slug parent featured imageUrl imageAlt ancestors createdAt updatedAt').populate('parent', 'name slug'); 
    res.status(200).json(categories);
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get a single category by ID (including slug)
router.get("/id/:id", async (req, res) => { // Changed path slightly to avoid conflict with slug lookup
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ message: "Invalid category ID format" });
        return;
    }
    const category = await Category.findById(req.params.id).populate('parent', 'name slug').populate('ancestors._id', 'name slug');
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.status(200).json(category);
  } catch (error) {
    console.error("❌ Error fetching category by ID:", error);
    res.status(500).json({ message: "Failed to fetch category", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get a single category by SLUG PATH
router.get("/by-slug/*", async (req, res) => {
  try {
    const slugPath = (req.params as { [key: string]: string })['0'];
        if (!slugPath) {
        res.status(400).json({ message: "Slug path is required" });
        return;
    }
    const slugs = slugPath.split('/').filter(s => s); // Split and remove empty strings
    if (slugs.length === 0) {
        res.status(400).json({ message: "Invalid slug path" });
        return;
    }

    const finalSlug = slugs[slugs.length - 1];
    const ancestorSlugs = slugs.slice(0, -1);

    // Build the query based on the final slug and ancestor slugs
    const query: any = { slug: finalSlug };
    if (ancestorSlugs.length > 0) {
        query['ancestors.slug'] = { $all: ancestorSlugs };
        // Ensure the number of ancestors matches exactly to avoid partial matches on deeper paths
        query['ancestors'] = { $size: ancestorSlugs.length }; 
    } else {
        // If no ancestor slugs, it must be a top-level category (no ancestors)
        query['ancestors'] = { $size: 0 };
    }

    console.log(`🔍 Querying category with slug: ${finalSlug} and ancestors: ${ancestorSlugs.join(', ')}`);
    console.log("🔧 Mongoose Query:", JSON.stringify(query));

    // Find the category matching the final slug and the exact ancestor path
    const category = await Category.findOne(query)
                                   .populate('parent', 'name slug')
                                   .populate('ancestors._id', 'name slug'); // Populate details if needed

    if (!category) {
      console.log(`❌ Category not found for slug path: ${slugPath}`);
      res.status(404).json({ message: "Category not found for the specified path" });
      return;
    }

    // TODO: Fetch associated products for this category
    // const products = await Product.find({ category: category._id });

    console.log(`✅ Category found: ${category.name}`);
    res.status(200).json({ category /*, products */ }); // Send category (and products later)

  } catch (error) {
    console.error("❌ Error fetching category by slug path:", error);
    res.status(500).json({ message: "Failed to fetch category by slug", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get a single category by simple slug (for direct slug access)
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(400).json({ message: "Slug is required" });
      return;
    }

    const category = await Category.findOne({ slug })
                                   .populate('parent', 'name slug')
                                   .populate('ancestors._id', 'name slug');

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.status(200).json(category);
  } catch (error) {
    console.error("❌ Error fetching category by slug:", error);
    res.status(500).json({ message: "Failed to fetch category", error: (error as Error).message });
  }
});

// ✅ ADMIN: Create a new category
router.post("/", authMiddleware, authorizeRoles("admin"), upload.single('image'), async (req: RequestWithUser, res): Promise<void> => {
  try {
    console.log("🔥 Incoming request to create category");
    console.log("🔹 req.body:", req.body);
    console.log("🔹 req.file:", req.file);

    if ((req as any).fileValidationError) {
      console.log("❌ File validation error:", (req as any).fileValidationError);
      if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file on validation error
      res.status(400).json({ message: (req as any).fileValidationError });
      return;
    }

    // Basic validation (consider using Zod or Joi for more robust validation)
    const { name, slug, parent, featured, description, metaTitle, metaDescription, imageAlt } = req.body;
    if (!name) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ message: "Category name is required." });
        return;
    }

    // Generate or validate slug
    let finalSlug: string;
    if (slug && slug.trim()) {
      // Custom slug provided - validate it's unique
      const slugExists = await Category.findOne({ slug: slug.trim() });
      if (slugExists) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(409).json({ message: "A category with this slug already exists." });
        return;
      }
      finalSlug = slug.trim();
    } else {
      // Generate slug from name
      finalSlug = await generateUniqueSlug(name);
    }

    let parentId = null;
    if (parent && parent !== 'null' && parent !== '') {
        if (!mongoose.Types.ObjectId.isValid(parent)) {
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(400).json({ message: "Invalid parent category ID format." });
            return;
        }
        const existingParent = await Category.findById(parent);
        if (!existingParent) {
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(400).json({ message: "Parent category not found." });
            return;
        }
        parentId = existingParent._id;
    }

    const newCategory = new Category({
      name,
      slug: finalSlug,
      parent: parentId,
      featured: featured === 'true',
      description: description || '',
      metaTitle: metaTitle || '',
      metaDescription: metaDescription || '',
      imageAlt: imageAlt || '',
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      // Ancestors will be handled by Mongoose middleware
    });

    await newCategory.save(); // This triggers pre-save (slug) and post-save (ancestors)
    console.log("✅ Category saved:", newCategory);
    res.status(201).json({ message: "Category created successfully", category: newCategory });

  } catch (error: any) {
    console.error("❌ Category creation error:", error);
    if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file on error
    
    // Handle potential duplicate key errors (name or slug)
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        res.status(409).json({ message: `Category ${field} '${error.keyValue[field]}' already exists.` });
        return;
    }
    
    res.status(400).json({ message: "Category creation failed", error: error.message });
  }
});

// ✅ ADMIN: Update a category
router.put("/:id", authMiddleware, authorizeRoles("admin"), upload.single('image'), async (req, res) => {
  try {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ message: "Invalid category ID format" });
        return;
    }

    if ((req as any).fileValidationError) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(400).json({ message: (req as any).fileValidationError });
      return;
    }

    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const { name, slug, parent, featured, description, metaTitle, metaDescription, imageAlt } = req.body;

    // Basic validation
    if (name !== undefined && !name) { // Allow empty string update? No, name is required.
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ message: "Category name cannot be empty." });
        return;
    }

    // Handle slug update
    if (slug !== undefined) {
      if (!slug.trim()) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ message: "Slug cannot be empty." });
        return;
      }
      
      // Check if slug is changing and if new slug is unique
      if (slug.trim() !== existingCategory.slug) {
        const slugExists = await Category.findOne({ slug: slug.trim(), _id: { $ne: categoryId } });
        if (slugExists) {
          if (req.file) fs.unlinkSync(req.file.path);
          res.status(409).json({ message: "A category with this slug already exists." });
          return;
        }
        existingCategory.slug = slug.trim();
      }
    }

    let parentId = existingCategory.parent; // Keep existing parent by default
    if (parent !== undefined) { // Check if parent is being updated
        if (parent === 'null' || parent === '') {
            parentId = null;
        } else {
            if (!mongoose.Types.ObjectId.isValid(parent)) {
                if (req.file) fs.unlinkSync(req.file.path);
                res.status(400).json({ message: "Invalid parent category ID format." });
                return;
            }
            if (parent === categoryId) {
                if (req.file) fs.unlinkSync(req.file.path);
                res.status(400).json({ message: "Category cannot be its own parent." });
                return;
            }
            const existingParent = await Category.findById(parent);
            if (!existingParent) {
                if (req.file) fs.unlinkSync(req.file.path);
                res.status(400).json({ message: "Parent category not found." });
                return;
            }
            parentId = existingParent._id;
        }
    }

    // Update fields - only update if provided in request body
    if (name !== undefined) existingCategory.name = name;
    if (parent !== undefined) existingCategory.parent = parentId;
    if (featured !== undefined) existingCategory.featured = featured === 'true';
    if (description !== undefined) existingCategory.description = description;
    if (metaTitle !== undefined) existingCategory.metaTitle = metaTitle;
    if (metaDescription !== undefined) existingCategory.metaDescription = metaDescription;
    if (imageAlt !== undefined) existingCategory.imageAlt = imageAlt;

    // Handle image update
    if (req.file) {
      // Delete old image if it exists and is not a default/placeholder
      if (existingCategory.imageUrl && !existingCategory.imageUrl.includes('default') && !existingCategory.imageUrl.startsWith('http')) {
        const oldImagePath = path.join(__dirname, '..', existingCategory.imageUrl);
        if (fs.existsSync(oldImagePath)) {
            try { fs.unlinkSync(oldImagePath); } catch (err) { console.error("Error deleting old image:", err); }
        }
      }
      existingCategory.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Save will trigger middleware to update ancestors if needed
    const updatedCategory = await existingCategory.save();

    console.log("✅ Category updated:", updatedCategory);
    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });

  } catch (error: any) {
    console.error("❌ Category update error:", error);
    if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file on error

    // Handle potential duplicate key errors (name or slug)
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        res.status(409).json({ message: `Category ${field} '${error.keyValue[field]}' already exists.` });
        return;
    }

    res.status(400).json({ message: "Category update failed", error: error.message });
  }
});

// ✅ ADMIN: Delete a category
router.delete("/:id", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ message: "Invalid category ID format" });
        return;
    }

    // Check if category exists
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Check for child categories
    const childCount = await Category.countDocuments({ parent: categoryId });
    if (childCount > 0) {
      res.status(400).json({ message: `Cannot delete category. It has ${childCount} child categor${childCount > 1 ? 'ies' : 'y'}. Please reassign or delete them first.` });
      return;
    }

    // TODO: Check for associated products
    // const productCount = await Product.countDocuments({ category: categoryId });
    // if (productCount > 0) {
    //   return res.status(400).json({ message: `Cannot delete category. It has ${productCount} associated product(s). Please reassign them first.` });
    // }

    // Delete the category
    await Category.findByIdAndDelete(categoryId);

    // Delete associated image file
    if (existingCategory.imageUrl && !existingCategory.imageUrl.startsWith('http')) {
      const imagePath = path.join(__dirname, '..', existingCategory.imageUrl);
      if (fs.existsSync(imagePath)) {
          try { fs.unlinkSync(imagePath); } catch (err) { console.error("Error deleting category image:", err); }
      }
    }

    console.log(`✅ Category deleted: ${categoryId}`);
    res.status(200).json({ message: "Category deleted successfully" });

  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ message: "Failed to delete category", error: (error as Error).message });
  }
});

export default router;