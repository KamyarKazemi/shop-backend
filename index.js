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
app.use(cors()); // allow all origins for deployment
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

    if (!user || !text)
      return res.status(400).json({ error: "user and text are required" });

    const numericRating = Number(rating);
    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    )
      return res.status(400).json({ error: "rating must be 1-5 integer" });

    const products = await readProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Product not found" });

    products[idx].comments = products[idx].comments || [];
    products[idx].comments.push({ user, text, rating: numericRating });

    await writeProducts(products);

    res
      .status(201)
      .json({
        ...products[idx],
        rating: averageRating(products[idx].comments),
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save comment" });
  }
});

// Users endpoints
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

// add item to cart
app.post("/api/users/:id/cart", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { itemId, quantity = 1 } = req.body;
    if (
      typeof itemId !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    )
      return res.status(400).json({ error: "itemId and quantity required" });

    const products = await readProducts();
    const product = products.find((p) => p.id === itemId);
    if (!product)
      return res.status(400).json({ error: "itemId does not exist" });

    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    users[idx].cartItems = users[idx].cartItems || [];
    const existing = users[idx].cartItems.find((ci) => ci.itemId === itemId);
    const existingQty = existing ? existing.quantity : 0;
    if (
      typeof product.stock === "number" &&
      existingQty + quantity > product.stock
    )
      return res
        .status(400)
        .json({
          error: `Requested quantity exceeds stock for product ${itemId}`,
        });

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

// You can keep your patch, delete, checkout routes as-is, just make sure all use /api/ prefix for consistency

// catch-all error
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

app.use("/images", express.static("images"));

app.listen(PORT, () => {
  console.log(`Products API listening at port ${PORT}`);
});
