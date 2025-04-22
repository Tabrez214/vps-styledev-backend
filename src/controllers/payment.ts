import { Request, Response } from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import { RequestWithUser } from "../middleware/authMiddleware";
import Order from "../models/order";
import Product from "../models/product";
import DiscountCode from "../models/discount-codes";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || ""
});

export const checkout = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, address, items, userId, discountCode } = req.body;
    
    let order;
    
    // If orderId is provided, fetch the existing order
    if (orderId) {
      order = await Order.findById(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
    } else {
      // Create a new order if orderId is not provided
      if (!amount || !address || !items || !userId) {
        return res.status(400).json({ 
          message: "Missing required fields: amount, address, items, and userId are required" 
        });
      }
      
      // Calculate subtotal and prepare order items
      let subtotal = 0;
      const orderItems = [];
      
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({ 
            message: `Product with ID ${item.productId} not found` 
          });
        }
        
        const price = product.pricePerItem;
        subtotal += price * item.quantity;
        
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: price // Ensure price is set correctly
        });
      }
      
      // Initialize discount variables
      let discountAmount = 0;
      let discountCodeId = null;
      let totalAmount = subtotal;
      
      // Process discount code if provided
      if (discountCode) {
        // Find and validate discount code
        const discount = await DiscountCode.findOne({
          code: discountCode.toUpperCase(),
          isActive: true,
          startDate: { $lte: new Date() },
          expiryDate: { $gte: new Date() }
        });
        
        if (discount) {
          // Calculate discount amount
          if (discount.discountType === "percentage") {
            discountAmount = (subtotal * discount.discountValue) / 100;
          } else {
            discountAmount = discount.discountValue;
          }
          
          // Apply max discount cap if set
          if (discount.maxDiscountAmount !== null && discountAmount > discount.maxDiscountAmount) {
            discountAmount = discount.maxDiscountAmount;
          }
          
          // Make sure discount doesn't exceed order total
          if (discountAmount > subtotal) {
            discountAmount = subtotal;
          }
          
          discountCodeId = discount._id;
          totalAmount = subtotal - discountAmount;
          
          // Increment usage count for the discount code
          await DiscountCode.findByIdAndUpdate(
            discount._id,
            { $inc: { usageCount: 1 } }
          );
          
          console.log("💰 Discount applied:", {
            code: discountCode,
            subtotal,
            discountAmount,
            totalAmount
          });
        }
      }
      
      // Create a new order with all required fields
      order = new Order({
        name: `Order-${Date.now()}`, // Add required name field
        order_id: `order_${Date.now()}`, // Add required order_id field
        user: userId,
        items: orderItems,
        address: address._id || address,
        subtotal: subtotal,
        amount: totalAmount, // Set amount to the final total (with discount if applicable)
        discountCode: discountCodeId,
        discountAmount: discountAmount,
        totalAmount: totalAmount,
        status: "pending"
      });
      
      await order.save();
    }
    
    // Use totalAmount which already includes any discount
    const amountInPaise = Math.round(order.totalAmount * 100); // Convert to smallest currency unit
    
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR", // Change as needed
      receipt: order._id.toString(),
      notes: {
        orderSource: "your-e-commerce",
        orderId: order._id.toString(),
        discountApplied: order.discountAmount > 0 ? "Yes" : "No",
        discountAmount: order.discountAmount > 0 ? order.discountAmount.toString() : "0",
      }
    });
    
    // Update order with Razorpay order ID
    order.razorpay_order_id = razorpayOrder.id;
    await order.save();
    
    // Return the necessary payment details to the frontend
    return res.status(200).json({
      success: true,
      order: {
        id: order._id,
        orderId: order.order_id,
        amount: order.totalAmount,
        razorpayOrderId: razorpayOrder.id
      },
      payment: {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error("❌ Checkout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating payment session",
      error: (error as Error).message
    });
  }
};

export const verification = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    // Verify payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body)
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    // Update order status in the database
    const updatedOrder = await Order.findOneAndUpdate(
      { razorpay_order_id },
      {
        razorpay_payment_id,
        razorpay_signature,
        status: "completed"
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order: {
        id: updatedOrder._id,
        orderId: updatedOrder.order_id,
        amount: updatedOrder.totalAmount,
        status: updatedOrder.status
      }
    });
  } catch (error) {
    console.error("❌ Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: (error as Error).message
    });
  }
};