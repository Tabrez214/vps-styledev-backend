const axios = require("axios");

async function quickTest() {
  console.log("🔍 Testing backend endpoints...\n");

  try {
    // Test 1: Environment debug
    console.log("1. Testing environment debug endpoint...");
    const envResponse = await axios.get(
      "http://localhost:3001/api/payment/debug/env"
    );
    console.log("✅ Environment Debug - Success");
    console.log("Response:", JSON.stringify(envResponse.data, null, 2));

    // Test 2: Express checkout (minimal test)
    console.log("\n2. Testing express checkout endpoint...");
    const checkoutData = {
      amount: 100,
      items: [
        {
          productId: "507f1f77bcf86cd799439012",
          quantity: 1,
          price: 100,
        },
      ],
      guestInfo: {
        email: "test@example.com",
        phone: "+1234567890",
        name: "Test User",
      },
    };

    const checkoutResponse = await axios.post(
      "http://localhost:3001/api/payment/express-checkout",
      checkoutData
    );
    console.log("✅ Express Checkout - Success");
    console.log("Order ID:", checkoutResponse.data.order?.orderId);
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("❌ Backend server is not running on port 3001");
      console.log("Please start the backend with: npm run dev");
    } else {
      console.log("❌ Test failed:", error.response?.data || error.message);
    }
  }
}

quickTest();
