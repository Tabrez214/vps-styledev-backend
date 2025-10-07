import { Request, Response } from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import { RequestWithUser } from "../middleware/authMiddleware";
import Order from "../models/order";
import Product from "../models/product";
import DiscountCode from "../models/discount-codes";
import DesignOrder from "../models/designOrder";
import User from "../models/user";
import { GuestService } from "../services/guestService";
import { mapAddressFields, mapPriceFields, StandardAddress } from "../types/standardTypes";

// Define interfaces for better type safety
interface OrderItem {
  productId?: string;
  designId?: string;
  quantity: number;
  pricePerItem: number;        // Standardized field name (was 'price')
  totalPrice?: number;         // Add for consistency
  color: string;               // Add explicit color field
  size: string;                // Add explicit size field
  designData?: any;
  isDesignOrder?: boolean;
}

dotenv.config();

// SECURITY: Use environment variables for credentials
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ CRITICAL: Razorpay credentials not found in environment variables');
  throw new Error('Razorpay credentials not configured');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const checkout = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      amount,
      subtotal,
      discountAmount: providedDiscountAmount,
      couponInfo,
      address,
      items,
      userId,
      discountCode,
      designOrder,
      purchaseOrderNumber,
      shippingAddress,
      billingAddress
    } = req.body;

    let order;

    // If orderId is provided, fetch the existing order
    if (orderId) {
      order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
    } else {
      // Create a new order if orderId is not provided
      if (!amount || !address || !userId) {
        return res.status(400).json({
          message: "Missing required fields: amount, address, and userId are required"
        });
      }

      // Check if we have either items or designOrder
      if ((!items || items.length === 0) && !designOrder) {
        return res.status(400).json({
          message: "Either items or designOrder is required"
        });
      }

      // Calculate subtotal and prepare order items
      let subtotal = 0;
      const orderItems = [];

      if (designOrder) {
        // Handle design order - use the design order data directly
        subtotal = designOrder.priceBreakdown?.totalPrice || designOrder.totalAmount || amount;

        // Create a single order item for the design order
        const totalQuantity = Object.values(designOrder.quantities || {}).reduce((sum: number, qty: any) => sum + (qty || 0), 0);
        orderItems.push({
          designId: designOrder.designId,
          quantity: totalQuantity,
          pricePerItem: totalQuantity > 0 ? subtotal / totalQuantity : subtotal, // Standardized field name
          totalPrice: subtotal,
          color: designOrder.designInfo?.selectedShirt?.color || 'Custom',
          size: 'Mixed', // For design orders with multiple sizes
          designData: designOrder.designInfo,
          isDesignOrder: true
        });
      } else {
        // Handle regular product orders
        for (const item of items) {
          const product = await Product.findById(item.productId);
          if (!product) {
            return res.status(400).json({
              message: `Product with ID ${item.productId} not found`
            });
          }

          const pricePerItem = product.pricePerItem;
          const totalPrice = pricePerItem * item.quantity;
          subtotal += totalPrice;

          orderItems.push({
            productId: item.productId,
            productName: item.productName || product.name || "Custom T-Shirt", // Add required field
            primaryImage: { // Add required nested object
              url: item.primaryImage?.url || item.imageUrl || product.images?.[0] || "https://api.styledev.in/uploads/default.jpg",
              alt: item.primaryImage?.alt || "",
              imageId: item.primaryImage?.imageId || ""
            },
            quantity: item.quantity,
            pricePerItem: pricePerItem,    // Standardized field name
            totalPrice: totalPrice,        // Add for consistency
            color: item.color || 'Default',
            size: item.size || 'M'
          });
        }
      }

      // Initialize discount variables
      let discountAmount = 0;
      let discountCodeId = null;
      let totalAmount = subtotal;

      // Use coupon info from frontend if provided (already validated on address page)
      if (couponInfo && couponInfo.coupon) {
        discountAmount = providedDiscountAmount || couponInfo.discountAmount || 0;

        // Find the discount code for reference
        const discount = await DiscountCode.findOne({
          code: couponInfo.coupon.code.toUpperCase(),
          isActive: true
        });

        if (discount) {
          discountCodeId = discount._id;
          // Re-validate discount is still valid
          const isValid = discount.startDate <= new Date() && discount.expiryDate >= new Date();
          if (!isValid) {
            // Coupon expired between address and payment - reset discount
            discountAmount = 0;
            discountCodeId = null;
            console.log("Coupon expired during checkout:", couponInfo.coupon.code);
          } else {
            // Increment usage count for the discount code
            await DiscountCode.findByIdAndUpdate(
              discount._id,
              { $inc: { usageCount: 1 } }
            );
          }
        }

        totalAmount = subtotal - discountAmount;
      }
      // Fallback to old discount code processing if no coupon info
      else if (discountCode) {
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

      // Standardize address using address mapping utilities
      const standardizedAddress = mapAddressFields.frontendToBackend(address);
      const standardizedShippingAddress = shippingAddress ? mapAddressFields.frontendToBackend(shippingAddress) : null;
      const standardizedBillingAddress = billingAddress ? mapAddressFields.frontendToBackend(billingAddress) : null;

      // Create a new order with all required fields
      const orderData: any = {
        name: `Order-${Date.now()}`, // Add required name field
        order_id: `order_${Date.now()}`, // Add required order_id field
        user: userId,
        items: orderItems,
        address: standardizedAddress, // Use standardized address (keeping for backward compatibility)
        subtotal: subtotal,
        amount: totalAmount, // Set amount to the final total (with discount if applicable)
        discountCode: discountCodeId,
        discountAmount: discountAmount,
        totalAmount: totalAmount,
        status: "pending",
        checkoutType: 'regular' as const,
        paymentSource: 'cart' as const,
        // Add purchase order number if provided
        ...(purchaseOrderNumber && { purchaseOrderNumber: purchaseOrderNumber.trim() }),
        // Add standardized shipping address
        ...(standardizedShippingAddress && { shippingAddress: standardizedShippingAddress }),
        // Add standardized billing address if different from shipping
        ...(standardizedBillingAddress && { billingAddress: standardizedBillingAddress })
      };

      // Add design order data if this is a design order
      if (designOrder) {
        orderData.designOrderData = designOrder;
      }

      order = new Order(orderData);

      await order.save();

      // Create DesignOrder record if this is a design order
      if (designOrder) {
        // Calculate total quantity from quantities object
        const totalQuantity = Object.values(designOrder.quantities || {}).reduce((sum: number, qty: any) => sum + (qty || 0), 0);

        // Debug user and address data
        console.log('User data:', (req as any).user);
        console.log('Address data:', address);

        // Fetch full user data from database to get email
        const fullUser = await User.findById(userId);
        console.log('Full user data:', fullUser);

        // Get email from full user data
        const userEmail = fullUser?.email || '';
        const addressEmail = address.email || '';
        const finalEmail = userEmail || addressEmail || 'customer@example.com'; // Fallback email

        console.log('Email resolution:', { userEmail, addressEmail, finalEmail });

        const designOrderRecord = new DesignOrder({
          orderNumber: order.order_id,
          mainOrderId: order._id, // Enhanced linking: Reference to main order
          designId: designOrder.designId,
          customer: {
            email: finalEmail,
            name: (req as any).user?.name || address.fullName || 'Customer',
            address: `${address.streetAddress || address.street || ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || address.zipCode || ''}`,
            phone: (req as any).user?.phone || address.phoneNumber || address.phone || ''
          },
          sizes: designOrder.quantities || {},
          totalQuantity: totalQuantity,
          priceBreakdown: {
            basePrice: designOrder.priceBreakdown?.unitPrice || subtotal / totalQuantity,
            additionalCosts: [],
            subtotal: designOrder.priceBreakdown?.totalPrice || designOrder.totalAmount || subtotal,
            tax: 0,
            shipping: 0,
            total: designOrder.priceBreakdown?.totalPrice || designOrder.totalAmount || totalAmount
          },
          designData: {
            elements: designOrder.designInfo?.elements || [],
            selectedShirt: designOrder.designInfo?.shirtInfo || {},
            printLocations: designOrder.designInfo?.printLocations || {},
            printType: designOrder.designInfo?.printType || 'screen',
            productName: designOrder.designInfo?.productName || '',
            shirtInfo: designOrder.designInfo?.shirtInfo || {}
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

        // Enhanced linking: Add design order reference to main order
        order.linkedDesignOrders = order.linkedDesignOrders || [];
        order.linkedDesignOrders.push(designOrderRecord._id);
        await order.save();
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
    const razorpayKey = "rzp_test_Ng4tai9paMhYzq";

    console.log("Payment session created successfully:", {
      orderId: order.order_id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      hasKey: !!razorpayKey
    });

    const responseData = {
      success: true,
      message: "Payment session created - ready to open payment gateway",
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
        key: razorpayKey
      }
    };



    return res.status(200).json(responseData);
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
    console.log('🚀 Express checkout request body:', {
      hasAddress: !!req.body.address,
      hasBillingAddress: !!req.body.billingAddress,
      hasGuestInfo: !!req.body.guestInfo,
      addressData: req.body.address,
      billingAddressData: req.body.billingAddress,
      guestInfoData: req.body.guestInfo
    });

    const {
      amount: amountFromFrontend, // This now comes in paise (like normal checkout)
      items,
      guestInfo, // { email, phone, name } - for guest checkout
      userId, // Optional - if user is logged in
      discountCode,
      designOrder,
      address, // Add address from request body
      billingAddress // Add billing address from request body
    } = req.body;

    // Convert amount from paise back to rupees for internal calculations (same as normal checkout)
    const amount = amountFromFrontend / 100;

    console.log('💰 Express checkout amount conversion:', {
      amountFromFrontend: amountFromFrontend,
      amountInRupees: amount,
      conversion: 'paise to rupees'
    });

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
      // Handle design order items - use designOrder.totalAmount directly
      subtotal = designOrder.totalAmount || 0;

      for (const item of items) {
        // Use standardized item mapping for consistency
        const standardizedItem = mapPriceFields.standardizeOrderItem({
          ...item,
          // Ensure we have valid numbers
          price: item.price || item.pricePerItem || 0,
          quantity: item.quantity || 0
        });

        // Only add to orderItems if this is a valid design order item
        if (item.isDesignOrder) {
          orderItems.push({
            designId: item.designId,
            productName: item.productName || "Custom Design", // Add required field
            primaryImage: { // Add required nested object
              url: item.primaryImage?.url || item.imageUrl || "https://api.styledev.in/uploads/design-default.jpg",
              alt: item.primaryImage?.alt || "Design Image",
              imageId: item.primaryImage?.imageId || ""
            },
            quantity: standardizedItem.quantity,
            pricePerItem: standardizedItem.pricePerItem,
            totalPrice: standardizedItem.totalPrice,
            color: item.designData?.selectedShirt?.color || 'Custom',
            size: 'Mixed', // For design orders with multiple sizes
            designData: item.designData
          });
        } else {
          // Handle regular items within a design order
          // Skip items with invalid productIds (like "design-order")
          if (item.productId && item.productId !== "design-order" && item.productId.length === 24) {
            try {
              const product = await Product.findById(item.productId);
              if (product) {
                // Use product pricing with standardized fields and required schema fields
                const standardizedProductItem = {
                  productId: item.productId,
                  productName: item.productName || product.name || "Custom Product", // Add required field
                  primaryImage: { // Add required nested object
                    url: item.primaryImage?.url || item.imageUrl || product.images?.[0] || "https://api.styledev.in/uploads/default.jpg",
                    alt: item.primaryImage?.alt || "",
                    imageId: item.primaryImage?.imageId || ""
                  },
                  quantity: standardizedItem.quantity,
                  pricePerItem: product.pricePerItem,
                  totalPrice: product.pricePerItem * standardizedItem.quantity,
                  color: item.color || 'Default',
                  size: item.size || 'M'
                };

                orderItems.push(standardizedProductItem);
              }
            } catch (error) {
              console.log('⚠️ Skipping invalid productId:', item.productId);
            }
          }
        }
      }

      // Ensure we have a valid subtotal
      if (isNaN(subtotal) || subtotal <= 0) {
        subtotal = items.reduce((sum: number, item: any) => {
          const price = item.price || 0;
          const quantity = item.quantity || 0;
          return sum + (price * quantity);
        }, 0);
      }
    } else {
      // Handle regular product orders with standardized mapping
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({
            message: `Product with ID ${item.productId} not found`
          });
        }

        // Use standardized item mapping for consistency with required fields
        const standardizedItem = {
          productId: item.productId,
          productName: item.productName || product.name || "Custom Product", // Add required field
          primaryImage: { // Add required nested object
            url: item.primaryImage?.url || item.imageUrl || product.images?.[0] || "https://api.styledev.in/uploads/default.jpg",
            alt: item.primaryImage?.alt || "",
            imageId: item.primaryImage?.imageId || ""
          },
          quantity: item.quantity,
          pricePerItem: product.pricePerItem,
          totalPrice: product.pricePerItem * item.quantity,
          color: item.color || 'Default',
          size: item.size || 'M'
        };

        subtotal += standardizedItem.totalPrice;
        orderItems.push(standardizedItem);
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

    // Use standardized address mapping for express checkout
    const { address: frontendAddress } = req.body;
    // Enhanced address mapping with support for both regular and express checkout formats
    const tempAddress = frontendAddress ? mapAddressFields.frontendToBackend({
      // Support both regular and express checkout address formats
      email: frontendAddress.email || guestInfo?.email || 'express@checkout.com',
      phone: frontendAddress.phone || frontendAddress.phoneNumber || guestInfo?.phone || '',
      name: frontendAddress.name || frontendAddress.fullName || guestInfo?.name || 'Express Checkout User',

      // Support multiple street address field names
      street: frontendAddress.street ||
        frontendAddress.streetAddress ||
        frontendAddress.address ||
        frontendAddress.billingAddress ||
        'To be updated from payment gateway',

      city: frontendAddress.city || frontendAddress.billingCity || 'To be updated',
      state: frontendAddress.state || frontendAddress.billingState || 'To be updated',

      // Support multiple postal code field names  
      zipCode: frontendAddress.zipCode ||
        frontendAddress.postalCode ||
        frontendAddress.billingPostalCode ||
        'To be updated',

      country: frontendAddress.country || frontendAddress.billingCountry || 'India',
      gstNumber: frontendAddress.gstNumber || guestInfo?.gstNumber || ''
    }) : mapAddressFields.frontendToBackend({
      email: guestInfo?.email || 'express@checkout.com',
      phone: guestInfo?.phone || '',
      name: guestInfo?.name || 'Express Checkout User',
      street: 'To be updated from payment gateway',
      city: 'To be updated',
      state: 'To be updated',
      zipCode: 'To be updated',
      country: 'India',
      gstNumber: guestInfo?.gstNumber || ''
    });

    // Generate unique order ID
    const orderIdString = `EXPRESS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order in database
    const orderData: any = {
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

    // Only add shipping and billing addresses if they contain valid data
    // This prevents validation errors for empty required fields in express checkout
    const { shippingAddress: reqShippingAddress, billingAddress: reqBillingAddress } = req.body;

    if (reqShippingAddress && reqShippingAddress.name && reqShippingAddress.street) {
      orderData.shippingAddress = mapAddressFields.frontendToBackend(reqShippingAddress);
    }

    if (reqBillingAddress && reqBillingAddress.name && reqBillingAddress.street) {
      orderData.billingAddress = mapAddressFields.frontendToBackend(reqBillingAddress);
    }

    const order = new Order(orderData);
    await order.save();

    // Create Razorpay order - use the original amount from frontend (already in paise)
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
    if (designOrder && !designOrder.skipDesignOrderRecord) {
      // Handle temporary design IDs - convert to ObjectId or skip if invalid
      let validDesignId = null;
      if (designOrder.designId && designOrder.designId.length === 24) {
        try {
          validDesignId = designOrder.designId;
        } catch (error) {
          console.log('⚠️ Invalid designId, using fallback:', designOrder.designId);
        }
      }

      // Skip DesignOrder creation if we don't have a valid designId and it's a temporary design
      if (!validDesignId && (designOrder.isTemporaryDesign || designOrder.tempDesignReference)) {
        console.log('⚠️ Skipping DesignOrder creation for temporary design:', designOrder.tempDesignReference || designOrder.designId);
      } else {
        // Use a default ObjectId for temporary designs if needed
        if (!validDesignId) {
          validDesignId = '000000000000000000000000'; // Default ObjectId for temp designs
        }

        // Extract design data from order items for manufacturing
        const designDataForManufacturing = (items as OrderItem[]).find((item: OrderItem) => item.designData)?.designData || designOrder.designData || {};

        const designOrderRecord = new DesignOrder({
          orderNumber: order.order_id,
          mainOrderId: order._id, // Enhanced linking: Reference to main order
          designId: validDesignId,
          customer: {
            email: guestInfo?.email || tempAddress.email,
            name: guestInfo?.name || tempAddress.name,
            address: `${tempAddress.street}, ${tempAddress.city}, ${tempAddress.state}`,
            phone: guestInfo?.phone || tempAddress.phone
          },
          sizes: designOrder.sizes || {},
          totalQuantity: designOrder.totalQuantity || items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          priceBreakdown: designOrder.priceBreakdown || {
            basePrice: subtotal || 0,
            additionalCosts: [],
            subtotal: subtotal || 0,
            tax: 0,
            shipping: 0,
            total: totalAmount || 0
          },
          // Store design data for manufacturing
          designData: designDataForManufacturing,
          // Store additional manufacturing info
          manufacturingInfo: {
            tempDesignReference: designOrder.tempDesignReference,
            isTemporaryDesign: designOrder.isTemporaryDesign || true,
            designInfo: designOrder.designInfo || {},
            originalDesignId: designOrder.designId
          },
          status: 'pending',
          paymentStatus: 'pending',
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            ipAddress: req.ip
          }
        });

        try {
          await designOrderRecord.save();

          // Enhanced linking: Add design order reference to main order
          order.linkedDesignOrders = order.linkedDesignOrders || [];
          order.linkedDesignOrders.push(designOrderRecord._id);
          await order.save();
        } catch (error) {
          console.error('⚠️ Failed to create DesignOrder record:', error);
          // Don't fail the entire checkout if DesignOrder creation fails
        }
      }
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
        key: "rzp_test_Ng4tai9paMhYzq"
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
      body: req.body,
      hasBillingAddress: !!req.body.billingAddress,
      hasShippingAddress: !!req.body.shippingAddress,
      hasCustomerInfo: !!req.body.customerInfo
    });

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      // Additional data for guest orders
      billingAddress, // From Razorpay response or user input
      shippingAddress, // From user input
      customerContact, // From Razorpay response
      customerInfo, // Additional customer info
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
    const addressToUpdate = billingAddress || shippingAddress || customerInfo;
    if (addressToUpdate && (order.isExpressCheckout || order.isGuestOrder)) {
      order.billingAddress = {
        name: addressToUpdate.name || addressToUpdate.fullName || order.billingAddress?.name || (order.user as any)?.name,
        email: addressToUpdate.email || customerContact?.email || order.billingAddress?.email || (order.user as any)?.email,
        phone: addressToUpdate.phone || addressToUpdate.phoneNumber || customerContact?.contact || order.billingAddress?.phone || (order.user as any)?.phone,
        street: addressToUpdate.street || addressToUpdate.streetAddress || addressToUpdate.line1 || order.billingAddress?.street || 'Not provided',
        city: addressToUpdate.city || order.billingAddress?.city || 'Not provided',
        state: addressToUpdate.state || order.billingAddress?.state || 'Not provided',
        zipCode: addressToUpdate.zipCode || addressToUpdate.postalCode || addressToUpdate.zipcode || order.billingAddress?.zipCode || 'Not provided',
        country: addressToUpdate.country || order.billingAddress?.country || 'India',
        gstNumber: addressToUpdate.gstNumber || order.billingAddress?.gstNumber
      };

      // Also update the main address if it was temporary
      if (typeof order.address === 'object' && (
        order.address.street === 'To be updated from payment gateway' ||
        order.address.city === 'To be updated' ||
        order.address.state === 'To be updated'
      )) {
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