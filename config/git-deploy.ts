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

echo "📤 Uploading environment variables..."

DEPLOY_PATH="${config.deploymentPath}"

# Create .env file for backend
cat > "$DEPLOY_PATH/backend/.env" << 'ENVEOF'
${config.envBackend}
ENVEOF

# Create .env.production file for frontend
cat > "$DEPLOY_PATH/frontend/.env.production" << 'ENVEOF'
${config.envFrontend}
ENVEOF

# Set proper permissions (readable only by owner)
chmod 600 "$DEPLOY_PATH/backend/.env"
chmod 600 "$DEPLOY_PATH/frontend/.env.production"

echo "✅ Environment variables uploaded!"
  `;
}
