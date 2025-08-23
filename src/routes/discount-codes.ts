import express, { type Response } from "express";
import { authMiddleware, type RequestWithUser } from "../middleware/authMiddleware";
import { authorizeRoles } from "../middleware/roleMiddleware";
import DiscountCode from "../models/discount-codes";
import Product from "../models/product";
import mongoose from "mongoose";

const router = express.Router();

// Create a new discount code (admin only)
router.post("/", authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    console.log("📝 Creating new discount code:", {
      admin: req.user?.userId,
      codeData: { ...req.body, code: req.body.code?.toUpperCase() }
    });

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      applicableProducts,
      excludedProducts,
    } = req.body;

    // Basic validation
    if (!code || !discountType || !discountValue || !expiryDate) {
      res.status(400).json({
        message: "Missing required fields: code, discountType, discountValue, and expiryDate are required",
      });
      return;
    }

    // Check if discount code already exists
    const existingCode = await DiscountCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      res.status(400).json({ message: "Discount code already exists" });
      return;
    }

    // Validate product IDs if provided
    if (applicableProducts && applicableProducts.length > 0) {
      const validProducts = await Product.find({ _id: { $in: applicableProducts } });
      if (validProducts.length !== applicableProducts.length) {
        res.status(400).json({ message: "Some applicable product IDs are invalid" });
        return;
      }
    }

    if (excludedProducts && excludedProducts.length > 0) {
      const validExcluded = await Product.find({ _id: { $in: excludedProducts } });
      if (validExcluded.length !== excludedProducts.length) {
        res.status(400).json({ message: "Some excluded product IDs are invalid" });
        return;
      }
    }

    // Create the discount code
    const discountCode = new DiscountCode({
      code: code.toUpperCase(),
      description: description || `Discount code: ${code.toUpperCase()}`,
      discountType,
      discountValue,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount: maxDiscountAmount || null,
      startDate: startDate || new Date(),
      expiryDate,
      usageLimit: usageLimit || null,
      applicableProducts: applicableProducts || [],
      excludedProducts: excludedProducts || [],
      createdBy: req.user.userId,
      isActive: true,
    });

    await discountCode.save();
    console.log("✅ Discount code created:", discountCode.code);
    res.status(201).json({
      message: "Discount code created successfully",
      discountCode,
    });
  } catch (error) {
    console.error("❌ Error creating discount code:", error);
    res.status(500).json({
      message: "Failed to create discount code",
      error: (error as Error).message,
    });
  }
});

// Get all discount codes (admin only)
router.get("/", authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    console.log("🔍 Fetching all discount codes");
    const discountCodes = await DiscountCode.find()
      .select("-__v")
      .populate("createdBy", "name email")
      .populate("applicableProducts", "name price")
      .sort({ createdAt: -1 });

    res.status(200).json(discountCodes);
  } catch (error) {
    console.error("❌ Error fetching discount codes:", error);
    res.status(500).json({
      message: "Failed to fetch discount codes",
      error: (error as Error).message,
    });
  }
});

// Get a specific discount code (admin only)
router.get("/:id", authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    const discountCode = await DiscountCode.findById(req.params.id)
      .select("-__v")
      .populate("createdBy", "name email")
      .populate("applicableProducts", "name price");

    if (!discountCode) {
      res.status(404).json({ message: "Discount code not found" });
      return;
    }

    res.status(200).json(discountCode);
  } catch (error) {
    console.error("❌ Error fetching discount code:", error);
    res.status(500).json({
      message: "Failed to fetch discount code",
      error: (error as Error).message,
    });
  }
});

// Update a discount code (admin only)
router.put("/:id", authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    console.log("🔄 Updating discount code:", req.params.id);

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      isActive,
      applicableProducts,
      excludedProducts,
    } = req.body;

    // Check if code is being changed and if it already exists
    if (code) {
      const existingCode = await DiscountCode.findOne({
        code: code.toUpperCase(),
        _id: { $ne: req.params.id },
      });

      if (existingCode) {
        res.status(400).json({ message: "Discount code already exists" });
        return;
      }
    }

    // Update the discount code
    const updatedDiscountCode = await DiscountCode.findByIdAndUpdate(
      req.params.id,
      {
        ...(code && { code: code.toUpperCase() }),
        ...(description && { description }),
        ...(discountType && { discountType }),
        ...(discountValue !== undefined && { discountValue }),
        ...(minPurchaseAmount !== undefined && { minPurchaseAmount }),
        ...(maxDiscountAmount !== undefined && { maxDiscountAmount }),
        ...(startDate && { startDate }),
        ...(expiryDate && { expiryDate }),
        ...(usageLimit !== undefined && { usageLimit }),
        ...(isActive !== undefined && { isActive }),
        ...(applicableProducts && { applicableProducts }),
        ...(excludedProducts && { excludedProducts }),
      },
      { new: true }
    );

    if (!updatedDiscountCode) {
      res.status(404).json({ message: "Discount code not found" });
      return;
    }

    console.log("✅ Discount code updated:", updatedDiscountCode.code);
    res.status(200).json({
      message: "Discount code updated successfully",
      discountCode: updatedDiscountCode,
    });
  } catch (error) {
    console.error("❌ Error updating discount code:", error);
    res.status(500).json({
      message: "Failed to update discount code",
      error: (error as Error).message,
    });
  }
});

