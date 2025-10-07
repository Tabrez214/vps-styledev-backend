import express, { type Response } from "express"
import { authMiddleware, type RequestWithUser } from "../middleware/authMiddleware"
import { authorizeRoles } from "../middleware/roleMiddleware"
import Order from "../models/order"
import Product from "../models/product"
import Address from "../models/address"
import DiscountCode from "../models/discount-codes"
import { enrichOrderItemWithImages, batchEnrichOrderItems } from "../services/imageEnrichmentService"
// import { OrderLinkingService } from "../services/orderLinkingService"
// import { StatusManagementService } from "../services/statusManagementService"
// import { statusUpdateMiddleware } from "../middleware/statusValidationMiddleware"

const router = express.Router()

// Get orders - Admin gets all, User gets their own
router.get("/", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    console.log("📥 Incoming order request:", {
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? 'Bearer [hidden]' : 'none',
        ...req.headers
      },
      userId: req.user?.userId,
      role: req.user?.role,
      timestamp: new Date().toISOString()
    });

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    // If admin, get all orders, if user, get their orders
    const query = req.user.role === "admin" ? {} : { user: req.user.userId };
    console.log("🔍 Fetching orders for:", {
      userId: req.user.userId,
      role: req.user.role,
      query
    });

    const orders = await Order.find(query)
      .select('order_id subtotal discountAmount totalAmount status createdAt items address shippingAddress billingAddress user name')
      .populate({
        path: 'items.productId',
        select: 'name images colors pricePerItem',
        model: 'Product'
      })
      .populate({
        path: 'address',
        select: 'fullName phoneNumber streetAddress city state country postalCode email'
      })
      .populate({
        path: 'user',
        select: 'name email phone'
      })
      .populate({
        path: 'discountCode',
        select: 'code discountType discountValue',
        model: 'DiscountCode'
      })
      .lean();

    // Transform the response
    const cleanedOrders = orders.map(order => {
      // Handle address - could be populated reference or direct object
      let addressData = null;
      if ((order as any).address) {
        if (typeof (order as any).address === 'object' && (order as any).address._id) {
          // Populated address reference
          addressData = (order as any).address;
        } else if (typeof (order as any).address === 'object') {
          // Direct address object (like in express checkout)
          addressData = (order as any).address;
        }
      }

      // Handle billing address
      let billingAddressData = (order as any).billingAddress || null;

      // Get customer info from user, address, or billing address
      const customerName = ((order as any).user as any)?.name ||
        addressData?.fullName ||
        addressData?.name ||
        billingAddressData?.name ||
        (order as any).name ||
        'N/A';

      const customerEmail = ((order as any).user as any)?.email ||
        addressData?.email ||
        billingAddressData?.email ||
        'N/A';

      const customerPhone = ((order as any).user as any)?.phone ||
        addressData?.phoneNumber ||
        addressData?.phone ||
        billingAddressData?.phone ||
        'N/A';

      return {
        orderId: (order as any).order_id,
        subtotal: (order as any).subtotal,
        discountAmount: (order as any).discountAmount || 0,
        discountCode: (order as any).discountCode ? {
          code: ((order as any).discountCode as any).code,
          type: ((order as any).discountCode as any).discountType,
          value: ((order as any).discountCode as any).discountValue
        } : null,
        totalAmount: (order as any).totalAmount,
        status: (order as any).status,
        orderDate: (order as any).createdAt,
        // Customer information
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone
        },
        items: (order as any).items.map((item: any) => {
          // Priority 1: Use existing primaryImage if available
          let imageUrl = null;
          let primaryImage = null;
          let fallbackImages = [];

          console.log("🖼️ [IMAGE DEBUG] Item image data:", {
            hasPrimaryImage: !!item.primaryImage,
            primaryImageUrl: item.primaryImage?.url,
            hasFallbackImages: !!item.fallbackImages?.length,
            legacyImage: item.image
          });

          if (item.primaryImage && item.primaryImage.url) {
            imageUrl = item.primaryImage.url;
            primaryImage = item.primaryImage;
            console.log("✅ [IMAGE DEBUG] Using primaryImage:", imageUrl);
          }

          // Priority 2: Use fallbackImages if available
          if (item.fallbackImages && Array.isArray(item.fallbackImages)) {
            fallbackImages = item.fallbackImages;
          }

          // Priority 3: Get image from colors array (fallback) or general images
          if (!imageUrl) {
            if (item.productId?.colors && Array.isArray(item.productId.colors)) {
              // Try to find image from colors array - use first color with images
              const colorWithImages = item.productId.colors.find((color: any) =>
                color.images && color.images.length > 0
              );

              if (colorWithImages) {
                const defaultImage = colorWithImages.images.find((img: any) => img.isDefault);
                imageUrl = defaultImage?.url || colorWithImages.images[0]?.url;
              }
            }

            // Fallback to general product images if no color images found
            if (!imageUrl && item.productId?.images && item.productId.images.length > 0) {
              const defaultImage = item.productId.images.find((img: any) => img.isDefault);
              imageUrl = defaultImage?.url || item.productId.images[0]?.url;
            }
          }

          console.log("🔍 [ORDER DEBUG] Processing item:", {
            productName: item.productName,
            pricePerItem: item.pricePerItem,
            totalPrice: item.totalPrice,
            hasPrimaryImage: !!item.primaryImage,
            primaryImageUrl: item.primaryImage?.url,
            hasProductId: !!item.productId,
            productIdPopulated: !!item.productId?.name
          });

          const result = {
            productName: item.productName || item.productId?.name || 'Product not found',
            quantity: item.quantity || 0,
            pricePerItem: item.pricePerItem || 0,
            totalPrice: item.totalPrice || 0,
            color: item.color || 'N/A',
            size: item.size || 'N/A',
            // Pass through existing image data
            primaryImage: item.primaryImage || null,
            fallbackImages: item.fallbackImages || [],
            imageMetadata: item.imageMetadata || null,
            // Legacy field for backward compatibility
            image: item.image || '',
            // Include product data for frontend image fallback
            product: item.productId ? {
              _id: item.productId._id,
              name: item.productId.name,
              images: item.productId.images || [],
              colors: item.productId.colors || []
            } : null
          };

          console.log("📤 [ORDER DEBUG] Sending item:", {
            productName: result.productName,
            pricePerItem: result.pricePerItem,
            totalPrice: result.totalPrice,
            hasPrimaryImage: !!result.primaryImage,
            primaryImageUrl: result.primaryImage?.url
          });

          return result;
        }),
        // Address information
        shippingAddress: addressData ? {
          fullName: addressData.fullName || addressData.name,
          email: addressData.email,
          phoneNumber: addressData.phoneNumber || addressData.phone,
          address: addressData.streetAddress || addressData.street,
          city: addressData.city,
          state: addressData.state,
          country: addressData.country,
          postalCode: addressData.postalCode || addressData.zipCode
        } : null,
        billingAddress: billingAddressData,
        // Raw address data for invoice generation
        address: addressData,
        // Invoice type based on order status
        invoiceType: (order as any).status === 'completed' ? 'tax' : 'proforma'
      };
    });

    res.status(200).json(cleanedOrders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Fetching orders failed", error });
  }
});

