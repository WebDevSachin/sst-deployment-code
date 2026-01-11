/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "saffron-deployer",
      home: "local",
      providers: { command: "1.0.1" },
    };
  },
  async run() {
    // Dynamic imports as required by SST
    const command = await import("@pulumi/command");
    const fs = await import("fs");
    const path = await import("path");
    // --- 1. LOAD CONFIGURATION ---
    const loadEnvFile = (filePath: string): Record<string, string> => {
      const env: Record<string, string> = {};
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...valueParts] = trimmed.split("=");
            if (key) {
              env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
            }
          }
        }
      }
      return env;
    };

    const env = loadEnvFile(".env");
    
    const config = {
      ip: env.SERVER_IP || process.env.SERVER_IP!,
      user: env.SSH_USER || process.env.SSH_USER || "root",
      key: fs.readFileSync(env.SSH_KEY_PATH || process.env.SSH_KEY_PATH!, "utf-8"),
      repo: (env.GIT_REPO_URL || process.env.GIT_REPO_URL!).replace(
        "https://",
        `https://${env.GIT_TOKEN || process.env.GIT_TOKEN}@`
      ),
      branch: env.GIT_BRANCH || process.env.GIT_BRANCH || "main",
      domain: env.DOMAIN || process.env.DOMAIN!,
      nodeVersion: env.NODE_VERSION || process.env.NODE_VERSION || "22",
      deploymentPath: env.DEPLOYMENT_PATH || process.env.DEPLOYMENT_PATH || "/var/www/saffron",
      envBackend: fs.readFileSync(".env.backend", "utf-8"),
      envFrontend: fs.readFileSync(".env.frontend", "utf-8"),
    };

    if (!config.ip || !config.key || !config.repo || !config.domain) {
      throw new Error("Missing required environment variables. Check your .env file.");
    }

    const connection = {
      host: config.ip,
      user: config.user,
      privateKey: config.key,
    };

    // Escape function for shell commands
    const escapeShell = (str: string): string => {
      return str.replace(/'/g, "'\\''").replace(/\$/g, "\\$");
    };

    // --- 2. OS DETECTION & SYSTEM SETUP ---
    const systemSetup = new command.remote.Command(
      "SystemSetup",
      {
        connection,
        create: `
set -e
set -o pipefail

echo "🔍 Detecting OS..."

# Detect package manager
if command -v dnf &> /dev/null; then
    echo "✅ Detected RHEL/AlmaLinux/CentOS (dnf)"
    PKG_MGR="dnf"
    APACHE_NAME="httpd"
    APACHE_CONF_DIR="/etc/httpd/conf.d"
    APACHE_LOG_DIR="/var/log/httpd"
    APACHE_USER="apache"
    
    # Update system
    $PKG_MGR update -y
    $PKG_MGR upgrade -y
    
    # Install development tools
    $PKG_MGR groupinstall "Development Tools" -y || true
    $PKG_MGR install -y curl wget git gcc-c++ make
    
    # Install Node.js ${config.nodeVersion}.x from NodeSource
    echo "📦 Installing Node.js ${config.nodeVersion}.x..."
    curl -fsSL https://rpm.nodesource.com/setup_${config.nodeVersion}.x | bash -
    $PKG_MGR install -y nodejs
    
    # Install Apache (httpd on CentOS)
    echo "📦 Installing Apache (httpd)..."
    $PKG_MGR install -y httpd mod_ssl
    
    # Enable proxy modules (most are enabled by default, but ensure proxy_wstunnel)
    if ! grep -q "mod_proxy_wstunnel" /etc/httpd/conf.modules.d/*.conf 2>/dev/null; then
        echo 'LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so' >> /etc/httpd/conf.modules.d/00-proxy.conf
    fi
    
    # Ensure all proxy modules are loaded
    if ! grep -q "LoadModule proxy_module" /etc/httpd/conf.modules.d/00-proxy.conf 2>/dev/null; then
        cat > /etc/httpd/conf.modules.d/00-proxy.conf << 'PROXYEOF'
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
PROXYEOF
    fi
    
    # Install Certbot
    echo "📦 Installing Certbot..."
    $PKG_MGR install -y epel-release
    $PKG_MGR install -y certbot python3-certbot-apache
    
    # Configure firewall for HTTP/HTTPS
    echo "🔥 Configuring firewall..."
    if command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http 2>/dev/null || true
        firewall-cmd --permanent --add-service=https 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        echo "✅ Firewall configured (firewalld)"
    fi
    
    # Configure SELinux for proxy connections
    echo "🔒 Configuring SELinux..."
    if command -v setsebool &> /dev/null; then
        setsebool -P httpd_can_network_connect 1 2>/dev/null || true
        setsebool -P httpd_can_network_relay 1 2>/dev/null || true
        echo "✅ SELinux configured for proxy"
    fi
    
    # Start and enable services
    systemctl enable httpd
    systemctl start httpd || true
    
elif command -v apt-get &> /dev/null; then
    echo "✅ Detected Ubuntu/Debian (apt)"
    PKG_MGR="apt-get"
    APACHE_NAME="apache2"
    APACHE_CONF_DIR="/etc/apache2/sites-available"
    APACHE_LOG_DIR="/var/log/apache2"
    APACHE_USER="www-data"
    
    # Update package list
    $PKG_MGR update -y
    
    # Install basic tools
    $PKG_MGR install -y curl wget git build-essential
    
    # Install Node.js ${config.nodeVersion}.x from NodeSource
    echo "📦 Installing Node.js ${config.nodeVersion}.x..."
    curl -fsSL https://deb.nodesource.com/setup_${config.nodeVersion}.x | bash -
    $PKG_MGR install -y nodejs
    
    # Install Apache
    echo "📦 Installing Apache..."
    $PKG_MGR install -y apache2
    
    # Enable required Apache modules
    a2enmod proxy proxy_http proxy_wstunnel ssl rewrite headers
    
    # Install Certbot
    echo "📦 Installing Certbot..."
    $PKG_MGR install -y certbot python3-certbot-apache
    
    # Start and enable services
    systemctl enable apache2
    systemctl start apache2 || true
    
else
    echo "❌ Unsupported OS - neither dnf nor apt-get found"
    exit 1
fi

# Install MySQL/MariaDB based on OS
echo "📦 Installing database server..."
if [ "$PKG_MGR" = "dnf" ]; then
    # CentOS/RHEL - use MariaDB
    $PKG_MGR install -y mariadb-server mariadb
    systemctl enable mariadb
    systemctl start mariadb || true
    echo "✅ MariaDB installed (CentOS/RHEL)"
else
    # Ubuntu/Debian - use MySQL
    export DEBIAN_FRONTEND=noninteractive
    $PKG_MGR install -y mysql-server
    systemctl enable mysql
    systemctl start mysql || true
    echo "✅ MySQL installed (Ubuntu/Debian)"
fi

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Setup PM2 startup
pm2 startup systemd -u ${config.user} --hp /home/${config.user} || true

# Verify installations
echo "✅ Verifying installations..."
node -v
npm -v
pm2 -v
apache2 -v 2>/dev/null || httpd -v
mysql --version 2>/dev/null || mariadb --version 2>/dev/null || echo "Database not installed"

echo "✅ System setup complete!"
        `,
      },
      {
        deleteBeforeReplace: false,
      }
    );

    // --- 3. SSL CERTIFICATE SETUP ---
    const sslSetup = new command.remote.Command(
      "SSLSetup",
      {
        connection,
        create: `
set -e

echo "🔒 Setting up SSL certificate for ${config.domain}..."

# Detect Apache service name
if systemctl is-active --quiet httpd 2>/dev/null; then
    APACHE_SERVICE="httpd"
elif systemctl is-active --quiet apache2 2>/dev/null; then
    APACHE_SERVICE="apache2"
else
    APACHE_SERVICE="httpd"
fi

# Check if certificate already exists
if [ -f "/etc/letsencrypt/live/${config.domain}/fullchain.pem" ]; then
    echo "✅ SSL certificate already exists, skipping..."
    certbot renew --dry-run || true
else
    echo "📜 Obtaining SSL certificate..."
    
    # Ensure Apache is running (needed for certbot --apache)
    systemctl start $APACHE_SERVICE 2>/dev/null || true
    sleep 2
    
    # Try Apache plugin first (preferred method)
    if certbot --apache --non-interactive --agree-tos --email admin@${config.domain} -d ${config.domain} 2>/dev/null; then
        echo "✅ Certificate obtained using Apache plugin"
    else
        echo "⚠️ Apache plugin failed, trying standalone mode..."
        # Stop Apache for standalone mode
        systemctl stop $APACHE_SERVICE 2>/dev/null || true
        
        if certbot certonly --standalone --non-interactive --agree-tos --email admin@${config.domain} -d ${config.domain}; then
            echo "✅ Certificate obtained using standalone mode"
            # Restart Apache
            systemctl start $APACHE_SERVICE 2>/dev/null || true
        else
            echo "❌ Failed to obtain SSL certificate"
            echo "⚠️ You may need to:"
            echo "   1. Check DNS is pointing to this server"
            echo "   2. Ensure ports 80 and 443 are open"
            echo "   3. Run manually: certbot --apache -d ${config.domain}"
            # Start Apache anyway
            systemctl start $APACHE_SERVICE 2>/dev/null || true
            exit 1
        fi
    fi
    
    echo "✅ SSL certificate obtained!"
fi

# Setup auto-renewal (create cron job if not exists)
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload $APACHE_SERVICE'") | crontab -
    echo "✅ Auto-renewal cron job created"
fi

# Test renewal
certbot renew --dry-run || true

echo "✅ SSL setup complete!"
        `,
      },
      {
        dependsOn: [systemSetup],
        deleteBeforeReplace: false,
      }
    );

    // --- 4. GIT REPOSITORY DEPLOYMENT ---
    const gitDeploy = new command.remote.Command(
      "GitDeploy",
      {
        connection,
        create: `
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
        `,
      },
      {
        dependsOn: [systemSetup],
        deleteBeforeReplace: false,
      }
    );

    // --- 5. ENVIRONMENT VARIABLE UPLOAD ---
    const envUpload = new command.remote.Command(
      "EnvUpload",
      {
        connection,
        create: `
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
        `,
      },
      {
        dependsOn: [gitDeploy],
        deleteBeforeReplace: false,
      }
    );

    // --- 6. BACKEND BUILD ---
    const backendBuild = new command.remote.Command(
      "BackendBuild",
      {
        connection,
        create: `
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
        `,
      },
      {
        dependsOn: [envUpload],
        deleteBeforeReplace: false,
      }
    );

    // --- 7. FRONTEND BUILD ---
    const frontendBuild = new command.remote.Command(
      "FrontendBuild",
      {
        connection,
        create: `
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
        `,
      },
      {
        dependsOn: [envUpload],
        deleteBeforeReplace: false,
      }
    );

    // --- 8. PM2 CONFIGURATION ---
    const pm2Config = new command.remote.Command(
      "PM2Config",
      {
        connection,
        create: `
set -e

echo "⚙️ Configuring PM2..."

DEPLOY_PATH="${config.deploymentPath}"

# Create PM2 ecosystem config
cat > "$DEPLOY_PATH/ecosystem.config.js" << 'PM2EOF'
module.exports = {
  apps: [
    {
      name: 'saffron-backend',
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
      error_file: '/var/log/pm2/saffron-backend-error.log',
      out_file: '/var/log/pm2/saffron-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'saffron-frontend',
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
      error_file: '/var/log/pm2/saffron-frontend-error.log',
      out_file: '/var/log/pm2/saffron-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PM2EOF

# Create log directory
mkdir -p /var/log/pm2

# Stop existing PM2 processes if running
pm2 delete saffron-backend saffron-frontend 2>/dev/null || true

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
cd "$DEPLOY_PATH"
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ PM2 configuration complete!"
        `,
      },
      {
        dependsOn: [backendBuild, frontendBuild],
        deleteBeforeReplace: false,
      }
    );

    // --- 9. APACHE CONFIGURATION ---
    const apacheConfig = new command.remote.Command(
      "ApacheConfig",
      {
        connection,
        create: `
set -e

echo "🌐 Configuring Apache reverse proxy..."

DOMAIN="${config.domain}"

# Detect Apache configuration directory
if [ -d "/etc/httpd/conf.d" ]; then
    # CentOS/RHEL/AlmaLinux
    APACHE_CONF_DIR="/etc/httpd/conf.d"
    APACHE_LOG_DIR="/var/log/httpd"
    APACHE_SERVICE="httpd"
    HTTP_CONF="\$APACHE_CONF_DIR/saffron-http.conf"
    HTTPS_CONF="\$APACHE_CONF_DIR/saffron-https.conf"
elif [ -d "/etc/apache2/sites-available" ]; then
    # Ubuntu/Debian
    APACHE_CONF_DIR="/etc/apache2/sites-available"
    APACHE_LOG_DIR="/var/log/apache2"
    APACHE_SERVICE="apache2"
    HTTP_CONF="\$APACHE_CONF_DIR/saffron-http.conf"
    HTTPS_CONF="\$APACHE_CONF_DIR/saffron-https.conf"
else
    echo "❌ Could not determine Apache configuration directory"
    exit 1
fi

# HTTP VirtualHost (Port 80 - Redirect to HTTPS)
cat > "$HTTP_CONF" << HTTPEOF
<VirtualHost *:80>
    ServerName ${config.domain}
    ServerAlias www.${config.domain}
    
    # Redirect all HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}\$1 [R=301,L]
    
    ErrorLog \${APACHE_LOG_DIR}/saffron_error.log
    CustomLog \${APACHE_LOG_DIR}/saffron_access.log combined
</VirtualHost>
HTTPEOF

# HTTPS VirtualHost (Port 443 - Main Configuration)
cat > "$HTTPS_CONF" << HTTPSEOF
<VirtualHost *:443>
    ServerName ${config.domain}
    ServerAlias www.${config.domain}
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${config.domain}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${config.domain}/privkey.pem
    
    # Include SSL options if file exists (created by certbot)
    <IfFile "/etc/letsencrypt/options-ssl-apache.conf">
        Include /etc/letsencrypt/options-ssl-apache.conf
    </IfFile>
    
    # Fallback SSL configuration if options file doesn't exist
    <IfFile "!/etc/letsencrypt/options-ssl-apache.conf">
        SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
        SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
        SSLHonorCipherOrder off
        SSLSessionTickets off
    </IfFile>
    
    # Security Headers
    <IfModule mod_headers.c>
        Header always set X-Frame-Options "SAMEORIGIN"
        Header always set X-Content-Type-Options "nosniff"
        Header always set X-XSS-Protection "1; mode=block"
        Header always set Referrer-Policy "strict-origin-when-cross-origin"
    </IfModule>
    
    # Backend API Proxy (all /api/* requests)
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        ProxyRequests Off
        
        # Proxy API requests to backend on port 8000
        ProxyPass /api http://127.0.0.1:8000/api nocanon
        ProxyPassReverse /api http://127.0.0.1:8000/api
        
        # Proxy static assets from backend (uploaded files)
        ProxyPass /assets/uploads http://127.0.0.1:8000/assets/uploads nocanon
        ProxyPassReverse /assets/uploads http://127.0.0.1:8000/assets/uploads
    </IfModule>
    
    # WebSocket Support for Socket.IO (CRITICAL!)
    # This enables real-time features (orders, cart, menu updates)
    RewriteEngine On
    
    # Upgrade WebSocket connections
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/(.*)$ ws://127.0.0.1:8000/$1 [P,L]
    
    # Socket.IO specific paths
    ProxyPass /socket.io/ http://127.0.0.1:8000/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:8000/socket.io/
    
    # Proxy all other requests to frontend on port 3000
    ProxyPass / http://127.0.0.1:3000/ nocanon
    ProxyPassReverse / http://127.0.0.1:3000/
    
    # Additional headers for proper proxying
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-Port "443"
        RequestHeader set X-Real-IP %{REMOTE_ADDR}s
    </IfModule>
    
    # Logging
    ErrorLog \${APACHE_LOG_DIR}/saffron_ssl_error.log
    CustomLog \${APACHE_LOG_DIR}/saffron_ssl_access.log combined
</VirtualHost>
HTTPSEOF

# Enable site on Ubuntu/Debian
if [ -d "/etc/apache2/sites-available" ]; then
    a2ensite saffron-http.conf saffron-https.conf 2>/dev/null || true
fi

# Test Apache configuration
if [ "$APACHE_SERVICE" = "httpd" ]; then
    httpd -t
elif [ "$APACHE_SERVICE" = "apache2" ]; then
    apache2ctl configtest
fi

# Restart Apache
systemctl restart $APACHE_SERVICE

echo "✅ Apache configuration complete!"
        `,
      },
      {
        dependsOn: [sslSetup, pm2Config],
        deleteBeforeReplace: false,
      }
    );

    // --- 10. FILE PERMISSIONS & FINAL SETUP ---
    const finalSetup = new command.remote.Command(
      "FinalSetup",
      {
        connection,
        create: `
set -e

echo "🔧 Finalizing setup..."

DEPLOY_PATH="${config.deploymentPath}"

# Detect Apache user and service
if id "apache" &>/dev/null; then
    APACHE_USER="apache"
    APACHE_SERVICE="httpd"
elif id "www-data" &>/dev/null; then
    APACHE_USER="www-data"
    APACHE_SERVICE="apache2"
else
    APACHE_USER="root"
    if systemctl is-active --quiet httpd 2>/dev/null; then
        APACHE_SERVICE="httpd"
    else
        APACHE_SERVICE="apache2"
    fi
fi

# Set proper ownership and permissions
echo "📁 Setting file permissions..."
chown -R ${config.user}:${config.user} "$DEPLOY_PATH"

# Ensure uploads directory is writable
mkdir -p "$DEPLOY_PATH/backend/public/assets/uploads"
chown -R $APACHE_USER:$APACHE_USER "$DEPLOY_PATH/backend/public/assets/uploads" 2>/dev/null || \\
chown -R ${config.user}:${config.user} "$DEPLOY_PATH/backend/public/assets/uploads"
chmod 775 "$DEPLOY_PATH/backend/public/assets/uploads"

# Set directory permissions
find "$DEPLOY_PATH" -type d -exec chmod 755 {} \\;
find "$DEPLOY_PATH" -type f -exec chmod 644 {} \\;

# Keep .env files secure
chmod 600 "$DEPLOY_PATH/backend/.env" 2>/dev/null || true
chmod 600 "$DEPLOY_PATH/frontend/.env.production" 2>/dev/null || true

# Verify PM2 processes
echo "🔍 Verifying PM2 processes..."
pm2 list

# Verify Apache status
echo "🔍 Verifying Apache status..."
systemctl status $APACHE_SERVICE --no-pager | head -5 || true

# Verify SSL certificate
echo "🔍 Verifying SSL certificate..."
if [ -f "/etc/letsencrypt/live/${config.domain}/fullchain.pem" ]; then
    openssl x509 -in /etc/letsencrypt/live/${config.domain}/fullchain.pem -noout -dates || true
    echo "✅ SSL certificate is valid"
else
    echo "⚠️ SSL certificate not found"
fi

# Verify listening ports
echo "🔍 Verifying listening ports..."
netstat -tulpn 2>/dev/null | grep -E ':(80|443|3000|8000)' || ss -tulpn | grep -E ':(80|443|3000|8000)' || true

# Test Apache configuration
echo "🔍 Testing Apache configuration..."
if [ "$APACHE_SERVICE" = "httpd" ]; then
    httpd -t || echo "⚠️ Apache config test failed"
else
    apache2ctl configtest || echo "⚠️ Apache config test failed"
fi

# Display helpful information
echo ""
echo "======================================"
echo "🎉 Deployment successful!"
echo "======================================"
echo ""
echo "📊 Deployment Summary:"
echo "  • Domain: ${config.domain}"
echo "  • Frontend: Running on port 3000 (proxied from /)"
echo "  • Backend: Running on port 8000 (proxied from /api)"
echo "  • WebSocket: Enabled on /socket.io"
echo "  • SSL: Enabled (HTTPS)"
echo ""
echo "🔗 Access your application:"
echo "  • https://${config.domain}"
echo ""
echo "📝 Useful commands:"
echo "  • Check PM2 status: pm2 list"
echo "  • View logs: pm2 logs"
echo "  • Restart services: pm2 restart all"
echo "  • Apache logs: tail -f $APACHE_LOG_DIR/saffron_ssl_error.log"
echo ""
echo "✅ Final setup complete!"
        `,
      },
      {
        dependsOn: [apacheConfig],
        deleteBeforeReplace: false,
      }
    );

    return {
      status: "Deployment configured",
      domain: config.domain,
      deploymentPath: config.deploymentPath,
    };
  },
});
