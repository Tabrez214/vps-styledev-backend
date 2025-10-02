import mongoose, { Document, Schema } from "mongoose";

interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
  helpful: number;
  helpfulVotes: mongoose.Types.ObjectId[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true,
      trim: true
    },
    userEmail: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000
    },
    verified: {
      type: Boolean,
      default: false
    },
    helpful: {
      type: Number,
      default: 0,
      min: 0
    },
    helpfulVotes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    images: [{
      type: String
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for performance
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, rating: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

const Review = mongoose.model<IReview>("Review", reviewSchema);
export default Review;