// Get single order by ID
router.get("/:orderId", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    console.log("🔍 Fetching single order:", {
      orderId: req.params.orderId,
      userId: req.user?.userId,
      role: req.user?.role
    });

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    // Build query - admin can access any order, user can only access their own
    const query: any = {
      $or: [
        { _id: req.params.orderId },
        { order_id: req.params.orderId }
      ]
    };

    // If not admin, restrict to user's orders only
    if (req.user.role !== "admin") {
      query.user = req.user.userId;
    }

    console.log("🔍 Single order query:", query);

    const order = await Order.findOne(query)
      .populate({
        path: 'items.productId',
        select: 'name images colors pricePerItem',
        model: 'Product'
      })
      .populate({
        path: 'address',
        select: 'fullName phoneNumber streetAddress city state country postalCode email'
      })
      .populate({
        path: 'user',
        select: 'name email phone'
      })
      .populate({
        path: 'discountCode',
        select: 'code discountType discountValue',
        model: 'DiscountCode'
      })
      .lean();

    if (!order) {
      console.log("❌ Order not found:", req.params.orderId);
      res.status(404).json({ message: "Order not found" });
      return;
    }

    console.log("✅ Order found:", {
      orderId: (order as any)._id,
      order_id: (order as any).order_id,
      itemsCount: (order as any).items?.length,
      totalAmount: (order as any).totalAmount
    });

    // Transform the single order response (similar to the list transform)
    const orderData = order as any; // Type assertion to fix TypeScript issues
    const addressData = orderData.address;
    const billingAddressData = orderData.billingAddress || null;

    const transformedOrder = {
      _id: orderData._id,
      name: orderData.name,
      order_id: orderData.order_id,
      subtotal: orderData.subtotal,
      amount: orderData.amount,
      totalAmount: orderData.totalAmount,
      discountAmount: orderData.discountAmount || 0,
      status: orderData.status,
      createdAt: orderData.createdAt,
      updatedAt: orderData.updatedAt,
      razorpay_payment_id: orderData.razorpay_payment_id || null,
      items: orderData.items.map((item: any) => {
        console.log("🔍 Processing item for single order:", {
          productName: item.productName,
          pricePerItem: item.pricePerItem,
          totalPrice: item.totalPrice,
          hasPrimaryImage: !!item.primaryImage,
          primaryImageUrl: item.primaryImage?.url
        });

        return {
          _id: item._id,
          productId: item.productId?._id || item.productId,
          productName: item.productName || item.productId?.name || 'Product not found',
          quantity: item.quantity || 0,
          price: item.price || item.pricePerItem || 0, // Backward compatibility
          pricePerItem: item.pricePerItem || 0,
          totalPrice: item.totalPrice || (item.pricePerItem * item.quantity) || 0,
          color: item.color || 'N/A',
          size: item.size || 'N/A',
          primaryImage: item.primaryImage || null,
          fallbackImages: item.fallbackImages || [],
          imageMetadata: item.imageMetadata || null,
          image: item.image || item.primaryImage?.url || '',
          product: item.productId ? {
            _id: item.productId._id,
            name: item.productId.name,
            images: item.productId.images || [],
            colors: item.productId.colors || []
          } : null
        };
      }),
      // Address information - match the database structure
      address: addressData,
      shippingAddress: orderData.shippingAddress || null,
      billingAddress: billingAddressData,
      user: orderData.user
    };

    console.log("📤 Sending transformed order:", {
      orderId: transformedOrder.order_id,
      itemsCount: transformedOrder.items.length,
      hasAddress: !!transformedOrder.address,
      hasShippingAddress: !!transformedOrder.shippingAddress,
      firstItemPrice: transformedOrder.items[0]?.pricePerItem,
      firstItemTotal: transformedOrder.items[0]?.totalPrice
    });

    res.status(200).json(transformedOrder);
  } catch (error) {
    console.error("❌ Error fetching single order:", error);
    res.status(500).json({ message: "Failed to fetch order details", error });
  }
});

