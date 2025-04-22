import request from "supertest";
import mongoose from "mongoose";
import Product from "../src/models/product";
import WishList from "../src/models/wishlist";
import { authMiddleware } from "../src/middleware/authMiddleware";
import { app } from "../src/index"; // Import the app from the main file

let userToken: string;
let testProductId: string;

beforeAll(async () => {
  // Connect to an in-memory MongoDB
  await mongoose.connect("mongodb://127.0.0.1:27017/testdb");

  // Create a test product in the database
  const product = new Product({
    name: "Test Product",
    description: "A test product",
    pricePerItem: 50,
    minimumOrderQuantity: 1,
    sizes: { S: 10, M: 15, L: 20 },
    colors: [{ name: "Red", hexCode: "#FF0000" }],
    designFiles: [],
  });

  await product.save();
  // Fix the type issue by using type assertion
  testProductId = (product._id as mongoose.Types.ObjectId).toString();

  // Generate a test user token (Mock JWT)
  userToken = "Bearer mock-jwt-token"; // Replace with real JWT in real tests
});

afterAll(async () => {
  await Product.deleteMany({});
  await WishList.deleteMany({});
  await mongoose.connection.close();
});

describe("Wishlist API Tests", () => {
  
  // ✅ Test: Add Product to Wishlist
  it("should add a product to the wishlist", async () => {
    const res = await request(app)
      .post("/wishlist/add")
      .set("Authorization", userToken)
      .send({ productId: testProductId });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product added to wishlist");
    expect(res.body.wishlist.products).toContain(testProductId);
  });

  // ✅ Test: Fetch Wishlist
  it("should return the user's wishlist", async () => {
    const res = await request(app)
      .get("/wishlist")
      .set("Authorization", userToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  // ✅ Test: Prevent Duplicate Additions
  it("should not add the same product twice", async () => {
    const res = await request(app)
      .post("/wishlist/add")
      .set("Authorization", userToken)
      .send({ productId: testProductId });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Product already in wishlist");
  });

  // ✅ Test: Remove Product from Wishlist
  it("should remove a product from the wishlist", async () => {
    const res = await request(app)
      .delete(`/wishlist`)
      .set("Authorization", userToken)
      .send({ productId: testProductId });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Product removed from wishlist");
  });

  // ✅ Test: Prevent Removal of Non-Existing Product
  it("should return 404 if the product is not in the wishlist", async () => {
    const res = await request(app)
      .delete(`/wishlist`)
      .set("Authorization", userToken)
      .send({ productId: testProductId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Wishlist not found");
  });

  // ✅ Test: Unauthorized Access
  it("should return 401 for unauthorized requests", async () => {
    const res = await request(app)
      .get("/wishlist");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  // ✅ Test: Invalid Product ID
  it("should return 400 for invalid product ID", async () => {
    const res = await request(app)
      .post("/wishlist/add")
      .set("Authorization", userToken)
      .send({ productId: "invalid-id" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid product ID");
  });

});
