import { Request, Response } from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import { RequestWithUser } from "../middleware/authMiddleware";
import Order from "../models/order";
import Product from "../models/product";
import DiscountCode from "../models/discount-codes";
import DesignOrder from "../models/designOrder";
import { GuestService } from "../services/guestService";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || ""
});

export const checkout = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, address, items, userId, discountCode, designOrder } = req.body;

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

      if (designOrder) {
        // Handle design order items
        for (const item of items) {
          subtotal += item.price * item.quantity;

          orderItems.push({
            designId: item.designId,
            quantity: item.quantity,
            price: item.price,
            sizes: item.sizes,
            designData: item.designData
          });
        }
      } else {
        // Handle regular product orders
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
            price: price
          });
        }
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

          console.log("Discount applied:", {
            code: discountCode,
            subtotal,
            discountAmount,
            totalAmount
          });
        }
      }

      // Create a new order with all required fields
      const orderData: any = {
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
      };

      // Add design order data if this is a design order
      if (designOrder) {
        orderData.designOrderData = designOrder;
      }

      order = new Order(orderData);

      await order.save();

      // Create DesignOrder record if this is a design order
      if (designOrder) {
        const designOrderRecord = new DesignOrder({
          orderNumber: order.order_id,
          designId: designOrder.designId,
          customer: {
            email: designOrder.customer?.email || address.email,
            name: designOrder.customer?.name || address.name || address.fullName,
            address: designOrder.customer?.address || `${address.street || address.address}, ${address.city}, ${address.state} ${address.zipCode || address.postalCode}`,
            phone: designOrder.customer?.phone || address.phone || address.phoneNumber
          },
          sizes: designOrder.sizes || {},
          totalQuantity: designOrder.totalQuantity || items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          priceBreakdown: designOrder.priceBreakdown || {
            basePrice: subtotal,
            additionalCosts: [],
            subtotal: subtotal,
            tax: 0,
            shipping: 0,
            total: totalAmount
          },
          status: 'pending',
          paymentStatus: 'pending',
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: req.ip
          }
        });

        await designOrderRecord.save();
      }
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
        isDesignOrder: order.designOrderData ? "Yes" : "No"
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
    console.error("Checkout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating payment session",
      error: (error as Error).message
    });
  }
};

