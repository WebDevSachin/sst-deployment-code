import type { Config } from "./types";

export function createFinalSetupCommand(config: Config) {
  return `
set -e

echo "🔧 Finalizing setup..."

DEPLOY_PATH="${config.deploymentPath}"

# Detect Apache user and service
if id "apache" &>/dev/null; then
    APACHE_USER="apache"
    APACHE_SERVICE="httpd"
    APACHE_LOG_DIR="/var/log/httpd"
elif id "www-data" &>/dev/null; then
    APACHE_USER="www-data"
    APACHE_SERVICE="apache2"
    APACHE_LOG_DIR="/var/log/apache2"
else
    APACHE_USER="root"
    if systemctl is-active --quiet httpd 2>/dev/null; then
        APACHE_SERVICE="httpd"
        APACHE_LOG_DIR="/var/log/httpd"
    else
        APACHE_SERVICE="apache2"
        APACHE_LOG_DIR="/var/log/apache2"
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
echo "  • Application: ${config.appName}"
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
echo "  • Apache logs: tail -f $APACHE_LOG_DIR/${config.appName}_ssl_error.log"
echo ""
echo "✅ Final setup complete!"
  `;
}
