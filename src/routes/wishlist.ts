import express, {  Response } from 'express';
import Product from '../models/product';
import WishList from '../models/wishlist';
import { authMiddleware, RequestWithUser } from '../middleware/authMiddleware';

const router = express();

router.post('/add', authMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { productId } = req.body;

        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const productExist = await Product.findById(productId);
        if (!productExist) {
            res.status(404).json({ message: "Product not found" });
            return;
        }

        let wishlist = await WishList.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new WishList({
                user: userId,
                products: [productId], // Store productId string directly
            });
        } else {
          const productIds = wishlist!.products.map((id: string) => id.toString());

            if (productIds.includes(productId)) {
                res.status(400).json({ message: "Product already in wishlist" });
                return;
            }
            wishlist!.products.push(productId); // Store productId string directly
        }

        await wishlist.save();
        res.status(200).json({ message: "Product added to wishlist", wishlist });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/', authMiddleware, async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" }); 
      return;
    }

    const wishlist = await WishList.findOne({ user: userId }).populate("products");

    if(!wishlist){
      res.status(404).json({ message: "Wishlist is empty", products: [] })
      return;
    }

    res.status(200).json({ products: wishlist.products });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
})

router.delete('/remove/:productId', authMiddleware, async(req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.params;

    if(!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const wishlist = await WishList.findOne({ user: userId });

    if(!wishlist) {
      res.status(404).json({ message: "Wishlist not found" });
      return;
    }

    wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);
    await wishlist.save();

    res.status(200).json({ message: "Product removed from wishlist", wishlist });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
