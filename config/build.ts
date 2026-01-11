import type { Config } from "./types";

export function createBackendBuildCommand(config: Config) {
  return `
set -e

echo "🔨 Building backend application..."

cd "${config.deploymentPath}/backend"

# Install dependencies
echo "📦 Installing backend dependencies..."
npm ci --production=false

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate || echo "⚠️ Prisma generate failed, continuing..."

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy || echo "⚠️ Migrations failed, continuing..."

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

echo "✅ Backend build complete!"
  `;
}

export function createFrontendBuildCommand(config: Config) {
  return `
set -e

echo "🔨 Building frontend application..."

cd "${config.deploymentPath}/frontend"

# Clean old dependencies (more aggressively)
echo "🧹 Cleaning old frontend build..."
rm -rf node_modules .next .next.tmp
npm cache clean --force 2>/dev/null || true

# Install dependencies
echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps || npm install

# Build Next.js application
echo "🏗️ Building Next.js application..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

echo "✅ Frontend build complete!"
  `;
}
