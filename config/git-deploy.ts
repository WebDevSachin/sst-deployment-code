import type { Config } from "./types";

export function createGitDeployCommand(config: Config) {
  return `
set -e

echo "📥 Deploying code from Git repository..."

DEPLOY_PATH="${config.deploymentPath}"

# Create deployment directory
mkdir -p "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

# Clone or pull repository
if [ -d ".git" ]; then
    echo "🔄 Repository exists, pulling latest changes..."
    git fetch origin
    git reset --hard origin/${config.branch} || git reset --hard origin/main
    git clean -fd
else
    echo "⬇️ Cloning repository..."
    rm -rf "$DEPLOY_PATH"/* "$DEPLOY_PATH"/.* 2>/dev/null || true
    git clone -b ${config.branch} ${config.repo} "$DEPLOY_PATH"
fi

# Verify backend and frontend directories exist
if [ ! -d "$DEPLOY_PATH/backend" ]; then
    echo "❌ Error: backend directory not found in repository"
    exit 1
fi

if [ ! -d "$DEPLOY_PATH/frontend" ]; then
    echo "❌ Error: frontend directory not found in repository"
    exit 1
fi

echo "✅ Code deployment complete!"
  `;
}

export function createEnvUploadCommand(config: Config) {
  return `
set -e

echo "📤 Uploading environment variables to server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Environment File Mapping:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Local File              →  Server Location"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ".env.backend           →  ${config.deploymentPath}/backend/.env"
echo ".env.frontend          →  ${config.deploymentPath}/frontend/.env.production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DEPLOY_PATH="${config.deploymentPath}"

# Verify deployment directories exist
if [ ! -d "$DEPLOY_PATH/backend" ]; then
    echo "❌ ERROR: Backend directory not found at $DEPLOY_PATH/backend"
    exit 1
fi

if [ ! -d "$DEPLOY_PATH/frontend" ]; then
    echo "❌ ERROR: Frontend directory not found at $DEPLOY_PATH/frontend"
    exit 1
fi

# Create .env file for backend
echo "📝 Creating backend/.env..."
cat > "$DEPLOY_PATH/backend/.env" << 'ENVEOF'
${config.envBackend}
ENVEOF

if [ -f "$DEPLOY_PATH/backend/.env" ]; then
    BACKEND_LINES=\$(wc -l < "$DEPLOY_PATH/backend/.env")
    echo "   ✅ Backend .env created (\$BACKEND_LINES lines)"
else
    echo "   ❌ Failed to create backend .env"
    exit 1
fi

# Create .env.production file for frontend
echo "📝 Creating frontend/.env.production..."
cat > "$DEPLOY_PATH/frontend/.env.production" << 'ENVEOF'
${config.envFrontend}
ENVEOF

if [ -f "$DEPLOY_PATH/frontend/.env.production" ]; then
    FRONTEND_LINES=\$(wc -l < "$DEPLOY_PATH/frontend/.env.production")
    echo "   ✅ Frontend .env.production created (\$FRONTEND_LINES lines)"
else
    echo "   ❌ Failed to create frontend .env.production"
    exit 1
fi

# Set proper permissions (readable only by owner for security)
chmod 600 "$DEPLOY_PATH/backend/.env"
chmod 600 "$DEPLOY_PATH/frontend/.env.production"

echo ""
echo "✅ Environment variables uploaded successfully!"
echo "   These files will be used during the build process"
echo ""
  `;
}
