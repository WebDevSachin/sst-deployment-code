# CentOS/AlmaLinux Compatibility Guide

## Overview

This deployment solution is fully compatible with both **Ubuntu/Debian (apt)** and **CentOS/RHEL/AlmaLinux (dnf)** systems. The script automatically detects the OS and adapts all installation and configuration commands accordingly.

## CentOS-Specific Enhancements

### 1. **Firewall Configuration (firewalld)**

On CentOS systems, `firewalld` is enabled by default and blocks HTTP/HTTPS traffic. The script automatically configures it:

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

**Ports Opened:**
- Port 80 (HTTP)
- Port 443 (HTTPS)

### 2. **SELinux Configuration**

CentOS has SELinux enabled by default, which blocks Apache from making network connections (required for reverse proxy). The script automatically configures it:

```bash
setsebool -P httpd_can_network_connect 1
setsebool -P httpd_can_network_relay 1
```

These settings allow Apache to:
- Connect to backend services (port 8000)
- Connect to frontend services (port 3000)
- Handle WebSocket connections

### 3. **Apache Modules**

On CentOS, Apache modules need to be explicitly loaded. The script ensures all required modules are enabled:

```bash
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
```

**Location:** `/etc/httpd/conf.modules.d/00-proxy.conf`

### 4. **SSL Certificate Management**

The script handles SSL certificates intelligently on both systems:

1. **Apache Plugin (Preferred):** Tries `certbot --apache` first
2. **Standalone Mode (Fallback):** If Apache plugin fails, uses standalone mode
3. **Auto-Renewal:** Automatically sets up cron job for certificate renewal

**SSL Configuration Fallback:**

If `/etc/letsencrypt/options-ssl-apache.conf` doesn't exist (edge case on some CentOS systems), the script includes fallback SSL settings:

```apache
SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...
SSLHonorCipherOrder off
SSLSessionTickets off
```

### 5. **Database Server**

- **CentOS/RHEL:** Installs MariaDB
- **Ubuntu/Debian:** Installs MySQL

Both are MySQL-compatible and work with the same connection strings.

### 6. **Apache Service Names**

The script automatically detects and uses the correct service name:
- **CentOS:** `httpd`
- **Ubuntu:** `apache2`

### 7. **Configuration File Locations**

#### CentOS/RHEL:
- **Config Directory:** `/etc/httpd/conf.d/`
- **Log Directory:** `/var/log/httpd/`
- **Modules:** `/etc/httpd/conf.modules.d/`
- **Apache User:** `apache`

#### Ubuntu/Debian:
- **Config Directory:** `/etc/apache2/sites-available/`
- **Log Directory:** `/var/log/apache2/`
- **Modules:** `/etc/apache2/mods-available/`
- **Apache User:** `www-data`

## Verification Steps

After deployment, verify everything is working:

### 1. Check Firewall Rules (CentOS)

```bash
firewall-cmd --list-services
# Should show: http https
```

### 2. Check SELinux Booleans (CentOS)

```bash
getsebool httpd_can_network_connect
getsebool httpd_can_network_relay
# Both should be: on
```

### 3. Check Apache Modules

**CentOS:**
```bash
httpd -M | grep -E 'proxy|rewrite|ssl'
```

**Ubuntu:**
```bash
apache2ctl -M | grep -E 'proxy|rewrite|ssl'
```

Should show:
- `proxy_module`
- `proxy_http_module`
- `proxy_wstunnel_module`
- `rewrite_module`
- `ssl_module`

### 4. Check Apache Configuration

**CentOS:**
```bash
httpd -t
```

**Ubuntu:**
```bash
apache2ctl configtest
```

Should output: `Syntax OK`

### 5. Check Listening Ports

```bash
ss -tulpn | grep -E ':(80|443|3000|8000)'
```

Should show:
- Port 80 (Apache/httpd)
- Port 443 (Apache/httpd)
- Port 3000 (node - frontend)
- Port 8000 (node - backend)

### 6. Check SSL Certificate

```bash
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com < /dev/null
```

Should show valid certificate details.

### 7. Check PM2 Processes

```bash
pm2 list
```

Should show:
- `app-backend` (online)
- `app-frontend` (online)

## Common CentOS Issues & Solutions

### Issue 1: 502 Bad Gateway

**Cause:** SELinux blocking Apache proxy connections

**Solution:**
```bash
setsebool -P httpd_can_network_connect 1
setsebool -P httpd_can_network_relay 1
systemctl restart httpd
```

### Issue 2: Cannot Access via HTTP/HTTPS

**Cause:** Firewall blocking ports

