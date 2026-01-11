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
    echo "✅ SSL certificate already exists, skipping certificate acquisition..."
    # Note: Skipping dry-run as it requires valid virtual hosts
else
    echo "📜 Obtaining SSL certificate..."
    
    # Check if cPanel is installed
    if [ -d "/usr/local/cpanel" ]; then
        echo "🎛️ cPanel detected, using cPanel AutoSSL..."
        
        # Try cPanel AutoSSL
        if [ -f "/usr/local/cpanel/bin/whmapi1" ]; then
            # Set AutoSSL provider to Let's Encrypt
            /usr/local/cpanel/bin/whmapi1 set_autossl_provider provider=LetsEncrypt 2>/dev/null || true
            
            # Get cPanel username from domain or use current user
            CPANEL_USER=\$(ls -la /var/cpanel/users/ 2>/dev/null | grep -v "^d" | awk '{print \$9}' | head -1)
            if [ -n "\$CPANEL_USER" ]; then
                echo "📋 Running AutoSSL for user: \$CPANEL_USER"
                /scripts/autossl_check --user=\$CPANEL_USER 2>/dev/null || true
            fi
            
            # If cPanel SSL worked, certificate should be installed
            if [ -f "/etc/letsencrypt/live/${config.domain}/fullchain.pem" ] || [ -f "/var/cpanel/ssl/apache_tls/${config.domain}/combined" ]; then
                echo "✅ Certificate obtained using cPanel AutoSSL"
            else
                echo "⚠️ cPanel AutoSSL didn't install certificate, falling back to certbot..."
            fi
        fi
    fi
    
    # If no cPanel or cPanel failed, use standard certbot
    if [ ! -f "/etc/letsencrypt/live/${config.domain}/fullchain.pem" ]; then
        echo "🔐 Using Let's Encrypt with certbot..."
        
        # Ensure Apache is running (needed for certbot --apache)
        systemctl start $APACHE_SERVICE 2>/dev/null || true
        sleep 2
        
        # Try Apache plugin first (preferred method)
        if certbot --apache --non-interactive --agree-tos --email admin@${config.domain} -d ${config.domain} 2>/dev/null; then
            echo "✅ Certificate obtained using certbot Apache plugin"
        else
            echo "⚠️ Apache plugin failed, trying standalone mode..."
            # Stop Apache for standalone mode
            systemctl stop $APACHE_SERVICE 2>/dev/null || true
            
            if certbot certonly --standalone --non-interactive --agree-tos --email admin@${config.domain} -d ${config.domain}; then
                echo "✅ Certificate obtained using certbot standalone mode"
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
    fi
    
    echo "✅ SSL certificate obtained!"
fi

# Setup auto-renewal (create cron job if not exists)
if command -v crontab &> /dev/null; then
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload $APACHE_SERVICE'") | crontab - 2>/dev/null || echo "⚠️ Could not create cron job, please set up renewal manually"
        echo "✅ Auto-renewal cron job created (or use certbot's built-in timer)"
    fi
else
    echo "ℹ️ crontab not available, relying on certbot's systemd timer for auto-renewal"
fi

echo "✅ SSL setup complete!"
  `;
}
