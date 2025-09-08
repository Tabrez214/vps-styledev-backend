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
      url: image.url.startsWith('http') ? image.url : `${process.env.BASE_URL}${image.url}`,
      caption: image.caption,
      isDefault: image.isDefault,
      imageAlt: image.imageAlt,
    }));

    // Process colors with images
    const processedColors = (req.body.colors || []).map((color: any) => {
      const processedColor = {
        name: color.name,
        hexCode: color.hexCode,
        images: []
      };

      if (color.images && Array.isArray(color.images)) {
        processedColor.images = color.images.map((image: any) => ({
          url: image.url.startsWith('http') ? image.url : `${process.env.BASE_URL}${image.url}`,
          caption: image.caption || '',
          isDefault: image.isDefault || false,
          imageAlt: image.imageAlt || '',
        }));
      }

      return processedColor;
    });

    // Process bulk pricing
    const bulkPricing = (req.body.bulkPricing || []).map((pricing: any) => ({
      quantity: Number(pricing.quantity),
      pricePerItem: typeof pricing.pricePerItem === 'string' ? parseFloat(pricing.pricePerItem) : Number(pricing.pricePerItem),
    })).filter((pricing: any) => pricing.quantity > 0 && pricing.pricePerItem > 0);

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
      colors: processedColors,
      bulkPricing: bulkPricing,
      stock: Number(req.body.stock) || 0,
      rushOrderAvailable: Boolean(req.body.rushOrderAvailable),
      superRushAvailable: Boolean(req.body.superRushAvailable),
      rushOrderDays: Number(req.body.rushOrderDays) || 10,
      superRushOrderDays: Number(req.body.superRushOrderDays) || 3,
      ...(req.body.metaTitle ? { metaTitle: req.body.metaTitle.trim() } : {}),
      ...(req.body.metaDescription ? { metaDescription: req.body.metaDescription.trim() } : {}),
      ...(req.body.rating !== undefined ? { rating: parseFloat(req.body.rating) } : {}),
      ...(req.body.totalReviews !== undefined ? { totalReviews: Number(req.body.totalReviews) } : {}),
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

