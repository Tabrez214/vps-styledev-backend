import express, { Response } from 'express';
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';
import Cart from '../models/cart';
import Product from '../models/product';

const router = express.Router();

router.post("/add", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized: User not found" });
      return;
    }

    const userId = req.user.userId;
    const { products } = req.body;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, products: [], totalAmount: 0 });
    }

    let totalAmount = cart.totalAmount;

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(404).json({ message: `Product ${item.product} not found` });
        return;
      }

      // Check stock availability
      let hasStock = false;
      let stockQuantity = 0;
      
      // Log the product sizes for debugging
      console.log('Product sizes:', product.sizes);
      console.log('Requested size:', item.size);
      console.log('Requested quantity:', item.quantity);

      // Find the size object in the array
      const sizeObj = product.sizes && Array.isArray(product.sizes)
        ? product.sizes.find((s: any) => s.size === item.size)
        : null;

      if (sizeObj) {
        stockQuantity = sizeObj.stock;
        hasStock = stockQuantity >= item.quantity;
      } else {
        // Fallback: If specific size is not individually tracked in product.sizes, check overall product stock
        stockQuantity = product.stock || 9999;
        hasStock = stockQuantity >= item.quantity;
      }

      console.log('Stock check result:', {
        hasStock,
        stockQuantity,
        requestedQuantity: item.quantity,
        sizeFound: !!sizeObj
      });

      if (!hasStock) {
        res.status(400).json({ 
          message: `Insufficient stock for ${item.size}. Available: ${stockQuantity}, Requested: ${item.quantity}` 
        });
        return;
      }

      const existingProduct = cart.products.find(
        (p: any) => p.product.toString() === item.product && p.size === item.size && p.color === (item.color || product.colors[0]?.name)
      );

      // Resolve the correct color name — use frontend-provided color, fallback to first available
      const resolvedColor = item.color || product.colors[0]?.name || '';

      // Resolve product image for the selected color
      const matchingColorObj = product.colors.find((c: any) => c.name === resolvedColor);
      const resolvedImageUrl = matchingColorObj?.images?.find((img: any) => img.isDefault)?.url
        || matchingColorObj?.images?.[0]?.url
        || product.images?.[0]?.url
        || '';

      if (existingProduct) {
        existingProduct.quantity += item.quantity;
        existingProduct.totalPrice += product.pricePerItem * item.quantity;
      } else {
        cart.products.push({
          product: item.product,
          productName: product.name,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: product.pricePerItem,
          totalPrice: product.pricePerItem * item.quantity,
          color: resolvedColor,
          imageUrl: resolvedImageUrl,
        });
      }

      totalAmount += product.pricePerItem * item.quantity;
    }

    cart.totalAmount = cart.products.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    await cart.save();

    res.status(201).json({ message: "Added to Cart.", cart });
  } catch (error) {
    console.error("❌ Add to Cart error:", error);
    res.status(400).json({ message: "Add to cart failed", error });
  }
});

router.get('/', authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    console.log("Fetch Cart request received");

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const cart = await Cart.findOne({ user: req.user.userId }).populate('products.product');

    if (!cart) {
      res.status(404).json({ message: "Cart is empty", products: [] });
      return;
    }

    const recalculatedTotal = cart.products.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    if (cart.totalAmount !== recalculatedTotal) {
      cart.totalAmount = recalculatedTotal;
      await cart.save();
    }

    const response = {
      products: cart.products.map((item: any) => ({
        productId: (item.product as any)._id,
        productName: item.productName || (item.product as any).name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        pricePerItem: item.pricePerItem,
        totalPrice: item.totalPrice,
        imageUrl: item.imageUrl || (item.product as any).images?.find((image: { isDefault: any; }) => image.isDefault)?.url || (item.product as any).images?.[0]?.url
      })),
      totalAmount: recalculatedTotal
    };

    console.log("Cart fetched:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("X Fetch Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/update", authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { productId, size, quantity, color } = req.body;

    if (!productId || !size || quantity === undefined) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const cart = await Cart.findOne({ user: req.user.userId });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    const productIndex = cart.products.findIndex(
      (item: any) => item.product.toString() === productId && item.size === size && (!color || item.color === color)
    );

    if (productIndex === -1) {
      res.status(404).json({ message: "Product not found in cart" });
      return;
    }

    const cartProduct = cart.products[productIndex];

    // Fetch latest product details
    const product = await Product.findById(productId);

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Check if stock is available
    let hasStock = false;
    let stockQuantity = 0;
    
    // Find the size object in the array
    const sizeObj = product.sizes && Array.isArray(product.sizes)
      ? product.sizes.find((s: any) => s.size === size)
      : null;

    if (sizeObj) {
      stockQuantity = sizeObj.stock;
      hasStock = stockQuantity >= quantity;
    } else {
      // Fallback: If specific size is not individually tracked in product.sizes, check overall product stock
      stockQuantity = product.stock || 9999;
      hasStock = stockQuantity >= quantity;
    }

    console.log('Stock check result:', {
      hasStock,
      stockQuantity,
      requestedQuantity: quantity,
      sizeFound: !!sizeObj
    });

    if (!hasStock) {
      res.status(400).json({ 
        message: `Insufficient stock for ${size}. Available: ${stockQuantity}, Requested: ${quantity}` 
      });
      return;
    }

    // Update product quantity and total price
    cartProduct.quantity = quantity;
    cartProduct.pricePerItem = product.pricePerItem;
    cartProduct.totalPrice = product.pricePerItem * quantity;

    // Recalculate total amount in the cart
    cart.totalAmount = cart.products.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

    await cart.save();

    res.status(200).json({ message: "Cart updated", cart });
  } catch (error) {
    console.error("❌ Update cart error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete('/remove/:productId', authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    console.log("Remove from Cart request received:", req.params.productId);

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { productId } = req.params;
    const { color, size } = req.query;

    const cart = await Cart.findOne({ user: req.user.userId });
    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    // Filter by productId, and optionally by color and size to avoid removing all variants
    cart.products = cart.products.filter((item: any) => {
      const matchesProduct = item.product.toString() === productId;
      if (!matchesProduct) return true; // keep items that don't match productId
      // If color/size specified, only remove the exact match
      if (color && item.color !== color) return true;
      if (size && item.size !== size) return true;
      return false; // remove this item
    });
    cart.totalAmount = cart.products.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

    await cart.save();

    console.log("Cart after removing product:", cart);
    res.status(200).json({ message: "Product removed from cart", cart });
  } catch (error) {
    console.error("X Remove from cart error: ", error);
    res.status(500).json({ message: "Server error " });
  }
});

router.delete('/clear', authMiddleware, async (req: RequestWithUser, res: Response) => {
  try {
    console.log("Clear Cart request received");

    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    await Cart.findOneAndDelete({ user: req.user.userId });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error("X Clear cart error: ", error);
    res.status(500).json({ message: "Server error " });
  }
});

export default router;