**Solution:**
```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### Issue 3: SSL Certificate Failed

**Cause:** DNS not pointing to server or ports blocked

**Solution:**
1. Verify DNS: `dig yourdomain.com +short`
2. Check firewall: `firewall-cmd --list-services`
3. Manual certificate: `certbot --apache -d yourdomain.com`

### Issue 4: Apache Won't Start

**Cause:** Configuration syntax error

**Solution:**
```bash
# Check config
httpd -t

# Check logs
tail -f /var/log/httpd/error_log

# Fix config and restart
vi /etc/httpd/conf.d/app-https.conf
systemctl restart httpd
```

### Issue 5: WebSocket Connection Failed

**Cause:** Missing proxy_wstunnel module

**Solution:**
```bash
# Check if module exists
ls -la /etc/httpd/modules/mod_proxy_wstunnel.so

# Reload module configuration
systemctl restart httpd
```

## System Requirements

### CentOS/AlmaLinux Requirements:
- **OS Version:** CentOS 8+, AlmaLinux 8+, RHEL 8+
- **Architecture:** x86_64
- **RAM:** Minimum 2GB (4GB recommended)
- **Disk Space:** Minimum 20GB free
- **Network:** Public IP with ports 22, 80, 443 accessible

### Pre-flight Checklist:
- [ ] DNS A record points to server IP
- [ ] Ports 22, 80, 443 are accessible from internet
- [ ] Root or sudo access available
- [ ] SSH key authentication configured
- [ ] Git repository is accessible

## Performance Optimizations

### 1. Apache Performance (CentOS)

Edit `/etc/httpd/conf/httpd.conf`:

```apache
# Increase max clients
<IfModule mpm_prefork_module>
    StartServers             5
    MinSpareServers          5
    MaxSpareServers          10
    MaxRequestWorkers        150
    MaxConnectionsPerChild   1000
</IfModule>

# Enable compression
LoadModule deflate_module modules/mod_deflate.so
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

### 2. Node.js Memory

Edit `/var/www/app/ecosystem.config.js`:

```javascript
max_memory_restart: '2G',  // Increase if you have more RAM
node_args: '--max-old-space-size=4096'
```

### 3. MySQL/MariaDB Performance

```bash
# Edit my.cnf
vi /etc/my.cnf.d/server.cnf

[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
```

## Security Best Practices

### 1. Firewall (Only Essential Ports)

```bash
# Remove all services
firewall-cmd --permanent --remove-service=cockpit
firewall-cmd --permanent --remove-service=dhcpv6-client

# Add only required
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### 2. SSH Hardening

```bash
# Edit SSH config
vi /etc/ssh/sshd_config

# Disable password auth (use keys only)
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password

# Restart SSH
systemctl restart sshd
```

### 3. Regular Updates

```bash
# Auto-update security patches
dnf install -y dnf-automatic
systemctl enable --now dnf-automatic-install.timer
```

### 4. Fail2ban (Brute Force Protection)

```bash
dnf install -y fail2ban
systemctl enable --now fail2ban

# Configure
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
EOF

systemctl restart fail2ban
```

## Monitoring Commands

### System Health
```bash
# CPU/Memory
htop

# Disk usage
df -h

# Network connections
ss -tulpn
```

### Application Health
```bash
# PM2 processes
pm2 monit

# PM2 logs
pm2 logs --lines 100

# Apache logs
tail -f /var/log/httpd/app_ssl_error.log

# Database connections
mysql -e "SHOW PROCESSLIST;"
```

### Performance Testing
```bash
# Test HTTPS endpoint
curl -I https://yourdomain.com

# Test API
curl https://yourdomain.com/api/health

# Load test (install ab first)
ab -n 1000 -c 10 https://yourdomain.com/
```

## Backup Strategy

### 1. Database Backup (Automated)

```bash
# Create backup script
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root app_db > /backups/db_$DATE.sql
find /backups -name "db_*.sql" -mtime +7 -delete
EOF

chmod +x /root/backup-db.sh

# Add to cron
crontab -e
0 2 * * * /root/backup-db.sh
```

### 2. Application Files

```bash
# Backup deployment
tar -czf /backups/app_$(date +%Y%m%d).tar.gz /var/www/app

# Exclude node_modules
tar --exclude='node_modules' --exclude='.next' -czf /backups/app_$(date +%Y%m%d).tar.gz /var/www/app
```

## Conclusion

This deployment solution is production-ready for both Ubuntu and CentOS systems. It handles all OS-specific configurations automatically, including:

- ✅ Firewall setup
- ✅ SELinux configuration  
- ✅ Apache module loading
- ✅ SSL certificate management
- ✅ Service name detection
- ✅ Database installation

The deployment is idempotent and can be run multiple times safely.
