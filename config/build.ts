import type { Config } from "./types";

export function createBackendBuildCommand(config: Config) {
  return `
set -e

echo "🔨 Building backend application..."
echo "📍 Location: ${config.deploymentPath}/backend"

cd "${config.deploymentPath}/backend"

# Verify .env file exists
if [ ! -f ".env" ]; then
    echo "❌ ERROR: .env file not found in backend directory!"
    echo "The .env file should have been uploaded from your local .env.backend file"
    exit 1
fi

echo "✅ Backend .env file found"
echo ""

# Install dependencies
echo "📦 Installing backend dependencies..."
if ! npm ci --production=false 2>&1 | tee /tmp/backend-npm-install.log; then
    echo ""
    echo "❌ ERROR: Backend npm install failed!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Build error details:"
    tail -50 /tmp/backend-npm-install.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check your backend/package.json for errors"
    echo "   2. Verify all dependencies are available"
    echo "   3. Check Node.js version compatibility"
    exit 1
fi

# Generate Prisma client (if Prisma is used)
if [ -f "prisma/schema.prisma" ]; then
    echo "🔧 Generating Prisma client..."
    if ! npx prisma generate 2>&1 | tee /tmp/backend-prisma-generate.log; then
        echo ""
        echo "⚠️ WARNING: Prisma generate failed (continuing anyway)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -20 /tmp/backend-prisma-generate.log
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi
    
    # Run database migrations
    echo "🗄️ Running database migrations..."
    if ! npx prisma migrate deploy 2>&1 | tee /tmp/backend-prisma-migrate.log; then
        echo ""
        echo "⚠️ WARNING: Migrations failed (continuing anyway)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -20 /tmp/backend-prisma-migrate.log
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "💡 Check DATABASE_URL in .env file"
    fi
else
    echo "ℹ️ No Prisma schema found, skipping Prisma setup"
fi

# Build TypeScript
echo "🏗️ Building TypeScript..."
if ! npm run build 2>&1 | tee /tmp/backend-build.log; then
    echo ""
    echo "❌ ERROR: Backend build failed!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Build error details:"
    tail -100 /tmp/backend-build.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check TypeScript errors in your backend code"
    echo "   2. Verify tsconfig.json is correct"
    echo "   3. Check for missing type declarations"
    echo "   4. Review full log: cat /tmp/backend-build.log"
    exit 1
fi

echo "✅ Backend build complete!"
echo ""
  `;
}

export function createFrontendBuildCommand(config: Config) {
  return `
set -e

echo "🔨 Building frontend application..."
echo "📍 Location: ${config.deploymentPath}/frontend"

cd "${config.deploymentPath}/frontend"

# Verify .env.production file exists
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: .env.production file not found in frontend directory!"
    echo "The .env.production file should have been uploaded from your local .env.frontend file"
    exit 1
fi

echo "✅ Frontend .env.production file found"

# Display environment variables being used (for debugging)
echo "🔍 Frontend environment variables:"
echo "   NEXT_PUBLIC_API_URL=$(grep NEXT_PUBLIC_API_URL .env.production | cut -d'=' -f2)"
echo "   NEXT_PUBLIC_WS_URL=$(grep NEXT_PUBLIC_WS_URL .env.production | cut -d'=' -f2)"
echo ""

# Clean old dependencies (more aggressively)
echo "🧹 Cleaning old frontend build..."
rm -rf node_modules .next .next.tmp
npm cache clean --force 2>/dev/null || true

# Install dependencies
echo "📦 Installing frontend dependencies..."
if ! npm install --legacy-peer-deps 2>&1 | tee /tmp/frontend-npm-install.log; then
    if ! npm install 2>&1 | tee /tmp/frontend-npm-install-fallback.log; then
        echo ""
        echo "❌ ERROR: Frontend npm install failed!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Build error details:"
        tail -50 /tmp/frontend-npm-install-fallback.log
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "💡 Troubleshooting:"
        echo "   1. Check your frontend/package.json for errors"
        echo "   2. Verify all dependencies are compatible with Node.js $(node -v)"
        echo "   3. Check for peer dependency conflicts"
        exit 1
    fi
fi

# Build Next.js application
echo "🏗️ Building Next.js application..."
export NODE_OPTIONS="--max-old-space-size=4096"
if ! npm run build 2>&1 | tee /tmp/frontend-build.log; then
    echo ""
    echo "❌ ERROR: Frontend build failed!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Build error details:"
    tail -100 /tmp/frontend-build.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check for TypeScript errors in your frontend code"
    echo "   2. Verify environment variables (NEXT_PUBLIC_*) are set correctly"
    echo "   3. Check for missing API endpoints or invalid URLs"
    echo "   4. Review full log: cat /tmp/frontend-build.log"
    echo ""
    echo "🔍 Common issues:"
    echo "   - Missing NEXT_PUBLIC_ prefix on client-side variables"
    echo "   - Invalid API_URL or WS_URL in .env.frontend"
    echo "   - TypeScript type errors in components"
    exit 1
fi

echo "✅ Frontend build complete!"
echo ""
  `;
}
