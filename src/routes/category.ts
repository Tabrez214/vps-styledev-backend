import express from 'express';
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import Category from '../models/category';
import { CategorySchema } from '../schemas/category';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `category-${Date.now()}${path.extname(file.originalname)}`)
});

// File filter to accept only images
interface MulterFile extends Express.Multer.File {
  mimetype: string;
}

const fileFilter = (req: Express.Request, file: MulterFile, cb: multer.FileFilterCallback) => {
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

// ✅ PUBLIC: Get all categories (No Authentication)
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories", error: (error as Error).message });
  }
});

// ✅ PUBLIC: Get a single category by ID (No Authentication)
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.status(200).json(category);
  } catch (error) {
    console.error("❌ Error fetching category:", error);
    res.status(500).json({ message: "Failed to fetch category", error: (error as Error).message });
  }
});

// ✅ ADMIN: Create a new category
router.post("/", authMiddleware, authorizeRoles("admin"), upload.single('image'), async (req: RequestWithUser, res): Promise<void> => {
  try {
    console.log("🔥 Incoming request to create category");
    console.log("🔹 req.body:", req.body);
    console.log("🔹 req.file:", req.file);
    console.log("�� User:", req.user);

    if ((req as any).fileValidationError) {
      console.log("❌ File validation error:", (req as any).fileValidationError);
      res.status(400).json({ error: (req as any).fileValidationError });
      return;
    }

    const formData = { 
      ...req.body, 
      featured: req.body.featured === 'true',
      description: req.body.description || '', // Ensure description is always a string
      imageAlt: req.body.imageAlt || '' // Ensure imageAlt is always a string
    };
    console.log("🔹 FormData after processing:", formData);

    const validatedData = CategorySchema.parse(formData);
    console.log("✅ Validated Data:", validatedData);

    let parentCategory = null;
    if (validatedData.parent && validatedData.parent !== 'null' && validatedData.parent !== '') {
      const existingParent = await Category.findById(validatedData.parent);
      if (!existingParent) {
        console.log("❌ Parent category not found.");
        res.status(400).json({ error: "Parent category not found." });
        return;
      }
      parentCategory = existingParent._id;
    }

    const newCategory = new Category({
      ...validatedData,
      parent: parentCategory,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
    });

    await newCategory.save();
    console.log("✅ Category saved:", newCategory);
    res.status(201).json({ message: "Category created successfully", category: newCategory });
  } catch (error) {
    console.error("❌ Category creation error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ message: "Category creation failed", error: (error as Error).message });
  }
});

// ✅ ADMIN: Update a category
router.put("/:id", authMiddleware, authorizeRoles("admin"), upload.single('image'), async (req, res) => {
  try {
    if ((req as any).fileValidationError) {
      res.status(400).json({ error: (req as any).fileValidationError });
      return;
    }

    const categoryId = req.params.id;
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const formData = { 
      ...req.body, 
      featured: req.body.featured === 'true',
      description: req.body.description || '', // Ensure description is always a string
      imageAlt: req.body.imageAlt || '' // Ensure imageAlt is always a string
    };
    const validatedData = CategorySchema.parse(formData);

    let parentCategory = null;
    if (validatedData.parent && validatedData.parent !== 'null' && validatedData.parent !== '') {
      if (validatedData.parent === categoryId) {
        res.status(400).json({ error: "Category cannot be its own parent." });
        return;
      }

      const existingParent = await Category.findById(validatedData.parent);
      if (!existingParent) {
        res.status(400).json({ error: "Parent category not found." });
        return;
      }
      parentCategory = existingParent._id;
    }

    let imageUrl = existingCategory.imageUrl;
    if (req.file) {
      if (existingCategory.imageUrl && !existingCategory.imageUrl.includes('default')) {
        const oldImagePath = path.join(__dirname, '..', existingCategory.imageUrl);
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { ...validatedData, parent: parentCategory, imageUrl },
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    console.error("❌ Category update error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ message: "Category update failed", error: (error as Error).message });
  }
});

// ✅ ADMIN: Delete a category
router.delete("/:id", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    const categoryId = req.params.id;
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const childCategories = await Category.find({ parent: categoryId });
    if (childCategories.length > 0) {
      res.status(400).json({ message: "Cannot delete category with child categories." });
      return;
    }

    if (existingCategory.imageUrl) {
      const imagePath = path.join(__dirname, '..', existingCategory.imageUrl);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await Category.findByIdAndDelete(categoryId);
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ message: "Failed to delete category", error: (error as Error).message });
  }
});

export default router;