// ✅ SEARCH PRODUCTS - Must come before /products/:id route
router.get("/products/search", async (req, res) => {
  try {
    const {
      q: query,
      category,
      minPrice,
      maxPrice,
      sortBy = 'relevance',
      page = 1,
      limit = 12
    } = req.query;

    if (!query || (query as string).trim().length < 2) {
      res.json({
        products: [],
        total: 0,
        page: parseInt(page as string),
        totalPages: 0,
        suggestions: [],
        message: 'Search query must be at least 2 characters'
      });
      return;
    }

    // Build search conditions
    const searchConditions: any = {
      $and: [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { shortDescription: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query as string, 'i')] } }
          ]
        }
      ]
    };

    // Add category filter
    if (category && category !== 'all') {
      const categoryDoc = await Category.findOne({
        $or: [
          { name: { $regex: category, $options: 'i' } },
          { _id: category }
        ]
      });
      if (categoryDoc) {
        searchConditions.$and.push({ categories: categoryDoc._id });
      }
    }

    // Add price filters
    if (minPrice || maxPrice) {
      const priceFilter: any = {};
      if (minPrice) priceFilter.$gte = parseFloat(minPrice as string);
      if (maxPrice) priceFilter.$lte = parseFloat(maxPrice as string);
      searchConditions.$and.push({ pricePerItem: priceFilter });
    }

    // Build sort conditions
    let sortConditions: any = {};
    switch (sortBy) {
      case 'price-low':
        sortConditions = { pricePerItem: 1 };
        break;
      case 'price-high':
        sortConditions = { pricePerItem: -1 };
        break;
      case 'newest':
        sortConditions = { createdAt: -1 };
        break;
      case 'name':
        sortConditions = { name: 1 };
        break;
      default:
        // For relevance, we'll sort by a combination of factors
        sortConditions = { createdAt: -1 };
    }

    // Get total count
    const total = await Product.countDocuments(searchConditions);

    // Get products
    const products = await Product.find(searchConditions)
      .populate('categories')
      .sort(sortConditions)
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string));

    // Get search suggestions (similar products)
    const suggestions = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { categories: { $in: await Category.find({ name: { $regex: query, $options: 'i' } }).select('_id') } }
      ]
    })
      .select('name')
      .limit(5);

    // Get available categories for filters
    const availableCategories = await Category.find({}).select('name _id');

    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.json({
      products,
      total,
      page: parseInt(page as string),
      totalPages,
      suggestions: suggestions.map(s => ({ name: s.name, _id: s._id })),
      availableCategories,
      query,
      filters: {
        category,
        minPrice,
        maxPrice,
        sortBy
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
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

    // Validate images for update (if present)
    let updatedImages = undefined;
    if (Array.isArray(req.body.images)) {
      updatedImages = req.body.images.map((image: any) => ({
        url: image.url.startsWith('http') ? image.url : `${process.env.BASE_URL}${image.url}`,
        caption: image.caption,
        isDefault: image.isDefault,
        imageAlt: image.imageAlt,
      }));
    }

    // Process colors with images for update
    let updatedColors = undefined;
    if (Array.isArray(req.body.colors)) {
      updatedColors = req.body.colors.map((color: any) => {
        const processedColor = {
          name: color.name,
          hexCode: color.hexCode,
          images: []
        };

        if (color.images && Array.isArray(color.images)) {
          processedColor.images = color.images.map((image: any) => ({
            url: image.url.startsWith('http') ? image.url : `${process.env.BASE_URL}${image.url}`,
            caption: image.caption || '',
            isDefault: image.isDefault || false,
            imageAlt: image.imageAlt || '',
          }));
        }

        return processedColor;
      });
    }

    // Process bulk pricing for update
    let updatedBulkPricing = undefined;
    if (Array.isArray(req.body.bulkPricing)) {
      updatedBulkPricing = req.body.bulkPricing.map((pricing: any) => ({
        quantity: Number(pricing.quantity),
        pricePerItem: typeof pricing.pricePerItem === 'string' ? parseFloat(pricing.pricePerItem) : Number(pricing.pricePerItem),
      })).filter((pricing: any) => pricing.quantity > 0 && pricing.pricePerItem > 0);
    }

    // Updated request body with transformed data
    const updatedBody = {
      ...req.body,
      sizes: sizesArray,
      ...(updatedImages ? { images: updatedImages } : {}),
      ...(updatedColors ? { colors: updatedColors } : {}),
      ...(updatedBulkPricing ? { bulkPricing: updatedBulkPricing } : {}),
      ...(req.body.stock !== undefined ? { stock: Number(req.body.stock) } : {}),
      ...(req.body.rushOrderAvailable !== undefined ? { rushOrderAvailable: Boolean(req.body.rushOrderAvailable) } : {}),
      ...(req.body.superRushAvailable !== undefined ? { superRushAvailable: Boolean(req.body.superRushAvailable) } : {}),
      ...(req.body.rushOrderDays !== undefined ? { rushOrderDays: Number(req.body.rushOrderDays) } : {}),
      ...(req.body.superRushOrderDays !== undefined ? { superRushOrderDays: Number(req.body.superRushOrderDays) } : {}),
      ...(req.body.metaTitle !== undefined ? { metaTitle: req.body.metaTitle.trim() } : {}),
      ...(req.body.metaDescription !== undefined ? { metaDescription: req.body.metaDescription.trim() } : {}),
      ...(req.body.rating !== undefined ? { rating: parseFloat(req.body.rating) } : {}),
      ...(req.body.totalReviews !== undefined ? { totalReviews: Number(req.body.totalReviews) } : {}),
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