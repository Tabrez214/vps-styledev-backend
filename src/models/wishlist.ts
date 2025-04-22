import mongoose, { Document, Schema } from "mongoose";

interface IWishlist extends Document {
    user: mongoose.Schema.Types.ObjectId;
    products: string[]; 
    createdAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        products: [{ type: String, ref: "Product" }] 
    },
    { timestamps: true }
);

const WishList = mongoose.model('wishlist', WishlistSchema);

export default WishList;
