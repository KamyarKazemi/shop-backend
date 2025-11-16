#!/bin/bash
# Quick installation and verification script

echo "🚀 Shop Backend - Quick Setup"
echo "=============================="

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if installation succeeded
if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "✗ Installation failed"
    exit 1
fi

# Verify syntax
echo ""
echo "🔍 Verifying code syntax..."
node --check index.js
if [ $? -eq 0 ]; then
    echo "✓ Code is valid"
else
    echo "✗ Syntax error found"
    exit 1
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✓ .env created (customize as needed)"
fi

# Summary
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Edit .env if needed (PORT, ENABLE_CLUSTERING, etc)"
echo "  2. Start server:"
echo "     npm start        (production)"
echo "     npm run dev      (development)"
echo "     npm run cluster  (multi-core)"
echo "  3. Test health:"
echo "     curl http://localhost:5000/health"
echo ""
echo "📚 Documentation:"
echo "  - README.md       (Quick start)"
echo "  - OPTIMIZATIONS.md (What was optimized)"
echo "  - DEPLOYMENT.md   (How to deploy)"
echo ""
