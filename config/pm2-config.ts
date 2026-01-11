import type { Config } from "./types";

export function createPM2ConfigCommand(config: Config) {
  const backendName = `${config.appName}-backend`;
  const frontendName = `${config.appName}-frontend`;

  return `
set -e

echo "⚙️ Configuring PM2..."

DEPLOY_PATH="${config.deploymentPath}"

# Function to find next available port
find_available_port() {
  local start_port=$1
  local port=$start_port
  
  while true; do
    # Check if port is in use
    if ! netstat -tuln 2>/dev/null | grep -q ":$port " && \
       ! ss -tuln 2>/dev/null | grep -q ":$port "; then
      echo $port
      return 0
    fi
    port=$((port + 1))
    
    # Prevent infinite loop
    if [ $port -gt $((start_port + 100)) ]; then
      echo "ERROR: Could not find available port after checking 100 ports from $start_port" >&2
      return 1
    fi
  done
}

# Find available ports
echo "🔍 Finding available ports..."
BACKEND_PORT=$(find_available_port 8000)
FRONTEND_PORT=$(find_available_port 3000)

echo "   Backend will use port: $BACKEND_PORT"
echo "   Frontend will use port: $FRONTEND_PORT"

# Create PM2 ecosystem config with dynamic ports
cat > "$DEPLOY_PATH/ecosystem.config.js" << PM2EOF
module.exports = {
  apps: [
    {
      name: '${backendName}',
      cwd: '${config.deploymentPath}/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: $BACKEND_PORT
      },
      error_file: '/var/log/pm2/${backendName}-error.log',
      out_file: '/var/log/pm2/${backendName}-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: '${frontendName}',
      cwd: '${config.deploymentPath}/frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: $FRONTEND_PORT
      },
      error_file: '/var/log/pm2/${frontendName}-error.log',
      out_file: '/var/log/pm2/${frontendName}-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PM2EOF

# Create log directory
mkdir -p /var/log/pm2

# Save port configuration for Apache
echo "BACKEND_PORT=$BACKEND_PORT" > "$DEPLOY_PATH/.ports"
echo "FRONTEND_PORT=$FRONTEND_PORT" >> "$DEPLOY_PATH/.ports"
chmod 644 "$DEPLOY_PATH/.ports"

echo "💾 Port configuration saved to $DEPLOY_PATH/.ports"

# Stop existing PM2 processes if running
pm2 delete ${backendName} ${frontendName} 2>/dev/null || true

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
cd "$DEPLOY_PATH"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Verify processes are running
sleep 2
echo ""
echo "📊 PM2 Status:"
pm2 list | grep -E "${backendName}|${frontendName}" || pm2 list

echo "✅ PM2 configuration complete!"
echo "   Backend running on port: $BACKEND_PORT"
echo "   Frontend running on port: $FRONTEND_PORT"
  `;
}
