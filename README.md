# StyleDev Backend

A Node.js backend for the StyleDev e-commerce platform, built with Express and TypeScript.

## Features

- User Authentication with JWT
- OTP-based Email Verification
- Product Management
- Shopping Cart Functionality
- Order Processing
- Role-based Access Control

## Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB with Mongoose
- JWT for Authentication
- Nodemailer for Email
- Bcrypt for Password Hashing

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/yourusername/styledev-backend.git
cd styledev-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
PORT=3001
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_app_password
```

4. Start the development server:

```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/verify-otp` - Verify email OTP
- `POST /auth/resend-otp` - Resend verification OTP

### Products

- `GET /products` - Get all products
- `GET /products/:id` - Get product by ID
- `POST /products` - Create new product (Admin only)
- `PUT /products/:id` - Update product (Admin only)
- `DELETE /products/:id` - Delete product (Admin only)

### Cart

- `GET /cart` - Get user's cart
- `POST /cart/add` - Add items to cart
- `PATCH /cart/update` - Update cart item
- `DELETE /cart/remove/:productId` - Remove item from cart
- `DELETE /cart/clear` - Clear cart

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
