# Shop Backend - Production-Ready API

Optimized e-commerce backend with in-memory caching, gzip compression, rate limiting, and multi-core clustering support.

## 🚀 Optimizations Applied

✅ **In-memory caching** (5s TTL) — Reduces disk I/O  
✅ **Gzip compression** — All responses auto-compressed  
✅ **Rate limiting** — 100 req/15 min per IP (DoS protection)  
✅ **Input validation** — Sanitized params, string length limits  
✅ **Request size limits** — 10KB max body (prevents abuse)  
✅ **Multi-core clustering** — Distribute across CPU cores  
✅ **Optimized static serving** — 1-day cache on images  
✅ **HTTP cache headers** — Cache-Control on all responses  
✅ **Health endpoint** — `/health` for monitoring  
✅ **Minified JSON in production** — Smaller file sizes  
✅ **Cart & comment limits** — Max 100 items/cart, 1000 comments/product  
✅ **Async file I/O** — Non-blocking reads/writes

## Getting Started

### Install Dependencies

```bash
npm install
```

### Configuration

Copy `.env.example` and customize:

```bash
cp .env.example .env
```

**Variables:**

- `NODE_ENV` — "production" (default) or "development"
- `PORT` — Listen port (default: 5000)
- `ENABLE_CLUSTERING` — "true" for multi-core mode

### Start Server

```bash
# Production (single core)
npm start

# Production (multi-core clustering)
npm run cluster

# Development (auto-reload with nodemon)
npm run dev

# Quick test
npm run test-users
```

## API Endpoints

### Products

- **GET** `/api/products` — List all (cached 5s, gzipped)
- **GET** `/api/products/:id` — Single product with avg rating
- **POST** `/api/products/:id/comments` — Add comment (max 500 chars, 1000/product)

### Users & Shopping Cart

- **GET** `/api/users` — List users (cached 5s)
- **GET** `/api/users/:id` — Single user with cart
- **POST** `/api/users/:id/cart` — Add item (stock validated, max 100 items)
- **PATCH** `/api/users/:id/cart/:itemId` — Update quantity (0 = remove)
- **DELETE** `/api/users/:id/cart/:itemId` — Remove from cart
- **POST** `/api/users/:id/checkout` — Complete purchase (decrements stock)

### Health & Monitoring

- **GET** `/health` — Server status, timestamp, uptime

## 📦 What to Do With Images

### **Recommended: Use a CDN**

Move images off your backend server (saves bandwidth, improves speed):

1. **Upload to AWS S3:**

   ```bash
   aws s3 cp images/ s3://my-bucket/images/ --recursive
   ```

2. **Update `products.json`:**

   ```json
   {
     "image": "https://d1234567.cloudfront.net/images/product-1.webp"
   }
   ```

3. **Benefits:**
   - Geographic distribution (users get faster downloads)
   - Automatic scaling (no server load)
   - Built-in caching + compression
   - Cost-effective for large deployments

**CDN Options:** AWS CloudFront, Cloudflare, Akamai, DigitalOcean Spaces

---

### **Alternative: Optimize Locally** (if no CDN)

**Convert images to WebP** (30% smaller than JPEG):

```bash
# macOS
brew install webp

# Linux
apt-get install webp

# Convert
cwebp -q 80 samsung-galaxy-s25-ultra-gray-*.jpg -o product.webp
```

Update `products.json`:

```json
{
  "image": "http://localhost:5000/images/product.webp"
}
```

**Compress further:** Use TinyPNG, ImageOptim, or Squoosh online

---

### **Hybrid Approach** (Best for small deployments)

- **Thumbnails**: Keep locally in `/images` (already cached 1 day)
- **Full images**: Serve from CDN
- **Frontend**: Use `<img srcset>` for responsive fallback

---

## Performance Details

| Metric                     | Value                 |
| -------------------------- | --------------------- |
| **Cache TTL**              | 5 seconds (in-memory) |
| **Rate Limit**             | 100 req/15 min per IP |
| **Max Body Size**          | 10 KB                 |
| **Max Cart Items**         | 100                   |
| **Max Comments/Product**   | 1000                  |
| **Comment Char Limit**     | 500                   |
| **Static Cache**           | 1 day                 |
| **Single-core throughput** | ~1000 req/s           |

## Deployment Checklist

- [ ] Install production dependencies: `npm install --production`
- [ ] Set `NODE_ENV=production`
- [ ] Configure `.env` with `PORT`, `ENABLE_CLUSTERING`
- [ ] **Choose image strategy** (CDN or local WebP)
- [ ] Test health endpoint: `curl http://localhost:5000/health`
- [ ] Monitor startup logs for errors
- [ ] Use `npm run cluster` if expecting high traffic
- [ ] Set up monitoring/alerts on `/health` endpoint

## Scaling Tips

**For 1K-10K users:**

- Single process (`npm start`) with external CDN for images
- Monitor CPU/memory with `npm run cluster` if needed

**For 10K+ users:**

- Enable clustering: `npm run cluster`
- Upgrade to database (PostgreSQL/MongoDB) instead of JSON files
- Add Redis for caching
- Use CDN with edge caching
- Consider upgrading to Next.js API routes or dedicated Node framework

## Monitoring

Health check includes uptime:

```bash
curl http://localhost:5000/health
# Response: {"status":"ok","timestamp":"2025-01-16T...","uptime":1234.56}
```

Set up a cron job to monitor this endpoint or integrate with uptime services (Pingdom, UptimeRobot, etc).

## Production Notes

- Files are minified in production (`NODE_ENV=production`)
- Caches invalidate immediately on write
- Errors don't leak details in production (security)
- All timestamps use ISO 8601 format
- Compression is transparent to clients

---

Built with Express.js | Optimized for production deployment
