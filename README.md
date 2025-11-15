# Shop Backend

This small backend provides products and users endpoints used by a sample frontend.

Base URL: http://localhost:5000

Endpoints (summary):

- GET /api/products — list products (includes `stock`)
- GET /api/products/:id — single product (includes `stock`)

Users/cart endpoints:

- GET /users or /api/users — list users
- GET /users/:id or /api/users/:id — single user
- POST /users/:id/cart or /api/users/:id/cart — add item to cart
  - body: { itemId: number, quantity?: number }
  - Note: the server now enforces stock availability at add-to-cart time; requests that would exceed available stock return a 400 error.
- PATCH /users/:id/cart/:itemId or /api/users/:id/cart/:itemId — set quantity
  - body: { quantity: number }
- DELETE /users/:id/cart/:itemId or /api/users/:id/cart/:itemId — remove item from cart
- POST /users/:id/checkout or /api/users/:id/checkout — attempt checkout
  - Validates product existence and stock. On success decrements `products.json` stock and clears the user's cart.

Notes:

- Cart items are objects: { itemId, quantity }.
- `CartItemsLength.items` is the sum of quantities in the user's cart.

Quick test:

1. Start server:

```powershell
node index.js
```

2. Run the quick test script (server must be running):

```powershell
npm run test-users
```

This will exercise add/update/checkout flows and print results.
