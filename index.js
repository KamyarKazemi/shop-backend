// index.js - Production-optimized backend
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
const IMAGES_DIR = join(__dirname, "images");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "production";
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === "true";

// Cache TTL
const CACHE_TTL = 5000;
let productCache = { data: null, time: 0 };
let userCache = { data: null, time: 0 };

function isCacheValid(cache) {
  return cache.data && Date.now() - cache.time < CACHE_TTL;
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests",
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(limiter);

// File operations
async function readProducts() {
  if (isCacheValid(productCache)) return productCache.data;
  const raw = await readFile(DATA_FILE, "utf8");
  const data = JSON.parse(raw);
  productCache = { data, time: Date.now() };
  return data;
}

async function writeProducts(products) {
  await writeFile(
    DATA_FILE,
    NODE_ENV === "production"
      ? JSON.stringify(products)
      : JSON.stringify(products, null, 2),
    "utf8"
  );
  productCache = { data: products, time: Date.now() };
}

async function readUsers() {
  if (isCacheValid(userCache)) return userCache.data;
  const raw = await readFile(USERS_FILE, "utf8");
  const data = JSON.parse(raw);
  userCache = { data, time: Date.now() };
  return data;
}

async function writeUsers(users) {
  await writeFile(
    USERS_FILE,
    NODE_ENV === "production"
      ? JSON.stringify(users)
      : JSON.stringify(users, null, 2),
    "utf8"
  );
  userCache = { data: users, time: Date.now() };
}

function validateId(type) {
  return function (req, res, next) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: `Invalid ${type} ID` });
    }
    req[type] = id;
    next();
  };
}

function averageRating(comments) {
  if (!comments?.length) return null;
  return +(
    comments.reduce((sum, c) => sum + (c.rating || 0), 0) / comments.length
  ).toFixed(2);
}

// ----------- ROUTES -------------

// Products
app.get("/api/products", async (req, res) => {
  try {
    const products = await readProducts();
    res.set("Cache-Control", "public, max-age=5");
    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to read products" });
  }
});

app.get("/api/products/:id", validateId("productId"), async (req, res) => {
  try {
    const products = await readProducts();
    const product = products.find((p) => p.id === req.productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.set("Cache-Control", "public, max-age=5");
    res.json({ ...product, rating: averageRating(product.comments) });
  } catch {
    res.status(500).json({ error: "Failed to read product" });
  }
});

// Comments
app.post(
  "/api/products/:id/comments",
  validateId("productId"),
  async (req, res) => {
    try {
      const { user, text, rating } = req.body;

      if (!user?.trim() || !text?.trim()) {
        return res.status(400).json({ error: "User and text are required" });
      }

      const numericRating = Number(rating);
      if (
        !Number.isInteger(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({ error: "Rating must be 1-5" });
      }

      const products = await readProducts();
      const product = products.find((p) => p.id === req.productId);
      if (!product) return res.status(404).json({ error: "Product not found" });

      product.comments ||= [];
      if (product.comments.length >= 1000) {
        return res.status(400).json({ error: "Too many comments" });
      }

      product.comments.push({
        user: user.trim().slice(0, 100),
        text: text.trim().slice(0, 500),
        rating: numericRating,
      });

      await writeProducts(products);
      res
        .status(201)
        .json({ ...product, rating: averageRating(product.comments) });
    } catch {
      res.status(500).json({ error: "Failed to save comment" });
    }
  }
);

// Users
app.get("/api/users", async (req, res) => {
  try {
    res.json(await readUsers());
  } catch {
    res.status(500).json({ error: "Failed to read users" });
  }
});

app.get("/api/users/:id", validateId("userId"), async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to read user" });
  }
});

// Cart
app.post("/api/users/:id/cart", validateId("userId"), async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;

    if (
      !Number.isInteger(itemId) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({ error: "Invalid itemId or quantity" });
    }

    const products = await readProducts();
    const product = products.find((p) => p.id === itemId);
    if (!product)
      return res.status(400).json({ error: "Product does not exist" });

    const users = await readUsers();
    const user = users.find((u) => u.id === req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.cartItems ||= [];

    const existing = user.cartItems.find((ci) => ci.itemId === itemId);
    const existingQty = existing?.quantity || 0;

    if (product.stock < existingQty + quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cartItems.push({ itemId, quantity });
    }

    user.cartCount = user.cartItems.reduce((sum, c) => sum + c.quantity, 0);

    await writeUsers(users);
    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: "Failed to update cart" });
  }
});

// Static images
app.use(
  "/images",
  express.static(IMAGES_DIR, {
    maxAge: "1d",
    etag: false,
    lastModified: false,
  })
);

// Health
app.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

// 404
app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Server error" });
});

// Server start
function startServer() {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

if (ENABLE_CLUSTERING && cluster.isPrimary) {
  const cores = os.cpus().length;
  console.log(`Clustering enabled. Spawning ${cores} workers.`);
  for (let i = 0; i < cores; i++) cluster.fork();

  cluster.on("exit", () => cluster.fork());
} else {
  startServer();
}
