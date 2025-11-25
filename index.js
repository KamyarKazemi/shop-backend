// index.js - Optimized production-ready backend with CORS for frontend images
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

// ✅ CORS - allow frontend to fetch images and data
app.use(
  cors({
    origin: "*", // For testing; in production replace with your frontend domain
  })
);

app.use(express.json({ limit: "10kb" })); // body parser with size limit
app.use(limiter); // rate limiting

// Serve images from /images
app.use(
  "/images",
  express.static(join(__dirname, "images"), {
    maxAge: "1d",
    etag: false,
    lastModified: false,
  })
);

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

function calculateCartItemsNumber(cartItems) {
  if (!cartItems || !Array.isArray(cartItems)) return 0;
  return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
}

// Routes
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

// Users endpoints
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

// Add this to your index.js - Replace the POST /api/users endpoint

app.post("/api/users", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }
    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters" });
    }
    if (!email.includes("@")) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const users = await readUsers();

    // ✅ Check if email already exists
    const existingEmail = users.find((u) => u.email === email.toLowerCase());
    if (existingEmail) {
      return res.status(409).json({
        error: "Email already registered",
        field: "email",
      });
    }

    // ✅ Check if username already exists
    const existingUsername = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (existingUsername) {
      return res.status(409).json({
        error: "Username already taken",
        field: "username",
      });
    }

    const newUser = {
      id: Math.max(...users.map((u) => u.id), 0) + 1,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password, // Note: In production, hash passwords!
      createdAt: new Date().toISOString(),
      cartItems: [],
      CartItemsNumber: 0,
    };

    users.push(newUser);
    await writeUsers(users);

    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ✅ ADD NEW ENDPOINT: Check if username/email exists (for real-time validation)
app.post("/api/users/check-availability", async (req, res) => {
  try {
    const { username, email } = req.body;
    const users = await readUsers();

    const result = {
      usernameAvailable: true,
      emailAvailable: true,
      message: "",
    };

    if (username) {
      const usernameTaken = users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );
      result.usernameAvailable = !usernameTaken;
    }

    if (email) {
      const emailTaken = users.some((u) => u.email === email.toLowerCase());
      result.emailAvailable = !emailTaken;
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check availability" });
  }
});

app.patch("/api/users/:id", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const { username, email, password } = req.body;

    const users = await readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Validation for updates
    if (username && username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters" });
    }
    if (email && !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password && password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check for duplicates (excluding current user)
    if (
      email &&
      email !== user.email &&
      users.find((u) => u.email === email && u.id !== id)
    ) {
      return res.status(409).json({ error: "Email already in use" });
    }
    if (
      username &&
      username !== user.username &&
      users.find((u) => u.username === username && u.id !== id)
    ) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Update fields
    if (username) user.username = username.trim();
    if (email) user.email = email.trim();
    if (password) user.password = password; // Note: In production, hash passwords!
    user.updatedAt = new Date().toISOString();

    await writeUsers(users);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/api/users/:id", validateUserId, async (req, res) => {
  try {
    const id = req.userId;
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex === -1)
      return res.status(404).json({ error: "User not found" });

    const deletedUser = users.splice(userIndex, 1)[0];
    await writeUsers(users);

    res.json({ message: "User deleted", user: deletedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Cart endpoints
app.post("/api/users/:id/cart", validateUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { itemId, quantity } = req.body;

    if (!itemId || !quantity) {
      return res
        .status(400)
        .json({ error: "itemId and quantity are required" });
    }
    if (quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if item already in cart
    const existingItem = user.cartItems.find((item) => item.itemId === itemId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cartItems.push({ itemId, quantity });
    }

    user.CartItemsNumber = calculateCartItemsNumber(user.cartItems);
    await writeUsers(users);

    res.json({ message: "Item added to cart", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

app.patch("/api/users/:id/cart/:itemId", validateUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: "quantity is required" });
    }
    if (quantity < 0) {
      return res.status(400).json({ error: "Quantity cannot be negative" });
    }

    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const cartItem = user.cartItems.find((item) => item.itemId === itemId);
    if (!cartItem) return res.status(404).json({ error: "Item not in cart" });

    if (quantity === 0) {
      user.cartItems = user.cartItems.filter((item) => item.itemId !== itemId);
    } else {
      cartItem.quantity = quantity;
    }

    user.CartItemsNumber = calculateCartItemsNumber(user.cartItems);
    await writeUsers(users);

    res.json({ message: "Cart updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

app.delete("/api/users/:id/cart/:itemId", validateUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const itemId = Number(req.params.itemId);

    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.cartItems = user.cartItems.filter((item) => item.itemId !== itemId);
    user.CartItemsNumber = calculateCartItemsNumber(user.cartItems);
    await writeUsers(users);

    res.json({ message: "Item removed from cart", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

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
