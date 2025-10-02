import mongoose from "mongoose";

const discountCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],
    excludedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries (unique fields already have indexes)
discountCodeSchema.index({ isActive: 1, expiryDate: 1 });
discountCodeSchema.index({ createdBy: 1 });

// Middleware to automatically uppercase discount codes
discountCodeSchema.pre("save", function (next) {
  if (this.isModified("code")) {
    this.code = this.code.toUpperCase();
  }
  next();
});

const DiscountCode = mongoose.models.DiscountCode ||
  mongoose.model("DiscountCode", discountCodeSchema);

export default DiscountCode;