// Express Checkout - supports both authenticated and guest users
export const expressCheckout = async (req: Request, res: Response) => {
  try {
    const {
      amount,
      items,
      guestInfo, // { email, phone, name } - for guest checkout
      userId, // Optional - if user is logged in
      discountCode,
      designOrder
    } = req.body;

    let finalUserId = userId;
    let isGuestOrder = false;
    let guestUser = null;
    let userAccountMessage = null;
    let isExistingUserExpressCheckout = false;

    // If no userId provided, handle guest checkout
    if (!userId && guestInfo) {
      console.log('🔍 Processing guest checkout for:', guestInfo.email);
      const guestResult = await GuestService.createOrFindGuest(guestInfo);
      console.log('Guest service result:', guestResult.userType);
      guestUser = guestResult.user;
      finalUserId = guestUser._id.toString();

      if (guestResult.userType === 'regular') {
        // Existing regular user using Express Checkout while not logged in
        isGuestOrder = false; // This is actually a regular user's order
        isExistingUserExpressCheckout = true;
        userAccountMessage = {
          type: 'existing_user_express_checkout',
          message: 'We found an existing account with this email. This order will be linked to your account. Please log in to view all your orders.',
          suggestedAction: 'login',
          userEmail: guestInfo.email
        };
        console.log('🔔 Existing user using Express Checkout:', guestInfo.email);
      } else if (guestResult.userType === 'guest') {
        // Existing guest user
        isGuestOrder = true;
        console.log('👥 Existing guest user checkout:', guestInfo.email);
      } else {
        // New guest user
        isGuestOrder = true;
        console.log('✨ New guest user created:', guestInfo.email);
      }
    }

    if (!finalUserId) {
      return res.status(400).json({
        message: "Either userId or guestInfo (email, phone) is required"
      });
    }

    if (!amount || !items || items.length === 0) {
      return res.status(400).json({
        message: "Amount and items are required"
      });
    }

    // Calculate subtotal and prepare order items
    let subtotal = 0;
    const orderItems = [];

    if (designOrder) {
      // Handle design order items
      for (const item of items) {
        subtotal += item.price * item.quantity;

        orderItems.push({
          designId: item.designId,
          quantity: item.quantity,
          price: item.price,
          sizes: item.sizes,
          designData: item.designData
        });
      }
    } else {
      // Handle regular product orders
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
          price: price
        });
      }
    }

    // Process discount code if provided
    let discountAmount = 0;
    let discountCodeId = null;
    let totalAmount = subtotal;

    if (discountCode) {
      const discount = await DiscountCode.findOne({
        code: discountCode.toUpperCase(),
        isActive: true,
        startDate: { $lte: new Date() },
        expiryDate: { $gte: new Date() }
      });

      if (discount) {
        if (discount.discountType === "percentage") {
          discountAmount = (subtotal * discount.discountValue) / 100;
        } else {
          discountAmount = discount.discountValue;
        }

        if (discount.maxDiscountAmount !== null && discountAmount > discount.maxDiscountAmount) {
          discountAmount = discount.maxDiscountAmount;
        }

        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }

        discountCodeId = discount._id;
        totalAmount = subtotal - discountAmount;

        await DiscountCode.findByIdAndUpdate(
          discount._id,
          { $inc: { usageCount: 1 } }
        );
      }
    }

    // Create temporary address for express checkout
    const tempAddress = {
      email: guestInfo?.email || 'express@checkout.com',
      phone: guestInfo?.phone || '',
      name: guestInfo?.name || 'Express Checkout User',
      street: 'To be updated from payment gateway',
      city: 'To be updated',
      state: 'To be updated',
      zipCode: 'To be updated',
      country: 'India'
    };

    // Generate unique order ID
    const orderIdString = `EXPRESS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order in database
    const orderData = {
      name: `Express Order - ${guestInfo?.name || guestUser?.name || 'Guest'}`,
      order_id: orderIdString,
      user: finalUserId,
      items: orderItems,
      address: tempAddress,
      subtotal: subtotal,
      amount: totalAmount,
      discountCode: discountCodeId,
      discountAmount: discountAmount,
      totalAmount: totalAmount,
      status: "pending",
      isExpressCheckout: true,
      isGuestOrder: isGuestOrder,
      checkoutType: 'express' as const,
      paymentSource: 'express-checkout' as const,
      // Add express checkout metadata
      expressCheckoutMetadata: {
        isExistingUserExpressCheckout,
        userAccountMessage: userAccountMessage ? userAccountMessage.type : null,
        originalEmail: guestInfo?.email
      },
      // Only add guest session data for actual guest users
      ...(isGuestOrder && !isExistingUserExpressCheckout && {
        guestSessionData: {
          guestToken: GuestService.generateGuestToken(finalUserId, '7d'),
          sessionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          allowAccountClaim: true
        }
      }),
      ...(designOrder && { designOrderData: designOrder })
    };

    const order = new Order(orderData);
    await order.save();

    // Create Razorpay order
    const amountInPaise = Math.round(totalAmount * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        orderSource: "express-checkout",
        orderId: order._id.toString(),
        isGuestOrder: isGuestOrder.toString(),
        discountApplied: discountAmount > 0 ? "Yes" : "No",
        userEmail: guestInfo?.email || 'N/A'
      }
    });

    // Update order with Razorpay order ID
    order.razorpay_order_id = razorpayOrder.id;
    await order.save();

    // Create DesignOrder record if this is a design order
    if (designOrder) {
      const designOrderRecord = new DesignOrder({
        orderNumber: order.order_id,
        designId: designOrder.designId,
        customer: {
          email: guestInfo?.email || tempAddress.email,
          name: guestInfo?.name || tempAddress.name,
          address: `${tempAddress.street}, ${tempAddress.city}, ${tempAddress.state}`,
          phone: guestInfo?.phone || tempAddress.phone
        },
        sizes: designOrder.sizes || {},
        totalQuantity: designOrder.totalQuantity || items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        priceBreakdown: designOrder.priceBreakdown || {
          basePrice: subtotal,
          additionalCosts: [],
          subtotal: subtotal,
          tax: 0,
          shipping: 0,
          total: totalAmount
        },
        status: 'pending',
        paymentStatus: 'pending',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: req.ip
        }
      });

      await designOrderRecord.save();
    }

    console.log('✅ Express checkout order created:', {
      orderId: order.order_id,
      isGuestOrder,
      isExistingUserExpressCheckout,
      amount: totalAmount,
      userEmail: guestInfo?.email
    });

    // Return response
    return res.status(200).json({
      success: true,
      isGuestOrder,
      isExistingUserExpressCheckout,
      order: {
        id: order._id,
        orderId: order.order_id,
        amount: totalAmount,
        razorpayOrderId: razorpayOrder.id
      },
      payment: {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID
      },
      // Include user account message if applicable
      ...(userAccountMessage && {
        userAccountMessage
      }),
      // If guest order, provide session data for order tracking
      ...(isGuestOrder && !isExistingUserExpressCheckout && order.guestSessionData && {
        guestSession: {
          token: order.guestSessionData.guestToken,
          expiry: order.guestSessionData.sessionExpiry,
          canClaimAccount: order.guestSessionData.allowAccountClaim
        }
      })
    });
  } catch (error) {
    console.error("❌ Express checkout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating express checkout session",
      error: (error as Error).message
    });
  }
};

export const verification = async (req: Request, res: Response) => {
  try {
    console.log('🔄 Verification request received:', {
      body: req.body
    });

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      // Additional data for guest orders
      billingAddress, // From Razorpay response or user input
      customerContact, // From Razorpay response
      isExpressCheckout, // Flag to indicate express checkout
      isDemoPayment // Flag for demo/test payments
    } = req.body;

    // Skip signature verification for demo/test payments
    let isAuthentic = true;

    // Only verify signature if it's provided and not a demo payment
    if (razorpay_signature && !isDemoPayment) {
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(body)
        .digest("hex");

      isAuthentic = expectedSignature === razorpay_signature;

      if (!isAuthentic) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed"
        });
      }
    } else if (!razorpay_signature && !isDemoPayment) {
      console.log('⚠️ Warning: Signature verification skipped - no signature provided');
    }

    // Find and update order by razorpay_order_id or payment_id
    let order = await Order.findOne({ razorpay_order_id }).populate('user');

    // If order not found by order_id, try to find by payment_id
    if (!order && razorpay_payment_id) {
      order = await Order.findOne({ razorpay_payment_id }).populate('user');
    }

    // If still not found, try to find the most recent express checkout order
    if (!order && isExpressCheckout) {
      console.log('🔍 Order not found by IDs, searching for recent express checkout orders...');
      order = await Order.findOne({
        isExpressCheckout: true,
        status: 'pending'
      }).sort({ createdAt: -1 }).populate('user');

      if (order) {
        console.log('🔍 Found recent express checkout order:', order.order_id);
      } else {
        console.log('⚠️ No recent express checkout orders found');
        return res.status(404).json({
          success: false,
          message: "No pending express checkout orders found"
        });
      }
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update payment details
    order.razorpay_payment_id = razorpay_payment_id || order.razorpay_payment_id || `demo_${Date.now()}`;
    if (razorpay_signature) {
      order.razorpay_signature = razorpay_signature;
    }
    order.status = "completed";

    // Use values from request body when provided, with fallbacks for demo payments
    if (req.body.subtotal !== undefined) {
      order.subtotal = req.body.subtotal;
    } else if (isDemoPayment && order.subtotal === undefined) {
      // Ensure subtotal is set if missing for demo payments
      order.subtotal = order.totalAmount || order.amount || 0;
    }

    if (req.body.totalAmount !== undefined) {
      order.totalAmount = req.body.totalAmount;
    } else if (isDemoPayment && order.totalAmount === undefined) {
      // Ensure totalAmount is set if missing for demo payments
      order.totalAmount = order.amount || order.subtotal || 0;
    }

    if (req.body.amount !== undefined) {
      order.amount = req.body.amount;
    } else if (isDemoPayment && order.amount === undefined) {
      // Ensure amount is set if missing for demo payments
      order.amount = order.totalAmount || order.subtotal || 0;
    }

    if (req.body.discountAmount !== undefined) {
      order.discountAmount = req.body.discountAmount;
    } else if (isDemoPayment && order.discountAmount === undefined) {
      // Ensure discountAmount is set if missing for demo payments
      order.discountAmount = 0;
    }

    // Update billing address if provided (for express checkout)
    if (billingAddress && (order.isExpressCheckout || order.isGuestOrder)) {
      order.billingAddress = {
        name: billingAddress.name || order.billingAddress?.name || (order.user as any)?.name,
        email: billingAddress.email || customerContact?.email || order.billingAddress?.email || (order.user as any)?.email,
        phone: billingAddress.phone || customerContact?.contact || order.billingAddress?.phone || (order.user as any)?.phone,
        street: billingAddress.street || billingAddress.line1 || order.billingAddress?.street || 'Not provided',
        city: billingAddress.city || order.billingAddress?.city || 'Not provided',
        state: billingAddress.state || order.billingAddress?.state || 'Not provided',
        zipCode: billingAddress.zipCode || billingAddress.zipcode || order.billingAddress?.zipCode || 'Not provided',
        country: billingAddress.country || order.billingAddress?.country || 'India',
        gstNumber: billingAddress.gstNumber || order.billingAddress?.gstNumber
      };

      // Also update the main address if it was temporary
      if (typeof order.address === 'object' && order.address.street === 'To be updated from payment gateway') {
        order.address = {
          ...order.address,
          name: order.billingAddress.name,
          email: order.billingAddress.email,
          phone: order.billingAddress.phone,
          street: order.billingAddress.street,
          city: order.billingAddress.city,
          state: order.billingAddress.state,
          zipCode: order.billingAddress.zipCode,
          country: order.billingAddress.country
        };
      }

      // Update guest user billing info if it's a guest order
      if (order.isGuestOrder && order.user) {
        await GuestService.updateGuestBillingInfo(order.user.toString(), {
          name: order.billingAddress.name,
          email: order.billingAddress.email,
          phone: order.billingAddress.phone,
          street: order.billingAddress.street,
          city: order.billingAddress.city,
          state: order.billingAddress.state,
          zipCode: order.billingAddress.zipCode,
          country: order.billingAddress.country
        });
      }
    } else {
      // For demo payments without billing address, create a default one
      if (isDemoPayment && !order.billingAddress) {
        order.billingAddress = {
          name: (order.user as any)?.name || 'Demo Customer',
          email: (order.user as any)?.email || 'demo@example.com',
          phone: (order.user as any)?.phone || '9876543210',
          street: 'Demo Street 123',
          city: 'Demo City',
          state: 'Demo State',
          zipCode: '123456',
          country: 'India',
          gstNumber: ''
        };
      }
    }

    await order.save();

    // Update DesignOrder if this was a design order
    if (order.designOrderData) {
      await DesignOrder.findOneAndUpdate(
        { orderNumber: order.order_id },
        {
          paymentStatus: "paid",
          status: "processing"
        }
      );

      console.log("Design order processed successfully:", order.order_id);
    }

    console.log('✅ Payment verified successfully:', {
      orderId: order.order_id,
      isGuestOrder: order.isGuestOrder,
      amount: order.totalAmount,
      userEmail: (order.user as any)?.email,
      paymentType: isDemoPayment ? 'demo' : 'real'
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order: {
        id: order._id,
        orderId: order.order_id,
        amount: order.totalAmount,
        status: order.status,
        isGuestOrder: order.isGuestOrder,
        isExpressCheckout: order.isExpressCheckout,
        userEmail: (order.user as any)?.email,
        billingAddress: order.billingAddress,
        paymentType: isDemoPayment ? 'demo' : 'real',
        paymentId: order.razorpay_payment_id
      },
      // Include guest session data if applicable
      ...(order.isGuestOrder && order.guestSessionData && {
        guestSession: {
          token: order.guestSessionData.guestToken,
          expiry: order.guestSessionData.sessionExpiry,
          canClaimAccount: order.guestSessionData.allowAccountClaim
        }
      }),
      // Include user account message for existing users
      ...(order.expressCheckoutMetadata?.isExistingUserExpressCheckout && {
        userAccountMessage: {
          type: 'existing_user_express_checkout',
          message: 'We found an existing account with this email. This order has been linked to your account. Please log in to view all your orders.',
          suggestedAction: 'login',
          userEmail: (order.user as any)?.email
        }
      })
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