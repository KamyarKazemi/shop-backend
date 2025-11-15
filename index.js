// index.js
import express from "express";
import cors from "cors";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, "products.json");
const USERS_FILE = join(__dirname, "users.json");
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json()); // body parser

// helpers
async function readProducts() {
  const raw = await readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}
async function readUsers() {
  const raw = await readFile(USERS_FILE, "utf8");
  return JSON.parse(raw);
}
async function writeUsers(users) {
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}
async function writeProducts(products) {
  // pretty print with 2 spaces
  await writeFile(DATA_FILE, JSON.stringify(products, null, 2), "utf8");
}
function averageRating(comments) {
  if (!comments || comments.length === 0) return null;
  const sum = comments.reduce((s, c) => s + (c.rating || 0), 0);
  return +(sum / comments.length).toFixed(2);
}

// Routes
app.get("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const products = await readProducts();
    const product = products.find((p) => p.id === id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const productWithRating = {
      ...product,
      rating: averageRating(product.comments),
    };
    res.json(productWithRating);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read product" });
  }
});

app.post("/api/products/:id/comments", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { user, text, rating } = req.body;

    // basic validation
    if (!user || !text)
      return res.status(400).json({ error: "user and text are required" });
    const numericRating = Number(rating);
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res
        .status(400)
        .json({ error: "rating must be an integer between 1 and 5" });
    }

    // read -> modify -> write
    const products = await readProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    const comment = { user, text, rating: numericRating };
    products[idx].comments = products[idx].comments || [];
    products[idx].comments.push(comment);

    await writeProducts(products);

    // return the updated product (with recomputed rating)
    const updated = {
      ...products[idx],
      rating: averageRating(products[idx].comments),
    };
    res.status(201).json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save comment" });
  }
});

// Users endpoint
app.get("/users", async (req, res) => {
  try {
    const users = await readUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read users" });
  }
});

// get single user
app.get("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const users = await readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read user" });
  }
});

// add an item to user's cart: body { itemId: number }
app.post("/users/:id/cart", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { itemId, quantity = 1 } = req.body;
    if (
      typeof itemId !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    )
      return res.status(400).json({
        error: "itemId (number) and quantity (positive integer) are required",
      });

    // validate product exists
    const products = await readProducts();
    const product = products.find((p) => p.id === itemId);
    if (!product)
      return res.status(400).json({ error: "itemId does not exist" });

    // enforce stock at add-to-cart time
    const existingQty =
      (users[idx] &&
        users[idx].cartItems &&
        users[idx].cartItems.find((ci) => ci.itemId === itemId) &&
        users[idx].cartItems.find((ci) => ci.itemId === itemId).quantity) ||
      0;
    if (
      typeof product.stock === "number" &&
      existingQty + quantity > product.stock
    ) {
      return res.status(400).json({
        error: `Requested quantity exceeds stock for product ${itemId}`,
      });
    }

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = users[idx].cartItems || [];
    // if exists, increment quantity
    const existing = users[idx].cartItems.find((ci) => ci.itemId === itemId);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + quantity;
    } else {
      users[idx].cartItems.push({ itemId, quantity });
    }

    users[idx].CartItemsLength = {
      items: users[idx].cartItems.reduce((s, c) => s + (c.quantity || 0), 0),
    };

    await writeUsers(users);

    res.status(201).json(users[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add cart item" });
  }
});

