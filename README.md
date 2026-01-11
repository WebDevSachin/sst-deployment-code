# Full-Stack Application - Automated Deployment with SST

**Infrastructure as Code** solution for deploying full-stack Node.js applications (Next.js frontend + Express/Node backend) to Linux servers using SST and Pulumi Command provider.

## Features

- **Cross-Platform**: Auto-detects Ubuntu/Debian (apt) or CentOS/AlmaLinux/Rocky Linux (dnf)
- **Dynamic Configuration**: Application name, ports, and paths configured via `.env`
- **Automated SSL**: cPanel AutoSSL detection with Let's Encrypt fallback
- **Modular Architecture**: Clean, maintainable code structure in `config/` directory
- **Idempotent**: Safe to run multiple times without side effects
- **WebSocket Support**: Proper Apache configuration for Socket.IO
- **Zero-Downtime**: PM2 handles graceful process restarts
- **Security Hardened**: SELinux, firewall, HTTPS-only with strong ciphers

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy example files and update with your values:

```bash
cp .env.example .env
cp .env.backend.example .env.backend
cp .env.frontend.example .env.frontend
```

**Required in `.env`:**
```env
APP_NAME=myapp                              # Application identifier
SERVER_IP=your-server.com                    # Server hostname or IP
SSH_USER=root                                # SSH username
SSH_KEY_PATH=/path/to/private/key           # SSH private key path
GIT_REPO_URL=https://github.com/user/repo.git
GIT_TOKEN=github_pat_xxxxx                  # GitHub PAT
DOMAIN=yourdomain.com                        # Production domain
NODE_VERSION=22                              # Node.js version
```

### 3. Deploy

```bash
npx sst deploy
```

