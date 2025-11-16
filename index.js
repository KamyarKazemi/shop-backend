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

// Other routes (POST comments, user cart, checkout) remain unchanged
// ... your existing routes here ...

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
