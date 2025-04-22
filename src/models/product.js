"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var color_1 = require("./color");
var ProductSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    pricePerItem: { type: Number, required: true },
    minimumOrderQuantity: { type: Number, required: true },
    sizes: [
        {
            size: {
                type: String,
                enum: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
                required: true,
            },
            stock: { type: Number, default: 0 },
        },
    ],
    colors: [{ type: color_1.default.schema, required: true }],
    images: [
        {
            url: { type: String, required: true },
            caption: { type: String },
            isDefault: { type: Boolean, default: false },
        },
    ],
    categories: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Category", required: true }],
    isActive: { type: Boolean, default: true }, // Default is active
}, { timestamps: true });
var Product = mongoose_1.default.model("Product", ProductSchema);
exports.default = Product;
