import type { Config } from "./types";

export function createApacheConfigCommand(config: Config) {
  const httpConf = `${config.appName}-http.conf`;
  const httpsConf = `${config.appName}-https.conf`;

  return `
set -e

echo "🌐 Configuring Apache reverse proxy..."

DOMAIN="${config.domain}"

# Detect Apache configuration directory
if [ -d "/etc/httpd/conf.d" ]; then
    # CentOS/RHEL/AlmaLinux
    APACHE_CONF_DIR="/etc/httpd/conf.d"
    APACHE_LOG_DIR="/var/log/httpd"
    APACHE_SERVICE="httpd"
    HTTP_CONF="\${APACHE_CONF_DIR}/${httpConf}"
    HTTPS_CONF="\${APACHE_CONF_DIR}/${httpsConf}"
elif [ -d "/etc/apache2/sites-available" ]; then
    # Ubuntu/Debian
    APACHE_CONF_DIR="/etc/apache2/sites-available"
    APACHE_LOG_DIR="/var/log/apache2"
    APACHE_SERVICE="apache2"
    HTTP_CONF="\${APACHE_CONF_DIR}/${httpConf}"
    HTTPS_CONF="\${APACHE_CONF_DIR}/${httpsConf}"
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
    RewriteRule ^(.*)$ https://%{HTTP_HOST}\\$1 [R=301,L]
    
    ErrorLog \${APACHE_LOG_DIR}/${config.appName}_error.log
    CustomLog \${APACHE_LOG_DIR}/${config.appName}_access.log combined
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
    # Socket.IO requires WebSocket tunneling for real-time features
    RewriteEngine On
    
    # Enable WebSocket proxy for Socket.IO
    <Location /socket.io/>
        RewriteEngine On
        RewriteCond %{HTTP:Upgrade} websocket [NC]
        RewriteCond %{HTTP:Connection} upgrade [NC]
        RewriteRule .* ws://127.0.0.1:8000%{REQUEST_URI} [P,L]
        
        ProxyPass ws://127.0.0.1:8000/socket.io/
        ProxyPassReverse ws://127.0.0.1:8000/socket.io/
    </Location>
    
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
    ErrorLog \${APACHE_LOG_DIR}/${config.appName}_ssl_error.log
    CustomLog \${APACHE_LOG_DIR}/${config.appName}_ssl_access.log combined
</VirtualHost>
HTTPSEOF

# Enable site on Ubuntu/Debian
if [ -d "/etc/apache2/sites-available" ]; then
    a2ensite ${httpConf} ${httpsConf} 2>/dev/null || true
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
  `;
}