// Delete a discount code (admin only)
router.delete("/:id", authMiddleware, authorizeRoles("admin"), async (req: RequestWithUser, res: Response) => {
  try {
    console.log("🗑️ Deleting discount code:", req.params.id);
    const result = await DiscountCode.findByIdAndDelete(req.params.id);

    if (!result) {
      res.status(404).json({ message: "Discount code not found" });
      return;
    }

    console.log("✅ Discount code deleted:", result.code);
    res.status(200).json({
      message: "Discount code deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting discount code:", error);
    res.status(500).json({
      message: "Failed to delete discount code",
      error: (error as Error).message,
    });
  }
});

// Validate a discount code (for users and guests)
router.post("/validate", async (req: express.Request, res: Response) => {
  try {
    console.log("🔍 Validating discount code:", req.body.code);

    const { code, cartItems, subtotal } = req.body;

    if (!code || !cartItems || subtotal === undefined) {
      res.status(400).json({
        message: "Missing required fields: code, cartItems, and subtotal are required"
      });
      return;
    }

    // Find and validate the discount code
    const discountCode = await DiscountCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      expiryDate: { $gte: new Date() },
    });

    if (!discountCode) {
      res.status(404).json({
        message: "Invalid discount code or expired"
      });
      return;
    }

    // Check usage limit
    if (discountCode.usageLimit !== null && discountCode.usageCount >= discountCode.usageLimit) {
      res.status(400).json({
        message: "Discount code usage limit reached"
      });
      return;
    }

    // Check minimum purchase amount
    if (subtotal < discountCode.minPurchaseAmount) {
      res.status(400).json({
        message: `Minimum purchase amount of ${discountCode.minPurchaseAmount} required`,
        minPurchaseAmount: discountCode.minPurchaseAmount,
      });
      return;
    }

    // Check if all products in cart are eligible for the discount
    if (discountCode.applicableProducts.length > 0) {
      // Check if at least one product in cart is eligible
      const cartProductIds = cartItems.map((item: any) => item.productId.toString());
      const eligibleProductIds = discountCode.applicableProducts.map((id: any) => id.toString());

      const hasEligibleProduct = cartProductIds.some((id: string) => eligibleProductIds.includes(id));

      if (!hasEligibleProduct) {
        res.status(400).json({
          message: "Discount code not applicable to items in cart"
        });
        return;
      }
    }

    // Check if any excluded products are in the cart
    if (discountCode.excludedProducts.length > 0) {
      const cartProductIds = cartItems.map((item: any) => item.productId.toString());
      const excludedProductIds = discountCode.excludedProducts.map((id: any) => id.toString());

      const hasExcludedProduct = cartProductIds.some((id: string) => excludedProductIds.includes(id));

      if (hasExcludedProduct) {
        res.status(400).json({
          message: "Discount code not applicable to some items in cart"
        });
        return;
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discountType === "percentage") {
      discountAmount = (subtotal * discountCode.discountValue) / 100;
    } else {
      discountAmount = discountCode.discountValue;
    }

    // Apply max discount cap if set
    if (discountCode.maxDiscountAmount !== null && discountAmount > discountCode.maxDiscountAmount) {
      discountAmount = discountCode.maxDiscountAmount;
    }

    // Make sure discount doesn't exceed cart total
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    console.log("✅ Discount code validated:", {
      code: discountCode.code,
      discountAmount,
      originalTotal: subtotal,
      newTotal: subtotal - discountAmount
    });

    res.status(200).json({
      isValid: true,
      discountCode: {
        _id: discountCode._id,
        code: discountCode.code,
        description: discountCode.description,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
      },
      discountAmount,
      subtotal,
      totalAfterDiscount: subtotal - discountAmount,
    });
  } catch (error) {
    console.error("❌ Error validating discount code:", error);
    res.status(500).json({
      message: "Failed to validate discount code",
      error: (error as Error).message,
    });
  }
});

