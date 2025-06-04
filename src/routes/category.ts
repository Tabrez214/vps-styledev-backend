import express from 'express';
import mongoose from 'mongoose';
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import Category from '../models/category';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import slugify from 'slugify';

const router = express.Router();

// --- Fixed Multer Setup ---
const uploadsDir = path.join(process.cwd(), 'uploads'); // Use process.cwd() instead of __dirname
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
  limits: { fileSize: 5 * 1024 * 1024 }
});

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

// ✅ PUBLIC: Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
      .select('name slug parent featured imageUrl imageAlt ancestors createdAt updatedAt')
      .populate('parent', 'name slug'); 
    res.status(200).json(categories);
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get a single category by ID
router.get("/id/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ message: "Invalid category ID format" });
        return;
    }
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name slug')
      .populate('ancestors._id', 'name slug');
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

// ✅ PUBLIC: Get category by simple slug (SWAG.com style)
router.get("/:slug", async (req, res) => {
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

    res.status(200).json({ 
      category,
      breadcrumbs: category.ancestors || [],
      categoryId: category._id
    });
  } catch (error) {
    console.error("❌ Error fetching category by slug:", error);
    res.status(500).json({ message: "Failed to fetch category", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get categories with filtering
router.get("/filter/search", async (req, res) => {
  try {
    const { parent, featured, search, limit = 50, page = 1 } = req.query;
    
    const query: any = {};
    
    if (parent) {
      if (parent === 'null' || parent === 'root') {
        query.parent = null;
      } else if (mongoose.Types.ObjectId.isValid(parent as string)) {
        query.parent = parent;
      }
    }
    
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const categories = await Category.find(query)
      .populate('parent', 'name slug')
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .sort({ name: 1 });

    const total = await Category.countDocuments(query);

    res.status(200).json({
      categories,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error("❌ Error filtering categories:", error);
    res.status(500).json({ message: "Failed to filter categories", error: (error as Error).message });
  }
});

// ✅ ADMIN: Create a new category
router.post("/", authMiddleware, authorizeRoles("admin"), upload.single('image'), async (req: RequestWithUser, res): Promise<void> => {
  try {
    console.log("🔥 Incoming request to create category");
    console.log("🔹 req.body:", req.body);
    console.log("🔹 req.file:", req.file);

    // Check file validation error
    if ((req as any).fileValidationError) {
      console.log("❌ File validation error:", (req as any).fileValidationError);
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting invalid file:", err);
        }
      }
      res.status(400).json({ message: (req as any).fileValidationError });
      return;
    }

    const { name, slug, parent, featured, description, metaTitle, metaDescription, imageAlt } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
      res.status(400).json({ message: "Category name is required." });
      return;
    }

    // Generate or validate slug
    let finalSlug: string;
    if (slug && slug.trim()) {
      const slugExists = await Category.findOne({ slug: slug.trim() });
      if (slugExists) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
        res.status(409).json({ message: "A category with this slug already exists." });
        return;
      }
      finalSlug = slug.trim();
    } else {
      finalSlug = await generateUniqueSlug(name.trim());
    }

    // Validate parent category
    let parentId = null;
    if (parent && parent !== 'null' && parent !== '') {
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
        res.status(400).json({ message: "Invalid parent category ID format." });
        return;
      }
      const existingParent = await Category.findById(parent);
      if (!existingParent) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
        res.status(400).json({ message: "Parent category not found." });
        return;
      }
      parentId = existingParent._id;
    }

    // Create new category
    const newCategory = new Category({
      name: name.trim(),
      slug: finalSlug,
      parent: parentId,
      featured: featured === 'true' || featured === true,
      description: description || '',
      metaTitle: metaTitle || '',
      metaDescription: metaDescription || '',
      imageAlt: imageAlt || '',
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
    });

    const savedCategory = await newCategory.save();
    
    // Update ancestors after saving
    if (parentId) {
      await savedCategory.updateAncestors();
    }

    console.log("✅ Category saved:", savedCategory);
    res.status(201).json({ 
      message: "Category created successfully", 
      category: savedCategory 
    });

  } catch (error: any) {
    console.error("❌ Category creation error:", error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting file on error:", err);
      }
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      res.status(409).json({ 
        message: `Category ${field} '${error.keyValue[field]}' already exists.` 
      });
      return;
    }
    
    res.status(400).json({ 
      message: "Category creation failed", 
      error: error.message 
    });
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
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting invalid file:", err);
        }
      }
      res.status(400).json({ message: (req as any).fileValidationError });
      return;
    }

    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const { name, slug, parent, featured, description, metaTitle, metaDescription, imageAlt } = req.body;

    if (name !== undefined && (!name || !name.trim())) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
      res.status(400).json({ message: "Category name cannot be empty." });
      return;
    }

    // Handle slug update
    if (slug !== undefined) {
      if (!slug.trim()) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }
        res.status(400).json({ message: "Slug cannot be empty." });
        return;
      }
      
      if (slug.trim() !== existingCategory.slug) {
        const slugExists = await Category.findOne({ 
          slug: slug.trim(), 
          _id: { $ne: categoryId } 
        });
        if (slugExists) {
          if (req.file) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error("Error deleting file:", err);
            }
          }
          res.status(409).json({ message: "A category with this slug already exists." });
          return;
        }
        existingCategory.slug = slug.trim();
      }
    }

    // Handle parent update
    let parentId = existingCategory.parent;
    if (parent !== undefined) {
      if (parent === 'null' || parent === '') {
        parentId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(parent)) {
          if (req.file) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error("Error deleting file:", err);
            }
          }
          res.status(400).json({ message: "Invalid parent category ID format." });
          return;
        }
        if (parent === categoryId) {
          if (req.file) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error("Error deleting file:", err);
            }
          }
          res.status(400).json({ message: "Category cannot be its own parent." });
          return;
        }
        const existingParent = await Category.findById(parent);
        if (!existingParent) {
          if (req.file) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error("Error deleting file:", err);
            }
          }
          res.status(400).json({ message: "Parent category not found." });
          return;
        }
        parentId = existingParent._id;
      }
    }

    // Update fields
    if (name !== undefined) existingCategory.name = name.trim();
    if (parent !== undefined) existingCategory.parent = parentId;
    if (featured !== undefined) existingCategory.featured = featured === 'true' || featured === true;
    if (description !== undefined) existingCategory.description = description;
    if (metaTitle !== undefined) existingCategory.metaTitle = metaTitle;
    if (metaDescription !== undefined) existingCategory.metaDescription = metaDescription;
    if (imageAlt !== undefined) existingCategory.imageAlt = imageAlt;

    // Handle image update
    if (req.file) {
      // Delete old image if it exists and is not a default/external image
      if (existingCategory.imageUrl && 
          !existingCategory.imageUrl.includes('default') && 
          !existingCategory.imageUrl.startsWith('http')) {
        const oldImagePath = path.join(process.cwd(), existingCategory.imageUrl.replace(/^\//, ''));
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error("Error deleting old image:", err);
          }
        }
      }
      existingCategory.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updatedCategory = await existingCategory.save();
    
    // Update ancestors if parent changed
    if (parent !== undefined) {
      await updatedCategory.updateAncestors();
    }

    console.log("✅ Category updated:", updatedCategory);
    res.status(200).json({ 
      message: "Category updated successfully", 
      category: updatedCategory 
    });

  } catch (error: any) {
    console.error("❌ Category update error:", error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting file on error:", err);
      }
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      res.status(409).json({ 
        message: `Category ${field} '${error.keyValue[field]}' already exists.` 
      });
      return;
    }

    res.status(400).json({ 
      message: "Category update failed", 
      error: error.message 
    });
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

    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Check for child categories
    const childCount = await Category.countDocuments({ parent: categoryId });
    if (childCount > 0) {
      res.status(400).json({ 
        message: `Cannot delete category. It has ${childCount} child categor${childCount > 1 ? 'ies' : 'y'}. Please reassign or delete them first.` 
      });
      return;
    }

    await Category.findByIdAndDelete(categoryId);

    // Delete associated image file
    if (existingCategory.imageUrl && !existingCategory.imageUrl.startsWith('http')) {
      const imagePath = path.join(process.cwd(), existingCategory.imageUrl.replace(/^\//, ''));
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (err) {
          console.error("Error deleting category image:", err);
        }
      }
    }

    console.log(`✅ Category deleted: ${categoryId}`);
    res.status(200).json({ message: "Category deleted successfully" });

  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ 
      message: "Failed to delete category", 
      error: (error as Error).message 
    });
  }
});

export default router;