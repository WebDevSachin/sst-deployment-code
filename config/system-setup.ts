import type { Config, Connection } from "./types";

export function createSystemSetupCommand(config: Config) {
  return `
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
  `;
}
