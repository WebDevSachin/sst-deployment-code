import type { Config } from "./types";

export function createPM2ConfigCommand(config: Config) {
  const backendName = `${config.appName}-backend`;
  const frontendName = `${config.appName}-frontend`;

  return `
set -e

echo "⚙️ Configuring PM2..."

DEPLOY_PATH="${config.deploymentPath}"

# Create PM2 ecosystem config
cat > "$DEPLOY_PATH/ecosystem.config.js" << 'PM2EOF'
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
        PORT: 8000
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
        PORT: 3000
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

# Stop existing PM2 processes if running
pm2 delete ${backendName} ${frontendName} 2>/dev/null || true

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
cd "$DEPLOY_PATH"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ PM2 configuration complete!"
  `;
}
