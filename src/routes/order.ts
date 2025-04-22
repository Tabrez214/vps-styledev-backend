import express, { type Response } from "express"
import { authMiddleware, type RequestWithUser } from "../middleware/authMiddleware"
import { authorizeRoles } from "../middleware/roleMiddleware"
import Order from "../models/order"
import Product from "../models/product"
import Address from "../models/address"
import DiscountCode from "../models/discount-codes"

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
      .select('order_id subtotal discountAmount totalAmount status createdAt items')
      .populate({
        path: 'items.productId',
        select: 'name images',
        model: 'Product'
      })
      .populate({
        path: 'address',
        select: 'fullName phoneNumber streetAddress city state country postalCode'
      })
      .populate({
        path: 'discountCode',
        select: 'code discountType discountValue',
        model: 'DiscountCode'
      })
      .lean();

    // Transform the response
    const cleanedOrders = orders.map(order => ({
      orderId: order.order_id,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      discountCode: order.discountCode ? {
        code: (order.discountCode as any).code,
        type: (order.discountCode as any).discountType,
        value: (order.discountCode as any).discountValue
      } : null,
      totalAmount: order.totalAmount,
      status: order.status,
      orderDate: order.createdAt,
      items: order.items.map((item: any) => ({
        productName: item.productId.name,
        quantity: item.quantity,
        pricePerItem: item.price,
        totalPrice: item.price * item.quantity,
        image: item.productId.images.find((img: any) => img.isDefault)?.url || item.productId.images[0]?.url
      })),
      shippingAddress: {
        fullName: (order.address as any)?.fullName,
        phoneNumber: (order.address as any)?.phoneNumber,
        address: (order.address as any)?.streetAddress,
        city: (order.address as any)?.city,
        state: (order.address as any)?.state,
        country: (order.address as any)?.country,
        postalCode: (order.address as any)?.postalCode
      }
    }));

    res.status(200).json(cleanedOrders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ message: "Fetching orders failed", error });
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
      products.map(async (item: { product: string; size: string; quantity: number }) => {
        const product = await Product.findById(item.product)
        if (!product) {
          throw new Error(`Product ${item.product} not found`)
        }
        const price = product.pricePerItem * item.quantity
        subtotal += price

        return {
          productId: item.product,
          quantity: item.quantity,
          price: product.pricePerItem
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

export default router