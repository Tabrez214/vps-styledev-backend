import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorizeRoles } from "../middleware/roleMiddleware";
import Product from "../models/product";
import { ProductSchema } from "../schemas/product";
import Category from "../models/category";
import { Types } from "mongoose";

const router = express.Router();

// ✅ CREATE PRODUCT
router.post("/products", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    console.log("Received product creation request:", req.body);

    // Validate categories
    const categoryIds = await Promise.all(
      (req.body.categories || []).map(async (categoryId: string) => {
        if (!Types.ObjectId.isValid(categoryId)) {
          throw new Error(`Invalid category ID '${categoryId}'`);
        }
        const category = await Category.findById(categoryId);
        if (!category) {
          throw new Error(`Category '${categoryId}' not found.`);
        }
        return (category._id as Types.ObjectId).toString();
      })
    );

    // Validate images
    const imageUrls = (req.body.images || []).map((image: any) => ({
      url: `${process.env.BASE_URL}${image.url}`,
      caption: image.caption,
      isDefault: image.isDefault,
    }));

    // Define sizesArray
    let sizesArray;
    if (Array.isArray(req.body.sizes)) {
      // If already in array format, make sure each item has proper size/stock structure
      sizesArray = req.body.sizes.map((sizeItem: any) => {
        // Check if it has the expected properties
        if (typeof sizeItem === 'object' && sizeItem !== null) {
          // If it's the correct format (contains valid size enum and stock number)
          if (
            (sizeItem.size === 'XS' || sizeItem.size === 'S' || sizeItem.size === 'M' || 
             sizeItem.size === 'L' || sizeItem.size === 'XL' || sizeItem.size === '2XL' || 
             sizeItem.size === '3XL') && 
            typeof sizeItem.stock === 'number'
          ) {
            return sizeItem;
          }
        }
        // Handle if size is not in expected format
        return null;
      }).filter(Boolean); // Remove any null entries
    } else if (typeof req.body.sizes === 'object' && req.body.sizes !== null) {
      // If it's an object like {XS: 10, S: 5, etc.}
      sizesArray = Object.entries(req.body.sizes).map(([size, stock]) => ({
        size,
        stock: Number(stock)
      }));
    } else {
      // Default to empty array if no valid sizes
      sizesArray = [];
    }

    // Construct final product data
    const parsedData = {
      ...req.body,
      sizes: sizesArray,
      categories: categoryIds,
      images: imageUrls,
    };

    console.log("Validated product data:", parsedData);
    const validatedProduct = ProductSchema.parse(parsedData);

    const newProduct = new Product(validatedProduct);
    await newProduct.save();

    res.status(201).json({ message: "Product created successfully!", product: newProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Validation failed" });
  }
});

// ✅ GET ALL PRODUCTS
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("categories");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ✅ GET SINGLE PRODUCT
router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("categories");
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: "Invalid product ID" });
  }
});

// ✅ UPDATE PRODUCT
router.put("/products/:id", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    // Handle size data transformation before validation
    let sizesArray;
    if (Array.isArray(req.body.sizes)) {
      sizesArray = req.body.sizes.map((sizeItem: any) => {
        if (
          typeof sizeItem === 'object' && sizeItem !== null &&
          (sizeItem.size === 'XS' || sizeItem.size === 'S' || sizeItem.size === 'M' || 
           sizeItem.size === 'L' || sizeItem.size === 'XL' || sizeItem.size === '2XL' || 
           sizeItem.size === '3XL') && 
          typeof sizeItem.stock === 'number'
        ) {
          return sizeItem;
        }
        return null;
      }).filter(Boolean);
    } else if (typeof req.body.sizes === 'object' && req.body.sizes !== null) {
      sizesArray = Object.entries(req.body.sizes).map(([size, stock]) => ({
        size,
        stock: Number(stock)
      }));
    } else {
      sizesArray = [];
    }

    // Updated request body with transformed sizes
    const updatedBody = {
      ...req.body,
      sizes: sizesArray
    };

    const validatedProduct = ProductSchema.parse(updatedBody);
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, validatedProduct, { new: true });

    if (!updatedProduct) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

// ✅ DELETE PRODUCT
router.delete("/products/:id", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json({ message: "Product deleted successfully!", product: deletedProduct });
  } catch (error) {
    res.status(400).json({ message: "Invalid product ID" });
  }
});

export default router;