// update quantity for an item in cart
app.patch("/users/:id/cart/:itemId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body;
    if (!Number.isInteger(quantity) || quantity < 0)
      return res
        .status(400)
        .json({ error: "quantity must be a non-negative integer" });

    const users = await readUsers();
    const uidx = users.findIndex((u) => u.id === id);
    if (uidx === -1) return res.status(404).json({ error: "User not found" });

    users[uidx].cartItems = users[uidx].cartItems || [];
    const ciIdx = users[uidx].cartItems.findIndex((ci) => ci.itemId === itemId);
    if (ciIdx === -1)
      return res.status(404).json({ error: "Cart item not found" });

    if (quantity === 0) {
      users[uidx].cartItems.splice(ciIdx, 1);
    } else {
      users[uidx].cartItems[ciIdx].quantity = quantity;
    }

    users[uidx].CartItemsLength = {
      items: users[uidx].cartItems.reduce((s, c) => s + (c.quantity || 0), 0),
    };

    await writeUsers(users);
    res.json(users[uidx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

// checkout: decrement stock for each item if available and clear cart
app.post("/users/:id/checkout", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const users = await readUsers();
    const products = await readProducts();
    const uidx = users.findIndex((u) => u.id === id);
    if (uidx === -1) return res.status(404).json({ error: "User not found" });

    const cart = users[uidx].cartItems || [];
    if (cart.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    // validate stock
    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      if (!prod)
        return res
          .status(400)
          .json({ error: `Product ${ci.itemId} not found` });
      const qty = ci.quantity || 0;
      if (typeof prod.stock !== "number" || prod.stock < qty)
        return res
          .status(400)
          .json({ error: `Insufficient stock for product ${ci.itemId}` });
    }

    // decrement stock
    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      prod.stock -= ci.quantity || 0;
    }

    // clear user's cart
    users[uidx].cartItems = [];
    users[uidx].CartItemsLength = { items: 0 };

    await writeProducts(products);
    await writeUsers(users);

    res.json({ success: true, remainingProducts: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

// provide /api/users aliases for consistency
app.get("/api/users", async (req, res) => {
  try {
    const users = await readUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read users" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const users = await readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read user" });
  }
});

// api aliases for cart/patch/checkout
app.post("/api/users/:id/cart", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { itemId, quantity = 1 } = req.body;
    if (
      typeof itemId !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    )
      return res.status(400).json({
        error: "itemId (number) and quantity (positive integer) are required",
      });

    const products = await readProducts();
    const product = products.find((p) => p.id === itemId);
    if (!product)
      return res.status(400).json({ error: "itemId does not exist" });

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = users[idx].cartItems || [];
    const existing = users[idx].cartItems.find((ci) => ci.itemId === itemId);
    // enforce stock at add-to-cart time for API alias as well
    const existingApiQty = existing ? existing.quantity || 0 : 0;
    if (
      typeof product.stock === "number" &&
      existingApiQty + quantity > product.stock
    ) {
      return res.status(400).json({
        error: `Requested quantity exceeds stock for product ${itemId}`,
      });
    }
    if (existing) {
      existing.quantity = (existing.quantity || 0) + quantity;
    } else {
      users[idx].cartItems.push({ itemId, quantity });
    }

    users[idx].CartItemsLength = {
      items: users[idx].cartItems.reduce((s, c) => s + (c.quantity || 0), 0),
    };

    await writeUsers(users);
    res.status(201).json(users[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add cart item" });
  }
});

app.patch("/api/users/:id/cart/:itemId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body;
    if (!Number.isInteger(quantity) || quantity < 0)
      return res
        .status(400)
        .json({ error: "quantity must be a non-negative integer" });

    const users = await readUsers();
    const uidx = users.findIndex((u) => u.id === id);
    if (uidx === -1) return res.status(404).json({ error: "User not found" });

    users[uidx].cartItems = users[uidx].cartItems || [];
    const ciIdx = users[uidx].cartItems.findIndex((ci) => ci.itemId === itemId);
    if (ciIdx === -1)
      return res.status(404).json({ error: "Cart item not found" });

    if (quantity === 0) {
      users[uidx].cartItems.splice(ciIdx, 1);
    } else {
      users[uidx].cartItems[ciIdx].quantity = quantity;
    }

    users[uidx].CartItemsLength = {
      items: users[uidx].cartItems.reduce((s, c) => s + (c.quantity || 0), 0),
    };

    await writeUsers(users);
    res.json(users[uidx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

app.post("/api/users/:id/checkout", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const users = await readUsers();
    const products = await readProducts();
    const uidx = users.findIndex((u) => u.id === id);
    if (uidx === -1) return res.status(404).json({ error: "User not found" });

    const cart = users[uidx].cartItems || [];
    if (cart.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      if (!prod)
        return res
          .status(400)
          .json({ error: `Product ${ci.itemId} not found` });
      const qty = ci.quantity || 0;
      if (typeof prod.stock !== "number" || prod.stock < qty)
        return res
          .status(400)
          .json({ error: `Insufficient stock for product ${ci.itemId}` });
    }

    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      prod.stock -= ci.quantity || 0;
    }

    users[uidx].cartItems = [];
    users[uidx].CartItemsLength = { items: 0 };

    await writeProducts(products);
    await writeUsers(users);

    res.json({ success: true, remainingProducts: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

// remove an item from user's cart
app.delete("/users/:id/cart/:itemId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = (users[idx].cartItems || []).filter(
      (ci) => ci.itemId !== itemId
    );
    users[idx].CartItemsLength = {
      items: users[idx].cartItems.reduce((s, c) => s + (c.quantity || 0), 0),
    };

    await writeUsers(users);

    res.json(users[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
});

// catch-all error
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

app.use("/images", express.static("images"));

app.listen(PORT, () => {
  console.log(`Products API listening at http://localhost:${PORT}`);
});
