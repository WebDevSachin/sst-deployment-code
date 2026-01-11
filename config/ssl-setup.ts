import type { Config } from "./types";

export function createSSLSetupCommand(config: Config) {
  return `
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
  `;
}