// Create new order
router.post("/", authMiddleware, async (req: RequestWithUser, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" })
      return
    }

    const { address, products, discountCode } = req.body

    // Validate address
    const validAddress = await Address.findById(address)
    if (!validAddress) {
      res.status(400).json({ message: "Invalid address" })
      return
    }

    let subtotal = 0
    const orderItems = await Promise.all(
      products.map(async (item: { product: string; size: string; quantity: number; color?: string }) => {
        const product = await Product.findById(item.product)
        if (!product) {
          throw new Error(`Product ${item.product} not found`)
        }

        const price = product.pricePerItem * item.quantity
        subtotal += price

        // Enrich with image data
        const imageData = await enrichOrderItemWithImages(
          item.product,
          item.color || 'default',
          product.name
        )

        return {
          productId: item.product,
          productName: product.name,
          quantity: item.quantity,
          pricePerItem: product.pricePerItem,
          totalPrice: price,
          size: item.size,
          color: item.color || 'default',
          // Enhanced image storage
          primaryImage: imageData.primaryImage,
          fallbackImages: imageData.fallbackImages,
          imageMetadata: imageData.imageMetadata,
          // Legacy field for backward compatibility
          image: imageData.primaryImage.url,
        }
      }),
    )

    // Initialize order values
    let discountAmount = 0
    let discountCodeId = null
    let totalAmount = subtotal

    // Process discount code if provided
    if (discountCode) {
      // Find and validate the discount code
      const discount = await DiscountCode.findOne({
        code: discountCode.toUpperCase(),
        isActive: true,
        startDate: { $lte: new Date() },
        expiryDate: { $gte: new Date() },
      })

      if (!discount) {
        res.status(400).json({ message: "Invalid or expired discount code" })
        return
      }

      // Check usage limit
      if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
        res.status(400).json({ message: "Discount code usage limit reached" })
        return
      }

      // Check minimum purchase amount
      if (subtotal < discount.minPurchaseAmount) {
        res.status(400).json({
          message: `Minimum purchase amount of ${discount.minPurchaseAmount} required`,
          minPurchaseAmount: discount.minPurchaseAmount,
        })
        return
      }

      // Check product eligibility if applicable products are specified
      if (discount.applicableProducts.length > 0) {
        const orderProductIds = products.map((item: any) => item.product.toString())
        const eligibleProductIds = discount.applicableProducts.map((id: any) => id.toString())

        const hasEligibleProduct = orderProductIds.some((id: string) => eligibleProductIds.includes(id))

        if (!hasEligibleProduct) {
          res.status(400).json({ message: "Discount code not applicable to items in cart" })
          return
        }
      }

      // Check for excluded products
      if (discount.excludedProducts.length > 0) {
        const orderProductIds = products.map((item: any) => item.product.toString())
        const excludedProductIds = discount.excludedProducts.map((id: any) => id.toString())

        const hasExcludedProduct = orderProductIds.some((id: string) => excludedProductIds.includes(id))

        if (hasExcludedProduct) {
          res.status(400).json({ message: "Discount code not applicable to some items in cart" })
          return
        }
      }

      // Calculate discount amount
      if (discount.discountType === "percentage") {
        discountAmount = (subtotal * discount.discountValue) / 100
      } else {
        discountAmount = discount.discountValue
      }

      // Apply max discount cap if set
      if (discount.maxDiscountAmount !== null && discountAmount > discount.maxDiscountAmount) {
        discountAmount = discount.maxDiscountAmount
      }

      // Make sure discount doesn't exceed order total
      if (discountAmount > subtotal) {
        discountAmount = subtotal
      }

      discountCodeId = discount._id
      totalAmount = subtotal - discountAmount

      // Increment usage count for the discount code
      await DiscountCode.findByIdAndUpdate(
        discount._id,
        { $inc: { usageCount: 1 } }
      )
    }

    const newOrder = new Order({
      name: `Order-${Date.now()}`,
      user: req.user.userId,
      items: orderItems,
      subtotal: subtotal,
      amount: subtotal, // Keep for compatibility with existing code
      discountCode: discountCodeId,
      discountAmount: discountAmount,
      totalAmount: totalAmount,
      order_id: `order_${Date.now()}`,
      address,
      status: "pending"
    })

    await newOrder.save()

    // Log discount information if applied
    if (discountCodeId) {
      console.log("💰 Discount applied to order:", {
        orderId: newOrder._id,
        discountCode: discountCode,
        discountAmount: discountAmount,
        subtotal: subtotal,
        totalAfterDiscount: totalAmount
      });
    }

    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
      paymentInfo: {
        orderId: newOrder._id,
        amount: totalAmount, // Send the discounted amount for payment
      },
    })
  } catch (error) {
    console.error("❌ Order creation error:", error)
    res.status(400).json({ message: "Order creation failed", error })
  }
})

