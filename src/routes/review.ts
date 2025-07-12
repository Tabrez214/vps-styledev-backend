import express, { Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import Review from "../models/review";
import Product from "../models/product";
import Order from "../models/order";
import { CreateReviewSchema, ReviewQuerySchema } from "../schemas/review";
import mongoose from "mongoose";

const router = express.Router();

// Helper function to update product rating
async function updateProductRating(productId: string) {
  try {
    const reviews = await Review.find({ productId });

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        totalReviews: 0
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      rating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
}

// Helper function to check if user purchased product
async function checkUserPurchase(userId: string, productId: string): Promise<boolean> {
  try {
    const order = await Order.findOne({
      user: userId,
      'items.productId': productId,
      status: 'completed'
    });
    return !!order;
  } catch (error) {
    return false;
  }
}

// GET /api/products/:id/reviews - Get reviews for a product
router.get("/products/:id/reviews", async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Validate query parameters
    const queryValidation = ReviewQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({ 
        error: 'Invalid query parameters',
        details: queryValidation.error.errors
      });
      return;
    }

    const { sortBy, rating, verified, page, limit } = queryValidation.data;

    // Build filter
    const filter: any = { productId };
    if (rating) filter.rating = rating;
    if (verified !== undefined) filter.verified = verified;

    // Build sort
    let sort: any = {};
    switch (sortBy) {
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'highest':
        sort = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sort = { rating: 1, createdAt: -1 };
        break;
      case 'helpful':
        sort = { helpful: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
        break;
    }

    const skip = (page - 1) * limit;
    const reviews = await Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username');

    const total = await Review.countDocuments(filter);

    res.json({
      reviews,
      pagination: { 
        page, 
        limit, 
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/products/:id/reviews - Create new review
router.post("/products/:id/reviews", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId,
      userId
    });

    if (existingReview) {
      res.status(400).json({ error: 'You have already reviewed this product' });
      return;
    }

    // Validate request body
    const validation = CreateReviewSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Invalid review data',
        details: validation.error.errors
      });
      return;
    }

    const { rating, title, comment, images } = validation.data;

    // Check if user purchased this product
    const hasPurchased = await checkUserPurchase(userId, productId);

    // Get user info from request (should be populated by auth middleware)
    const User = require('../models/user').default;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const review = new Review({
      productId,
      userId,
      userName: user.username || user.name,
      userEmail: user.email,
      rating,
      title,
      comment,
      verified: hasPurchased,
      images: images || []
    });

    await review.save();

    // Update product rating
    await updateProductRating(productId);

    res.status(201).json({ 
      message: 'Review created successfully', 
      review 
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// GET /api/products/:id/reviews/stats - Get review statistics
router.get("/products/:id/reviews/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const reviews = await Review.find({ productId });

    if (reviews.length === 0) {
      res.json({
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
      return;
    }

    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    res.json({
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/products/:id/reviews/user - Check if user has reviewed product
router.get("/products/:id/reviews/user", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const review = await Review.findOne({
      productId,
      userId
    });

    res.json({
      hasReviewed: !!review,
      review: review || null
    });
  } catch (error) {
    console.error('Error checking user review:', error);
    res.status(500).json({ error: 'Failed to check user review' });
  }
});

// POST /api/reviews/:id/helpful - Vote review as helpful
router.post("/reviews/:id/helpful", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    const hasVoted = review.helpfulVotes.some(id => id.toString() === userId);

    if (hasVoted) {
      // Remove vote
      review.helpfulVotes = review.helpfulVotes.filter(
        id => id.toString() !== userId
      );
      review.helpful = Math.max(0, review.helpful - 1);
    } else {
      // Add vote
      review.helpfulVotes.push(new mongoose.Types.ObjectId(userId));
      review.helpful += 1;
    }

    await review.save();

    res.json({
      message: hasVoted ? 'Vote removed' : 'Vote added',
      helpful: review.helpful,
      hasVoted: !hasVoted
    });
  } catch (error) {
    console.error('Error voting on review:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

export default router;