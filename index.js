// index.js - Optimized production-ready backend
import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cluster from "cluster";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, "products.json");
const USERS_FILE = join(__dirname, "users.json");
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "production";
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === "true";

// In-memory caches with TTL (5 seconds)
const CACHE_TTL = 5000;
let productCache = { data: null, time: 0 };
let userCache = { data: null, time: 0 };

function isCacheValid(cache) {
  return cache.data && Date.now() - cache.time < CACHE_TTL;
}

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation middleware
function validateUserId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  req.userId = id;
  next();
}

function validateProductId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid product ID" });
  }
  req.productId = id;
  next();
}

const app = express();

// Middleware stack (optimized order)
app.use(compression()); // gzip compression
app.use(cors()); // CORS
app.use(express.json({ limit: "10kb" })); // body parser with size limit
app.use(limiter); // rate limiting

// File I/O helpers with caching
async function readProducts() {
  if (isCacheValid(productCache)) {
    return productCache.data;
  }
  const raw = await readFile(DATA_FILE, "utf8");
  const data = JSON.parse(raw);
  productCache = { data, time: Date.now() };
  return data;
}

async function readUsers() {
  if (isCacheValid(userCache)) {
    return userCache.data;
  }
  const raw = await readFile(USERS_FILE, "utf8");
  const data = JSON.parse(raw);
  userCache = { data, time: Date.now() };
  return data;
}

async function writeUsers(users) {
  const output =
    NODE_ENV === "production"
      ? JSON.stringify(users)
      : JSON.stringify(users, null, 2);
  await writeFile(USERS_FILE, output, "utf8");
  userCache = { data: users, time: Date.now() };
}

async function writeProducts(products) {
  const output =
    NODE_ENV === "production"
      ? JSON.stringify(products)
      : JSON.stringify(products, null, 2);
  await writeFile(DATA_FILE, output, "utf8");
  productCache = { data: products, time: Date.now() };
}
function averageRating(comments) {
  if (!comments || comments.length === 0) return null;
  const sum = comments.reduce((s, c) => s + (c.rating || 0), 0);
  return +(sum / comments.length).toFixed(2);
}

// Routes

// GET /api/products
app.get("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    res.set("Cache-Control", "public, max-age=5");
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read products" });
  }
});

// GET /api/products/:id
app.get("/api/products/:id", validateProductId, async (req, res) => {
  try {
    const id = req.productId;
    const products = await readProducts();
    const product = products.find((p) => p.id === id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const productWithRating = {
      ...product,
      rating: averageRating(product.comments),
    };
    res.set("Cache-Control", "public, max-age=5");
    res.json(productWithRating);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read product" });
  }
});

// POST /api/products/:id/comments
app.post("/api/products/:id/comments", validateProductId, async (req, res) => {
  try {
    const id = req.productId;
    const { user, text, rating } = req.body;

    // Trim and sanitize
    const trimmedUser =
      user && typeof user === "string" ? user.trim().slice(0, 100) : null;
    const trimmedText =
      text && typeof text === "string" ? text.trim().slice(0, 500) : null;

    if (!trimmedUser || !trimmedText) {
      return res.status(400).json({ error: "user and text are required" });
    }

    const numericRating = Number(rating);
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({ error: "rating must be 1-5 integer" });
    }

    const products = await readProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    // Limit comments per product
    if (!products[idx].comments) products[idx].comments = [];
    if (products[idx].comments.length >= 1000) {
      return res
        .status(400)
        .json({ error: "Too many comments on this product" });
    }

    products[idx].comments.push({
      user: trimmedUser,
      text: trimmedText,
      rating: numericRating,
    });

    await writeProducts(products);

    res.status(201).json({
      ...products[idx],
      rating: averageRating(products[idx].comments),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save comment" });
  }
});

// GET /api/users
app.get("/api/users", async (req, res) => {
  try {
    const users = await readUsers();
    res.set("Cache-Control", "public, max-age=5");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read users" });
  }
});

// GET /api/users/:id
app.get("/api/users/:id", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const users = await readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.set("Cache-Control", "public, max-age=5");
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read user" });
  }
});

// POST /api/users/:id/cart
app.post("/api/users/:id/cart", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const { itemId, quantity = 1 } = req.body;

    if (
      typeof itemId !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({ error: "itemId and quantity required" });
    }

    const products = await readProducts();
    const product = products.find((p) => p.id === itemId);
    if (!product)
      return res.status(400).json({ error: "itemId does not exist" });

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = users[idx].cartItems || [];

    // Limit cart size
    if (users[idx].cartItems.length >= 100) {
      return res.status(400).json({ error: "Cart is full" });
    }

    const existing = users[idx].cartItems.find((ci) => ci.itemId === itemId);
    const existingQty = existing ? existing.quantity : 0;

    if (
      typeof product.stock === "number" &&
      existingQty + quantity > product.stock
    ) {
      return res.status(400).json({
        error: `Requested quantity exceeds stock for product ${itemId}`,
      });
    }

    if (existing) {
      existing.quantity += quantity;
    } else {
      users[idx].cartItems.push({ itemId, quantity });
    }

    users[idx].CartItemsLength = {
      items: users[idx].cartItems.reduce((s, c) => s + c.quantity, 0),
    };

    await writeUsers(users);
    res.status(201).json(users[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add cart item" });
  }
});

// PATCH /api/users/:id/cart/:itemId
app.patch("/api/users/:id/cart/:itemId", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res
        .status(400)
        .json({ error: "quantity must be non-negative integer" });
    }

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
      items: users[uidx].cartItems.reduce((s, c) => s + c.quantity, 0),
    };

    await writeUsers(users);
    res.json(users[uidx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

// DELETE /api/users/:id/cart/:itemId
app.delete("/api/users/:id/cart/:itemId", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const itemId = Number(req.params.itemId);

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = (users[idx].cartItems || []).filter(
      (ci) => ci.itemId !== itemId
    );

    users[idx].CartItemsLength = {
      items: users[idx].cartItems.reduce((s, c) => s + c.quantity, 0),
    };

    await writeUsers(users);
    res.json(users[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
});

// POST /api/users/:id/checkout
app.post("/api/users/:id/checkout", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const users = await readUsers();
    const products = await readProducts();

    const uidx = users.findIndex((u) => u.id === id);
    if (uidx === -1) return res.status(404).json({ error: "User not found" });

    const cart = users[uidx].cartItems || [];
    if (cart.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    // Validate stock
    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      if (!prod)
        return res
          .status(400)
          .json({ error: `Product ${ci.itemId} not found` });

      const qty = ci.quantity || 0;
      if (typeof prod.stock !== "number" || prod.stock < qty) {
        return res.status(400).json({
          error: `Insufficient stock for product ${ci.itemId}`,
        });
      }
    }

    // Decrement stock
    for (const ci of cart) {
      const prod = products.find((p) => p.id === ci.itemId);
      prod.stock -= ci.quantity || 0;
    }

    // Clear cart
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

// Optimized static file serving with caching
app.use(
  "/images",
  express.static("images", {
    maxAge: "1d",
    etag: false,
    lastModified: false,
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Server startup function
function startServer() {
  app.listen(PORT, () => {
    console.log(
      `[${new Date().toISOString()}] API listening on port ${PORT} (${NODE_ENV})`
    );
  });
}

// Clustering for multi-core systems
if (ENABLE_CLUSTERING && cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary process ${process.pid} starting ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  startServer();
}