// Apply a discount code to an order (for checkout process)
router.post("/apply", async (req: express.Request, res: Response) => {
  try {
    console.log("🎁 Applying discount code to checkout:", req.body.code);

    const { code, orderId, userId } = req.body;

    // For authenticated requests, check the auth header
    const authHeader = req.headers.authorization;
    let authenticatedUserId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        authenticatedUserId = decoded.userId;
      } catch (authError) {
        // Token invalid, continue as guest
        console.log('🔑 Invalid token, proceeding as guest');
      }
    }

    // Use provided userId or authenticated userId
    const effectiveUserId = userId || authenticatedUserId;

    if (!effectiveUserId) {
      res.status(400).json({
        message: "UserId is required for applying discount codes"
      });
      return;
    }

    if (!code || !orderId) {
      res.status(400).json({
        message: "Missing required fields: code and orderId are required"
      });
      return;
    }

    // Find the discount code first to verify it exists
    const discountCode = await DiscountCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      startDate: { $lte: new Date() },
      expiryDate: { $gte: new Date() },
    });

    if (!discountCode) {
      res.status(404).json({
        message: "Invalid discount code or expired"
      });
      return;
    }

    // Check usage limit
    if (discountCode.usageLimit !== null && discountCode.usageCount >= discountCode.usageLimit) {
      res.status(400).json({
        message: "Discount code usage limit reached"
      });
      return;
    }

    // Find the order
    const Order = mongoose.model("Order");
    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: '_id',
        model: 'Product'
      });

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Verify order belongs to user
    if (order.user.toString() !== effectiveUserId) {
      res.status(403).json({ message: "Not authorized to access this order" });
      return;
    }

    // Check minimum purchase amount
    if (order.subtotal < discountCode.minPurchaseAmount) {
      res.status(400).json({
        message: `Minimum purchase amount of ${discountCode.minPurchaseAmount} required`,
        minPurchaseAmount: discountCode.minPurchaseAmount,
      });
      return;
    }

    // Check if all products in order are eligible for the discount
    if (discountCode.applicableProducts.length > 0) {
      const orderProductIds = order.items.map((item: any) => item.productId._id.toString());
      const eligibleProductIds = discountCode.applicableProducts.map((id: any) => id.toString());

      const hasEligibleProduct = orderProductIds.some((id: string) => eligibleProductIds.includes(id));

      if (!hasEligibleProduct) {
        res.status(400).json({
          message: "Discount code not applicable to items in order"
        });
        return;
      }
    }

    // Check if any excluded products are in the order
    if (discountCode.excludedProducts.length > 0) {
      const orderProductIds = order.items.map((item: any) => item.productId._id.toString());
      const excludedProductIds = discountCode.excludedProducts.map((id: any) => id.toString());

      const hasExcludedProduct = orderProductIds.some((id: string) => excludedProductIds.includes(id));

      if (hasExcludedProduct) {
        res.status(400).json({
          message: "Discount code not applicable to some items in order"
        });
        return;
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discountType === "percentage") {
      discountAmount = (order.subtotal * discountCode.discountValue) / 100;
    } else {
      discountAmount = discountCode.discountValue;
    }

    // Apply max discount cap if set
    if (discountCode.maxDiscountAmount !== null && discountAmount > discountCode.maxDiscountAmount) {
      discountAmount = discountCode.maxDiscountAmount;
    }

    // Make sure discount doesn't exceed order total
    if (discountAmount > order.subtotal) {
      discountAmount = order.subtotal;
    }

    // Update order with discount
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        discountCode: discountCode._id,
        discountAmount,
        totalAmount: order.subtotal - discountAmount
      },
      { new: true }
    );

    // Increment usage count for the discount code
    await DiscountCode.findByIdAndUpdate(
      discountCode._id,
      { $inc: { usageCount: 1 } }
    );

    console.log("✅ Discount applied to order:", {
      order: orderId,
      code: discountCode.code,
      discountAmount,
      newTotal: updatedOrder.totalAmount
    });

    res.status(200).json({
      message: "Discount code applied successfully",
      order: {
        _id: updatedOrder._id,
        subtotal: updatedOrder.subtotal,
        discountAmount: updatedOrder.discountAmount,
        totalAmount: updatedOrder.totalAmount,
      },
    });
  } catch (error) {
    console.error("❌ Error applying discount code:", error);
    res.status(500).json({
      message: "Failed to apply discount code",
      error: (error as Error).message,
    });
  }
});

export default router;