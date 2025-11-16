# Deployment Guide

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Start server with auto-reload
npm run dev

# 3. Test in another terminal
curl http://localhost:5000/health
```

---

## Production Deployment

### Local Testing (Production Mode)

```bash
# Set production environment
export NODE_ENV=production
export PORT=5000

# Install only production dependencies
npm install --production

# Start server
npm start

# Test health endpoint
curl http://localhost:5000/health
```

### Multi-Core (High Traffic)

```bash
export NODE_ENV=production
export ENABLE_CLUSTERING=true
npm run cluster

# Should output: "Primary process PID starting N workers"
```

---

## Docker Deployment (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
ENV PORT=5000
ENV ENABLE_CLUSTERING=true

EXPOSE 5000

CMD ["node", "index.js"]
```

Build & run:

```bash
docker build -t shop-backend .
docker run -p 5000:5000 shop-backend
```

---

## Cloud Deployment

### Heroku

```bash
heroku create my-shop-backend
heroku config:set NODE_ENV=production
heroku config:set ENABLE_CLUSTERING=true
git push heroku main
```

### AWS EC2

```bash
# SSH into instance
ssh ec2-user@your-instance

# Clone repo
git clone https://github.com/you/shop-backend.git
cd shop-backend

# Install Node
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install deps and start
npm install --production
NODE_ENV=production npm start
```

### DigitalOcean App Platform

1. Connect GitHub repo
2. Set environment variables:
   - `NODE_ENV=production`
   - `ENABLE_CLUSTERING=true`
3. Set run command: `npm start`
4. Deploy

---

## Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=production
PORT=5000
ENABLE_CLUSTERING=true
```

---

## Images / Static Assets

### Option A: CDN (Recommended)

1. Upload `images/` to AWS S3:

   ```bash
   aws s3 cp images/ s3://my-bucket/images/ --recursive
   ```

2. Update `products.json`:

   ```json
   {
     "image": "https://d1234567.cloudfront.net/images/product-1.webp"
   }
   ```

3. (Optional) Delete local `/images` folder to save server disk space

### Option B: Local with WebP

```bash
# Convert to WebP
cwebp -q 80 images/*.jpg

# Update products.json to reference .webp files
# No code changes needed (images route works the same)
```

---

## Monitoring

### Health Check

```bash
# Single check
curl http://localhost:5000/health

# Continuous monitoring (every 5 minutes)
while true; do
  curl -f http://localhost:5000/health || echo "DOWN"
  sleep 300
done
```

### Expected Output

```json
{
  "status": "ok",
  "timestamp": "2025-01-16T14:30:00.000Z",
  "uptime": 3600.5
}
```

### Production Monitoring Tools

- **Uptime monitoring:** Pingdom, UptimeRobot, StatusPage
- **Error logging:** Sentry, LogRocket
- **Metrics:** New Relic, DataDog, CloudWatch
- **APM:** ElasticAPM, Dynatrace

---

## Load Testing

Test performance before deployment:

```bash
# Using Apache Bench (ab)
ab -n 1000 -c 10 http://localhost:5000/api/products

# Using wrk (recommended)
brew install wrk
wrk -t4 -c100 -d30s http://localhost:5000/api/products

# Expected: ~500+ req/s (single core), ~2000+ req/s (multi-core)
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 5000
lsof -i :5000
kill -9 <PID>

# Or use different port
PORT=3000 npm start
```

### High Memory Usage

- Check if clustering is needed: `ENABLE_CLUSTERING=false npm start`
- Monitor with: `node --max-old-space-size=4096 index.js`
- Consider upgrading to database if files are >100MB

### Rate Limiting Issues

- Add internal IPs to allowlist (modify `index.js` if needed)
- Increase limit if clients are legitimate: `max: 200` in rate limiter config

---

## Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/TLS in reverse proxy (nginx, Apache)
- [ ] Set CORS origin properly (not `*` in production)
- [ ] Keep dependencies updated: `npm audit fix`
- [ ] Use `.env` file for secrets (not in version control)
- [ ] Monitor `/health` endpoint
- [ ] Set up rate limiting allowlist for internal services
- [ ] Use strong API keys if adding authentication later

---

## Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Performance Targets

- **Latency:** <100ms avg (with cache hits)
- **Throughput:** >1000 req/s single core
- **CPU:** <50% under normal load
- **Memory:** <200MB (single process)
- **Uptime:** 99.9% (aim for zero planned downtime)

---

## Maintenance

### Weekly

- Monitor `/health` endpoint
- Check error logs
- Review disk usage (JSON files growth)

### Monthly

- Update dependencies: `npm audit fix`
- Review performance metrics
- Clean up old log files

### Quarterly

- Plan database migration if files exceed 100MB
- Evaluate CDN usage for images
- Review rate limiting effectiveness

---

## Scaling Path

1. **0-10K users:** Single instance + CDN for images
2. **10K-100K users:** Clustering enabled + Redis cache
3. **100K+ users:** Database migration + load balancing

---

**Questions?** Check OPTIMIZATIONS.md for more details.
