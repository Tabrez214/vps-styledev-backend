import { Router } from "express";
import { checkout, verification, expressCheckout } from "../controllers/payment";
import { authMiddleware } from "../middleware/authMiddleware";
import { csrfProtection } from "../middleware/csrfMiddleware";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Order from "../models/order";
import Address from "../models/address";

const router = Router();

// Create order with authentication and CSRF protection
router.post("/create-order", csrfProtection, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  console.log("🔄 Create-order request received:", {
    headers: req.headers,
    body: req.body,
    user: req.user
  });

  if (!req.user) {
    console.log("❌ Unauthorized: No user found in request");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  checkout(req, res).catch(next);
});

// Express checkout - supports both authenticated and guest users with CSRF protection
router.post("/express-checkout", csrfProtection, (req: Request, res: Response, next: NextFunction) => {
  console.log("🚀 Express-checkout request received:", {
    body: {
      amount: req.body.amount,
      itemsCount: req.body.items?.length || 0,
      hasGuestInfo: !!req.body.guestInfo,
      hasUserId: !!req.body.userId,
      hasAuth: !!req.headers.authorization
    },
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : undefined,
      'content-type': req.headers['content-type']
    }
  });

  expressCheckout(req, res).catch(next);
});

// Verification can stay unauthenticated
router.post("/verification", (req: Request, res: Response, next: NextFunction) => {
  console.log("🔄 Verification request received:", {
    body: req.body
  });
  verification(req, res).catch(next);
});

// Secure payment verification endpoint - validates payment and returns order token
router.post("/verify", (req: Request, res: Response, next: NextFunction) => {
  const verifyPayment = async () => {
    try {
      console.log("🔄 Payment verification request received:", req.body);

      const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        isDemoPayment
      } = req.body;

      if (!razorpay_payment_id) {
        console.log("❌ Payment ID missing");
        return res.status(400).json({ success: false, message: "Payment ID is required" });
      }

      // Verify payment signature (skip for demo payments)
      let isAuthentic = true;
      if (razorpay_signature && !isDemoPayment) {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", "MOaSHDGOpFb6fJvJN0RdXJQi")
          .update(body)
          .digest("hex");

        isAuthentic = expectedSignature === razorpay_signature;
      }

      if (!isAuthentic) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }

      // Find the order
      console.log("🔍 Looking for order with:", { razorpay_order_id, razorpay_payment_id });

      let order = await Order.findOne({
        $or: [
          { razorpay_order_id },
          { razorpay_payment_id }
        ]
      });

      console.log("🔍 Order found:", order ? "Yes" : "No");

      if (!order) {
        console.log("❌ Order not found, trying to find by razorpay_order_id only...");

        // Try finding by razorpay_order_id only (since payment_id might not be set yet)
        order = await Order.findOne({ razorpay_order_id });

        if (!order) {
          console.log("❌ No order found with razorpay_order_id:", razorpay_order_id);
          return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("✅ Found order by razorpay_order_id");
      }

      // Update order status
      order.razorpay_payment_id = razorpay_payment_id;
      if (razorpay_signature) {
        order.razorpay_signature = razorpay_signature;
      }
      order.status = "completed";

      // Populate billing address if not already set
      if (!order.billingAddress || Object.keys(order.billingAddress).length <= 1) {
        console.log("🏠 Populating billing address from order address");

        // Get the address data - it could be an ObjectId reference or direct object
        let addressData = order.address;

        // If address is an ObjectId, we need to populate it
        if (typeof order.address === 'string' || (order.address && order.address.constructor.name === 'ObjectId')) {
          console.log("🔍 Address is ObjectId, need to populate");
          addressData = await Address.findById(order.address);
          console.log("🏠 Populated address data:", addressData);
        }

        if (addressData) {
          order.billingAddress = {
            name: addressData.fullName || addressData.name || 'Customer',
            email: addressData.email || 'customer@example.com',
            phone: addressData.phoneNumber || addressData.phone || '',
            street: addressData.streetAddress || addressData.street || '',
            city: addressData.city || '',
            state: addressData.state || '',
            zipCode: addressData.postalCode || addressData.zipCode || '',
            country: addressData.country || 'India'
          };
          console.log("✅ Billing address populated:", order.billingAddress);
        }
      }

      // Generate a unique, secure order token
      const orderToken = crypto.randomBytes(32).toString('hex');
      order.verificationToken = orderToken;
      order.tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await order.save();

      console.log("✅ Payment verification successful:", {
        orderId: order._id.toString(),
        orderToken: orderToken.substring(0, 10) + "...",
        status: order.status
      });

      return res.json({
        success: true,
        orderId: order._id.toString(),
        orderToken
      });

    } catch (error) {
      console.error("Payment verification error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };

  verifyPayment().catch(next);
});

// Debug endpoint to check environment variables
router.get("/debug/env", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasRazorpaySecret: !!process.env.RAZORPAY_KEY_SECRET,
      keyIdLength: process.env.RAZORPAY_KEY_ID?.length || 0,
      keyIdPreview: process.env.RAZORPAY_KEY_ID?.substring(0, 10) + "..." || "NOT SET",
      nodeEnv: process.env.NODE_ENV,
      backendRunning: true
    });
  } catch (error) {
    next(error);
  }
});

// Get order details with token validation (for secure thank you page)
router.get("/order/:orderId", (req: Request, res: Response, next: NextFunction) => {
  const getOrderDetails = async () => {
    try {
      const { orderId } = req.params;
      const { token } = req.query;

      if (!orderId || !token) {
        return res.status(400).json({ success: false, message: "Order ID and token are required" });
      }

      // Find order with valid token
      const order = await Order.findOne({
        _id: orderId,
        verificationToken: token,
        tokenExpiry: { $gt: new Date() } // Token must not be expired
      }).populate('user', 'name email');

      if (!order) {
        return res.status(404).json({ success: false, message: "Invalid or expired order token" });
      }

      // Return order details
      return res.json({
        success: true,
        order: {
          id: order._id,
          order_id: order.order_id,
          totalAmount: order.totalAmount,
          status: order.status,
          items: order.items,
          address: order.address,
          billingAddress: order.billingAddress,
          createdAt: order.createdAt,
          user: order.user
        }
      });

    } catch (error) {
      console.error("Get order details error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  };

  getOrderDetails().catch(next);
});

export default router;