// Admin: Update order status
router.put("/:id", authMiddleware, authorizeRoles("admin"), async (req, res) => {
  try {
    const { status } = req.body

    if (!["pending", "completed", "failed"].includes(status)) {
      res.status(400).json({ message: "Invalid order status" })
      return
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )

    if (!updatedOrder) {
      res.status(404).json({ message: "Order not found" })
      return
    }

    res.status(200).json(updatedOrder)
  } catch (error) {
    res.status(500).json({ message: "Failed to update order", error })
  }
})

// Enhanced linking endpoints - TEMPORARILY COMMENTED OUT
/*
router.get('/:orderId/with-designs', authMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const order = await OrderLinkingService.getOrderWithDesignOrders(req.params.orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching order with design orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Enhanced status update with full validation and notifications
router.patch('/:orderId/status', statusUpdateMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { status, reason, notifyCustomer = true } = req.body;
    const changedBy = req.user?.userId || 'system';

    const result = await StatusManagementService.updateOrderStatus({
      orderId: req.params.orderId,
      newStatus: status,
      reason,
      changedBy,
      notifyCustomer
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Get order status history
router.get('/:orderId/status-history', authMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const history = await StatusManagementService.getOrderStatusHistory(req.params.orderId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching order status history:', error);
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.status(500).json({ message: 'Failed to fetch order status history' });
  }
});

router.get('/admin/linking-stats', authMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const stats = await OrderLinkingService.getOrderStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching linking statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
*/

export default router