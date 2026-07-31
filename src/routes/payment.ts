import { Router } from "express";
import { checkout, verification, expressCheckout } from "../controllers/payment";
import { authMiddleware } from "../middleware/authMiddleware";
import { csrfProtection, flexibleCSRFProtection } from "../middleware/csrfMiddleware";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Order from "../models/order";
import Address from "../models/address";
import Cart from "../models/cart";

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

// Express checkout - supports both authenticated and guest users with flexible CSRF protection
router.post("/express-checkout", flexibleCSRFProtection, (req: Request, res: Response, next: NextFunction) => {
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

      // SECURITY: Always verify payment signature - no bypasses allowed
      if (!razorpay_signature) {
        console.log("❌ Payment signature missing");
        return res.status(400).json({ success: false, message: "Payment signature is required" });
      }

      // Verify signature using environment variable
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(body)
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;

      if (!isAuthentic) {
        console.log("❌ Payment signature verification failed");
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

// Debug endpoint - DISABLED in production
router.get("/debug/env", (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json({
      hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasRazorpaySecret: !!process.env.RAZORPAY_KEY_SECRET,
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

// Razorpay Webhook handler — catches payments even if user's browser crashes
router.post("/webhook", (req: Request, res: Response, next: NextFunction) => {
  const handleWebhook = async () => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      // Verify webhook signature if secret is configured
      if (webhookSecret) {
        const receivedSignature = req.headers['x-razorpay-signature'] as string;
        if (!receivedSignature) {
          console.log('❌ Webhook: Missing signature header');
          return res.status(400).json({ success: false, message: 'Missing signature' });
        }

        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (expectedSignature !== receivedSignature) {
          console.log('❌ Webhook: Signature verification failed');
          return res.status(400).json({ success: false, message: 'Invalid signature' });
        }
      }

      const { event, payload } = req.body;
      console.log('🔔 Webhook event received:', event);

      if (event === 'payment.captured') {
        const paymentEntity = payload?.payment?.entity;
        if (!paymentEntity) {
          return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const razorpay_order_id = paymentEntity.order_id;
        const razorpay_payment_id = paymentEntity.id;

        // Find the order
        const order = await Order.findOne({ razorpay_order_id });
        if (!order) {
          console.log('⚠️ Webhook: Order not found for razorpay_order_id:', razorpay_order_id);
          return res.status(200).json({ success: true, message: 'Order not found, skipping' });
        }

        // Idempotency: skip if already completed
        if (order.status === 'completed') {
          console.log('✅ Webhook: Order already completed, skipping:', order.order_id);
          return res.status(200).json({ success: true, message: 'Already processed' });
        }

        // Update order
        order.razorpay_payment_id = razorpay_payment_id;
        order.status = 'completed';
        await order.save();

        // Clear user's cart after successful payment
        if (order.user) {
          await Cart.findOneAndDelete({ user: order.user });
        }

        console.log('✅ Webhook: Order completed via webhook:', order.order_id);
      } else if (event === 'payment.failed') {
        const paymentEntity = payload?.payment?.entity;
        if (paymentEntity?.order_id) {
          const order = await Order.findOne({ razorpay_order_id: paymentEntity.order_id });
          if (order && order.status === 'pending') {
            order.status = 'failed';
            await order.save();
            console.log('❌ Webhook: Order marked failed:', order.order_id);
          }
        }
      }

      // Always return 200 to Razorpay to acknowledge receipt
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      // Return 200 even on error to prevent Razorpay from retrying indefinitely
      return res.status(200).json({ success: true, message: 'Acknowledged with error' });
    }
  };

  handleWebhook().catch(next);
});

export default router;
