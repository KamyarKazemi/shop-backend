# Shop Backend - Mock E-Commerce API

> **⚠️ Important**: This is a **completely mock backend** created with **AI** for a frontend portfolio project. It is **not intended for real production use**.
>
> **🚀 Status**: Running on **Render**

---

## About Me

I'm **Kamyar Kazemi**, a junior front-end developer specializing in React and modern UI engineering. My focus is on building optimized, scalable, and user-centric web applications that deliver real business value. I approach every project with a problem-solving mindset, and I continually challenge assumptions to ensure each solution is both efficient and maintainable.

I work with a forward-thinking attitude, keeping performance, accessibility, and code clarity at the center of my workflow. While I'm early in my professional journey, I bring strong fundamentals, hands-on project experience, and a commitment to continuous learning. I thrive in collaborative environments where I can contribute to product growth, refine existing workflows, and push the quality bar higher through careful attention to detail.

My goal is to support engineering teams by developing clean React components, reusable UI logic, responsive layouts, and well-structured front-end architecture. I'm driven to make creative interfaces that align with real user needs, while maintaining realistic constraints around timelines, performance budgets, and team goals.

With a proactive mindset and a strong appetite for improvement, I'm ready to take ownership of front-end tasks, contribute meaningful code, and grow into a dependable, long-term asset for any modern development team.

---

## What This Project Is

This backend was created **entirely with AI** to support my React portfolio project. As a junior front-end developer focused on building React applications, I used AI to generate a complete backend API that I can integrate with my React projects.

### Why I Created This

- I needed a realistic backend API for my React portfolio projects
- As a frontend-focused developer, generating backend code with AI accelerated my workflow
- It demonstrates my ability to understand, evaluate, and integrate AI-generated code
- Shows practical full-stack thinking and integration skills for a junior developer
- Allows me to focus on what I do best: building amazing React UIs

### Built With

- **Runtime:** Node.js
- **Framework:** Express.js
- **Storage:** JSON (in-memory cached)
- **Hosting:** Render (free tier)
- **Created:** 100% with AI assistance

---

## What This Backend Does

This is a **mock e-commerce API** with complete shopping cart functionality.

### ✅ What It's Good For

- **React Portfolio Projects** - Pair with React to demonstrate full-stack capability
- **Learning API Integration** - Understand how to consume REST APIs in React
- **Frontend Prototyping** - Quick backend for showcasing React features
- **Portfolio Completeness** - Show you can work with real backend APIs
- **Understanding Backend Patterns** - See CRUD operations, data modeling, caching in action

### ❌ What It's NOT Good For

- **Real E-Commerce** - No payment processing, no security for transactions
- **Production Use** - Loses all data on restart, no database
- **Real Customers** - Not designed to handle real business logic
- **Sensitive Data** - Everything resets when service restarts
- **Authentication** - No real user management or security
- **Long-Term Storage** - JSON files are temporary, not persistent

---

## API Endpoints

### Base URL

```
https://shop-backend.onrender.com
```

### Available Endpoints

**Products:**

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products/:id/comments` - Add product review

**Users & Shopping Cart:**

- `GET /api/users` - Get all users
- `POST /api/users/:id/cart` - Add item to cart
- `PATCH /api/users/:id/cart/:itemId` - Update item quantity
- `DELETE /api/users/:id/cart/:itemId` - Remove from cart
- `POST /api/users/:id/checkout` - Complete purchase

**Health:**

- `GET /health` - Server status check

---

## Using With React

This backend integrates seamlessly with React applications.

### Example React Code

```javascript
import { useEffect, useState } from "react";

function Products() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("https://shop-backend.onrender.com/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data));
  }, []);

  return (
    <div>
      {products.map((product) => (
        <div key={product.id}>
          <h3>{product.title}</h3>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  );
}
```

### What You Can Build

- Product listing pages
- Product detail pages
- Shopping cart functionality
- Checkout flow
- User account pages
- Order history display

---

## Getting Started Locally

```bash
# Clone the repository
git clone <repo-url>
cd shop-backend

# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:5000
```

### Environment Setup

Copy `.env.example` to `.env` and customize if needed:

```
NODE_ENV=production
PORT=5000
ENABLE_CLUSTERING=false
```

---

## How It Works

### Data Structure

**Products:**

```json
{
  "id": 1,
  "title": "iPhone 15 Pro",
  "price": 999,
  "stock": 50,
  "image": "url-to-image",
  "comments": [
    {
      "author": "John",
      "text": "Great product!",
      "rating": 5
    }
  ]
}
```

**Users:**

```json
{
  "id": 1,
  "cartItems": [{ "itemId": 1, "quantity": 2 }],
  "CartItemsLength": { "items": 2 }
}
```

### Features

- ✅ In-memory caching (5 second TTL)
- ✅ Gzip compression on responses
- ✅ Rate limiting (100 requests per 15 minutes per IP)
- ✅ Input validation and sanitization
- ✅ Stock inventory management
- ✅ Shopping cart with quantity tracking
- ✅ Health monitoring endpoint

---

## Running on Render

This service is hosted on **Render** (free tier) at:

```
https://shop-backend.onrender.com
```

### How Deployment Works

- Code is automatically deployed when you push to GitHub
- Free tier may sleep after inactivity (automatically wakes up on request)
- No manual deployment steps needed
- Dashboard available at render.com for monitoring

---

## Important: This Is Mock Data

⚠️ **Know the limitations:**

- All data is **completely lost** when the service restarts
- No real database - just JSON files
- No authentication system
- No actual payment processing
- Free Render tier may take a few seconds to wake up if idle
- Not suitable for storing any real information

### This Is Great For Learning

Even though it's mock, you'll learn:

- Real REST API patterns
- How backend data flows to frontend
- CRUD operations (Create, Read, Update, Delete)
- API error handling in React
- Performance concepts (caching, compression)
- Cloud deployment basics

---

## Code Quality

The code is production-grade in structure and patterns:

- Clean, readable code
- Proper error handling
- Input validation
- Security best practices (rate limiting, input sanitization)
- Performance optimizations

This serves as a good reference for understanding real backend architecture.

---

## Testing the API

### Using curl

```bash
# Get all products
curl https://shop-backend.onrender.com/api/products

# Get single product
curl https://shop-backend.onrender.com/api/products/1

# Check health
curl https://shop-backend.onrender.com/health
```

### Using Postman

Import the endpoints above into Postman to test:

1. Add requests for each endpoint
2. Try different query parameters
3. Test POST/PATCH/DELETE operations

---

## For Real Projects

If you're building a real application, you'll need:

- **Database:** PostgreSQL, MongoDB, or similar
- **Authentication:** JWT, OAuth, or session-based
- **Payment Processing:** Stripe, PayPal integration
- **Persistent Storage:** Professional database
- **Security:** HTTPS, data encryption, secure auth
- **Professional Hosting:** AWS, DigitalOcean, etc.

---

## License

ISC

---

**Created with AI | Built for React Portfolio Projects | Hosted on Render**

_This mock backend exists to help junior frontend developers like myself learn how to integrate with real APIs while focusing on what we do best - building amazing React interfaces._
