import express from "express";
import Product from "../models/product";
import Category from "../models/category";

const router = express.Router();

// ✅ SEARCH PRODUCTS
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

export default router;