That's it! The deployment will:
- Install all required software (Node.js, PM2, Apache, SSL tools)
- Obtain SSL certificate (cPanel or Let's Encrypt)
- Clone your repository
- Build frontend and backend
- Configure PM2 for process management
- Set up Apache reverse proxy with WebSocket support
- Start your application

## Deploying to Your Own Server

Follow these steps to deploy your application to a fresh server:

### Prerequisites

1. **A Linux Server** (Ubuntu/Debian or CentOS/AlmaLinux/Rocky)
   - Fresh VPS or existing server
   - Root or sudo access
   - Minimum 1GB RAM recommended

2. **Your Application Repository**
   - Git repository with your code
   - Monorepo structure: `backend/` and `frontend/` folders
   - GitHub Personal Access Token with repo access

3. **Domain Name** (recommended)
   - Domain pointed to your server's IP (A record)
   - Wait for DNS propagation before deployment

### Step-by-Step Deployment

#### 1. Set Up SSH Access

Generate an SSH key if you don't have one:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your_email@example.com"
# Save to: ~/.ssh/id_ed25519
```

Copy the SSH key to your server:

```bash
# Replace with your server IP
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@your-server-ip
```

Test SSH connection:

```bash
ssh -i ~/.ssh/id_ed25519 root@your-server-ip
```

#### 2. Clone This Deployment Repository

```bash
git clone https://github.com/WebDevSachin/sst-deployment-code.git
cd sst-deployment-code
npm install
```

#### 3. Configure Environment Files

The deployment uses **three separate `.env` files**:

| Local File | Copied To Server | Used For |
|------------|------------------|----------|
| `.env` | Not copied (deployment config only) | SSH connection, Git clone, deployment settings |
| `.env.backend` | `→ backend/.env` | Backend build & runtime (database, JWT, APIs) |
| `.env.frontend` | `→ frontend/.env.production` | Frontend build (NEXT_PUBLIC_* variables) |

**Create your environment files:**

```bash
cp .env.example .env
cp .env.backend.example .env.backend
cp .env.frontend.example .env.frontend
```

**Important:** `.env.backend` and `.env.frontend` are uploaded to the server **BEFORE** building, so build errors will show if variables are missing or incorrect.

**Edit `.env`:**

```env
# Your app name (used for PM2 processes, logs, configs)
APP_NAME=myapp

# Your server details
SERVER_IP=your-server-ip-or-domain.com
SSH_USER=root
SSH_KEY_PATH=/Users/yourname/.ssh/id_ed25519

# Your Git repository
GIT_REPO_URL=https://github.com/yourusername/your-app-repo.git
GIT_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxx  # Get from GitHub settings
GIT_BRANCH=main

# Your domain
DOMAIN=yourdomain.com

# Node.js version
NODE_VERSION=22

# Deployment path (optional)
DEPLOYMENT_PATH=/var/www/myapp
```

**Edit `.env.backend`:**

```env
# Database credentials (will be created automatically)
DATABASE_URL="mysql://app_user:YOUR_STRONG_PASSWORD@localhost:3306/app_db"

# JWT secrets (generate random strings)
JWT_SECRET="YOUR_RANDOM_SECRET_32_CHARS_OR_MORE"
JWT_REFRESH_SECRET="YOUR_DIFFERENT_RANDOM_SECRET"

# URLs (use your actual domain)
FRONTEND_URL="https://yourdomain.com"
API_BASE_URL="https://yourdomain.com"

# Email settings (if needed)
EMAIL_USER="noreply@yourdomain.com"
EMAIL_FROM="noreply@yourdomain.com"
```

**Edit `.env.frontend`:**

```env
# API endpoints (use your actual domain)
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
NEXT_PUBLIC_ADMIN_URL=https://yourdomain.com

# JWT secret (same as backend)
JWT_SECRET=YOUR_RANDOM_SECRET_32_CHARS_OR_MORE
```

#### 4. Verify Configuration

Check that all required variables are set:

```bash
# View your configuration (hides sensitive data)
cat .env | grep -v TOKEN | grep -v SECRET
```

#### 5. Deploy!

Run the deployment:

```bash
npx sst deploy
```

**What happens during deployment:**

```mermaid
graph TD
    A[npx sst deploy] --> B[1. SystemSetup]
    B --> C[Detect OS]
    C --> D[Install Node.js, PM2, Apache, MySQL]
    D --> E[2. SSLSetup]
    E --> F[Obtain SSL Certificate]
    F --> G[3. GitDeploy]
    G --> H[Clone/Pull Repository]
    H --> I[4. EnvUpload]
    I --> J[Upload .env.backend → backend/.env]
    J --> K[Upload .env.frontend → frontend/.env.production]
    K --> L[5. BackendBuild]
    L --> M{Build Success?}
    M -->|Yes| N[6. FrontendBuild]
    M -->|No| O[Show Error & Exit]
    N --> P{Build Success?}
    P -->|Yes| Q[7. PM2Config]
    P -->|No| R[Show Error & Exit]
    Q --> S[8. ApacheConfig]
    S --> T[9. FinalSetup]
    T --> U[✅ Deployment Complete]
```

**Detailed Steps:**
1. ✅ **SystemSetup** - Detects OS (Ubuntu/CentOS), installs Node.js, PM2, Apache, MySQL/MariaDB
2. ✅ **SSLSetup** - Obtains SSL certificate (cPanel AutoSSL or Let's Encrypt)
3. ✅ **GitDeploy** - Clones your Git repository to `/var/www/APP_NAME`
4. ✅ **EnvUpload** - Copies `.env.backend` → `backend/.env` and `.env.frontend` → `frontend/.env.production`
5. ✅ **BackendBuild** - Runs `npm install`, Prisma generate/migrate, TypeScript build
6. ✅ **FrontendBuild** - Runs `npm install`, Next.js build with environment variables
7. ✅ **PM2Config** - Starts backend (port 8000) and frontend (port 3000) processes
8. ✅ **ApacheConfig** - Configures reverse proxy with WebSocket support
9. ✅ **FinalSetup** - Sets permissions and verifies deployment

**Error Handling:**
- If any build step fails, the deployment stops immediately
- Full error logs are displayed in the terminal
- Build logs are saved to `/tmp/` on the server for debugging
- Common errors (missing .env, TypeScript errors, etc.) show helpful troubleshooting tips

Deployment takes 3-5 minutes on first run.

#### 6. Verify Deployment

After deployment completes, test your application:

```bash
# Check SSL certificate
curl -I https://yourdomain.com

# Check API endpoint
curl https://yourdomain.com/api/health

# Check PM2 processes
ssh root@your-server-ip "pm2 list"

# Check Apache status
ssh root@your-server-ip "systemctl status apache2"
```

Visit your domain in a browser: `https://yourdomain.com`

### Updating Your Application

To deploy updates after making changes:

```bash
# 1. Push changes to your Git repository
git add .
git commit -m "Your changes"
git push origin main

# 2. Run deployment again (it will pull latest code)
npx sst deploy
```

The deployment script is **idempotent** - it safely updates existing installations.

### Debugging Build Errors

If your deployment fails during the build step, you'll see detailed error messages in the terminal. Here's how to debug:

#### Backend Build Errors

**Error Example:**
```
❌ ERROR: Backend build failed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build error details:
src/server.ts:15:3 - error TS2322: Type 'string' is not assignable to type 'number'.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Debugging Steps:**
1. **Fix the error locally first:**
   ```bash
   cd your-app-repo/backend
   npm run build  # Test build locally
   ```

2. **Check environment variables:**
   - Verify `.env.backend` has all required variables
   - Check `DATABASE_URL` format is correct
   - Ensure `JWT_SECRET` is set

3. **View full build log on server:**
   ```bash
   ssh root@your-server-ip "cat /tmp/backend-build.log"
   ```

4. **Common issues:**
   - Missing dependencies in `package.json`
   - TypeScript errors in code
   - Invalid Prisma schema
   - Missing environment variables

#### Frontend Build Errors

**Error Example:**
```
❌ ERROR: Frontend build failed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error: Environment variable not found: NEXT_PUBLIC_API_URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Debugging Steps:**
1. **Verify environment variables:**
   ```bash
   # Check your local .env.frontend
   cat .env.frontend | grep NEXT_PUBLIC
   ```
   All client-side variables MUST have `NEXT_PUBLIC_` prefix!

2. **Test build locally:**
   ```bash
   cd your-app-repo/frontend
   npm run build  # Test build locally
   ```

3. **Check URLs are valid:**
   - `NEXT_PUBLIC_API_URL` should be `https://yourdomain.com/api`
   - `NEXT_PUBLIC_WS_URL` should be `wss://yourdomain.com` (not `ws://`)

4. **View full build log on server:**
   ```bash
   ssh root@your-server-ip "cat /tmp/frontend-build.log"
   ```

5. **Common issues:**
   - Missing `NEXT_PUBLIC_` prefix on client variables
   - Invalid API URLs
   - TypeScript errors in components
   - Missing dependencies

#### After Fixing Errors

Once you've fixed the errors:

```bash
# 1. Commit and push your fixes
git add .
git commit -m "Fix build errors"
git push origin main

# 2. Run deployment again
npx sst deploy
```

The deployment will pull your latest code and retry the build.

### Common Issues & Solutions

**Issue: SSH connection fails**
- Verify SSH key path in `.env`
- Test SSH manually: `ssh -i ~/.ssh/id_ed25519 root@your-server-ip`
- Check server firewall allows SSH (port 22)

**Issue: SSL certificate fails**
- Verify domain DNS points to server IP: `dig yourdomain.com`
- Wait for DNS propagation (can take up to 48 hours)
- Check server firewall allows ports 80 and 443

**Issue: Database connection error**
- Verify `DATABASE_URL` in `.env.backend`
- Check MySQL/MariaDB is running: `systemctl status mysql`
- Verify database and user were created

**Issue: WebSocket not connecting**
- Check Apache modules: `apache2ctl -M | grep proxy_wstunnel`
- Verify `NEXT_PUBLIC_WS_URL` uses `wss://` (secure WebSocket)
- Check Apache error logs: `tail -f /var/log/apache2/myapp_ssl_error.log`

## Supported Operating Systems

### CentOS Stream / AlmaLinux / Rocky Linux (dnf)

**Automatically configured:**
- **Firewall**: firewalld opens ports 80, 443
- **SELinux**: Configured for Apache proxy connections
- **Apache**: httpd with mod_ssl, mod_proxy, mod_proxy_wstunnel
- **Database**: MariaDB server
- **Service**: `httpd`
- **Config Path**: `/etc/httpd/conf.d/`
- **Logs**: `/var/log/httpd/`

**Verification:**
```bash
# Check firewall
firewall-cmd --list-services  # Should show: http https

# Check SELinux
getsebool httpd_can_network_connect  # Should be: on

# Check Apache modules
httpd -M | grep proxy
```

### Ubuntu / Debian (apt)

**Automatically configured:**
- **Firewall**: UFW (if enabled) allows ports 80, 443
- **Apache**: apache2 with required modules enabled
- **Database**: MySQL server
- **Service**: `apache2`
- **Config Path**: `/etc/apache2/sites-available/`
- **Logs**: `/var/log/apache2/`

**Verification:**
```bash
# Check Apache modules
apache2ctl -M | grep proxy

# Check config
apache2ctl configtest
```

## Configuration

### Environment Variables

#### `.env` - Main Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_NAME` | Application identifier (used for PM2, Apache configs, logs) | `myapp` |
| `SERVER_IP` | Server hostname or IP address | `example.com` |
| `SSH_USER` | SSH username (usually root) | `root` |
| `SSH_KEY_PATH` | Path to SSH private key | `/Users/name/.ssh/id_rsa` |
| `GIT_REPO_URL` | Git repository URL | `https://github.com/user/repo.git` |
| `GIT_TOKEN` | GitHub Personal Access Token | `github_pat_xxxxx` |
| `GIT_BRANCH` | Branch to deploy | `main` |
| `DOMAIN` | Production domain name | `yourdomain.com` |
| `NODE_VERSION` | Node.js version to install | `22` |
| `DEPLOYMENT_PATH` | Where to deploy (optional) | `/var/www/myapp` |

#### `.env.backend` - Backend Environment

This file is uploaded to the server at `DEPLOYMENT_PATH/backend/.env`.

**Required variables:**
- `DATABASE_URL` - MySQL/MariaDB connection string
- `JWT_SECRET` - JWT signing key
- `NODE_ENV=production`
- `PORT=8000`
- `FRONTEND_URL` - CORS origin (your domain)

#### `.env.frontend` - Frontend Environment

This file is uploaded to the server at `DEPLOYMENT_PATH/frontend/.env.production`.

**Important:** Variables accessed in browser **must** have `NEXT_PUBLIC_` prefix.

```env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
NODE_ENV=production
```

## SSL Certificate Management

The deployment automatically detects and uses the best SSL solution:

### 1. cPanel AutoSSL (Preferred)

If cPanel is detected (`/usr/local/cpanel/` exists), the script uses cPanel's AutoSSL:

```bash
/usr/local/cpanel/bin/whmapi1 set_autossl_provider provider=LetsEncrypt
/scripts/autossl_check --user=$USER
```

**Benefits:**
- Integrated with cPanel's certificate management
- Automatic renewal handled by cPanel
- Works with cPanel's Apache configuration

### 2. Let's Encrypt (Fallback)

For non-cPanel servers:

1. **Apache Plugin** (tries first): `certbot --apache`
2. **Standalone Mode** (fallback): `certbot certonly --standalone`
3. **Auto-Renewal**: Cron job runs twice daily

**Manual renewal test:**
```bash
certbot renew --dry-run
```

## Modular Architecture

The deployment is organized into focused modules:

```
deployment-solution/
├── sst.config.ts              # Main orchestrator
├── config/
│   ├── types.ts               # TypeScript interfaces
│   ├── load-config.ts         # Environment loader
│   ├── system-setup.ts        # OS detection & software installation
│   ├── ssl-setup.ts           # cPanel/Let's Encrypt SSL
│   ├── git-deploy.ts          # Git clone/pull & env upload
│   ├── build.ts               # Frontend & backend builds
│   ├── pm2-config.ts          # Process management
│   ├── apache-config.ts       # Reverse proxy configuration
│   └── final-setup.ts         # Permissions & verification
└── .env                       # Configuration (not in git)
```

**Benefits:**
- Easy to maintain and extend
- Each module has single responsibility
- Can be tested independently
- Reusable across projects

## PM2 Process Management

Applications run as PM2 processes for reliability:

| Process Name | Description | Port |
|--------------|-------------|------|
| `${APP_NAME}-backend` | Express/Node backend | 8000 |
| `${APP_NAME}-frontend` | Next.js frontend | 3000 |

**Useful Commands:**

```bash
# View all processes
pm2 list

# View logs (live)
pm2 logs

# View specific logs
pm2 logs myapp-backend
pm2 logs myapp-frontend

# Restart application
pm2 restart all
pm2 restart myapp-backend

# Monitor resources
pm2 monit

# Stop application
pm2 stop all

# View detailed info
pm2 show myapp-backend
```

**Log Files:**
- PM2: `/var/log/pm2/${APP_NAME}-backend-error.log`
- Apache: `/var/log/httpd/${APP_NAME}_ssl_error.log` (CentOS)
- Apache: `/var/log/apache2/${APP_NAME}_ssl_error.log` (Ubuntu)

## Apache Reverse Proxy

The deployment configures Apache to proxy requests:

### Traffic Routing

```
HTTP (Port 80) → HTTPS Redirect

HTTPS (Port 443) → Apache Reverse Proxy
  ├── /api/* → Backend (localhost:8000)
  ├── /socket.io/* → Backend WebSocket (localhost:8000)
  ├── /assets/uploads/* → Backend static files (localhost:8000)
  └── /* → Frontend (localhost:3000)
```

### WebSocket Support

Apache is configured to upgrade WebSocket connections for Socket.IO:

```apache
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule ^/(.*)$ ws://127.0.0.1:8000/$1 [P,L]

ProxyPass /socket.io/ http://127.0.0.1:8000/socket.io/
ProxyPassReverse /socket.io/ http://127.0.0.1:8000/socket.io/
```

### Configuration Files

**CentOS/Rocky/AlmaLinux:**
- HTTP: `/etc/httpd/conf.d/${APP_NAME}-http.conf`
- HTTPS: `/etc/httpd/conf.d/${APP_NAME}-https.conf`

**Ubuntu/Debian:**
- HTTP: `/etc/apache2/sites-available/${APP_NAME}-http.conf`
- HTTPS: `/etc/apache2/sites-available/${APP_NAME}-https.conf`

## Deployment Flow

```mermaid
graph TD
    A[npx sst deploy] --> B[SystemSetup]
    B --> C{OS Detection}
    C -->|dnf| D[Install: Node, PM2, httpd, MariaDB]
    C -->|apt| E[Install: Node, PM2, apache2, MySQL]
    D --> F[Configure Firewall & SELinux]
    E --> F
    F --> G[SSLSetup]
    G --> H{cPanel Detected?}
    H -->|Yes| I[Use cPanel AutoSSL]
    H -->|No| J[Use Let's Encrypt]
    I --> K[GitDeploy]
    J --> K
    K --> L[Clone/Pull Repository]
    L --> M[EnvUpload]
    M --> N[Upload .env files]
    N --> O[BackendBuild]
    O --> P[npm install, Prisma, TypeScript]
    P --> Q[FrontendBuild]
    Q --> R[npm install, Next.js build]
    R --> S[PM2Config]
    S --> T[Start processes with PM2]
    T --> U[ApacheConfig]
    U --> V[Configure reverse proxy]
    V --> W[FinalSetup]
    W --> X[Set permissions]
    X --> Y[Verify deployment]
    Y --> Z[Deployment Complete]
```

## Troubleshooting

### CentOS/Rocky/AlmaLinux

#### 502 Bad Gateway

**Cause:** SELinux blocking Apache proxy connections

**Solution:**
```bash
setsebool -P httpd_can_network_connect 1
setsebool -P httpd_can_network_relay 1
systemctl restart httpd
```

#### Firewall Blocking

**Solution:**
```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

#### Check Apache Configuration

```bash
httpd -t  # Test config
tail -f /var/log/httpd/${APP_NAME}_ssl_error.log  # View errors
```

### Ubuntu/Debian

#### Apache Won't Start

```bash
apache2ctl configtest  # Check config
tail -f /var/log/apache2/${APP_NAME}_ssl_error.log  # View errors
```

#### Module Not Loaded

```bash
a2enmod proxy proxy_http proxy_wstunnel ssl rewrite headers
systemctl restart apache2
```

### Common Issues

#### PM2 Processes Not Running

```bash
# Check status
pm2 list

# View logs
pm2 logs --lines 50

# Restart
cd /var/www/myapp
pm2 start ecosystem.config.js
```

#### SSL Certificate Failed

**Check DNS:**
```bash
dig yourdomain.com +short
# Should return your server IP
```

**Manual certificate acquisition:**
```bash
certbot --apache -d yourdomain.com
```

#### WebSocket Connection Failed

**Check Apache modules (CentOS):**
```bash
httpd -M | grep proxy_wstunnel
```

**Check Apache modules (Ubuntu):**
```bash
apache2ctl -M | grep proxy_wstunnel
```

#### Port Already in Use

```bash
# Find process using port
lsof -i :8000
lsof -i :3000

# Kill process
pm2 delete all
```

## Updating Your Application

To deploy updates:

1. Push changes to your Git repository
2. Run deployment again:
```bash
npx sst deploy
```

The deployment will:
- Pull latest code
- Rebuild applications
- Restart PM2 processes
- Reload Apache configuration

## Multiple Applications on One Server

You can deploy multiple applications by using different `APP_NAME` values:

```bash
# Application 1
APP_NAME=shop DOMAIN=shop.example.com npx sst deploy

# Application 2
APP_NAME=blog DOMAIN=blog.example.com npx sst deploy
```

Each application gets:
- Separate PM2 processes
- Separate Apache configurations
- Separate log files
- No conflicts!

## Security Best Practices

1. **Never commit** `.env`, `.env.backend`, or `.env.frontend` to Git
2. **Use strong passwords** for database and JWT secrets
3. **Keep SSH keys secure** with proper permissions (600)
4. **Regular updates**: Keep Node.js and system packages updated
5. **Monitor logs**: Check PM2 and Apache logs regularly
6. **Firewall**: Only ports 22, 80, 443 should be open
7. **SSL**: Always use HTTPS, HTTP traffic is redirected

## Support & Documentation

### File Structure Reference

| File | Description |
|------|-------------|
| `sst.config.ts` | Main SST configuration (orchestrates modules) |
| `config/types.ts` | TypeScript interfaces |
| `config/load-config.ts` | Loads .env and validates configuration |
| `config/system-setup.ts` | OS detection, installs Node, PM2, Apache, DB |
| `config/ssl-setup.ts` | SSL certificate management (cPanel/Let's Encrypt) |
| `config/git-deploy.ts` | Git clone/pull and env file upload |
| `config/build.ts` | Frontend and backend build processes |
| `config/pm2-config.ts` | PM2 ecosystem configuration |
| `config/apache-config.ts` | Apache reverse proxy setup |
| `config/final-setup.ts` | Permissions, verification, and summary |

### Resources

- **SST Documentation**: https://sst.dev/docs
- **PM2 Documentation**: https://pm2.keymetrics.io/docs
- **Pulumi Command Provider**: https://www.pulumi.com/registry/packages/command
- **Let's Encrypt**: https://letsencrypt.org/docs
- **Apache Documentation**: https://httpd.apache.org/docs

### Getting Help

1. Check the troubleshooting section above
2. Review PM2 logs: `pm2 logs`
3. Check Apache logs in `/var/log/httpd/` or `/var/log/apache2/`
4. Verify environment variables are correct
5. Test Apache configuration: `httpd -t` or `apache2ctl configtest`

## License

MIT License - Use freely for personal or commercial projects.

---

**Made with SST** - Infrastructure as Code for modern applications
