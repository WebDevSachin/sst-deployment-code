# Saffron Fullstack - Automated Deployment with SST

Infrastructure as Code solution for deploying the Saffron Fullstack application (Next.js frontend + Node.js backend) to a Linux server using SST and Pulumi Command provider.

## Features

- **OS Agnostic**: Automatically detects and adapts to Ubuntu (apt) or AlmaLinux/CentOS (dnf)
- **Automated SSL**: Certbot integration for Let's Encrypt certificates
- **Secure**: Environment variables read from local files, never committed to Git
- **Idempotent**: Safe to run multiple times (git pull if exists, PM2 restart if running)
- **WebSocket Support**: Proper Apache configuration for Socket.IO
- **Zero-Downtime**: PM2 handles graceful restarts

## Prerequisites

1. **Node.js 20+** installed on your local machine
2. **SSH access** to the target server with root or sudo privileges
3. **SSH key** configured for passwordless authentication
4. **Git repository** with your application code (monorepo structure with `backend/` and `frontend/` folders)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Files

Copy the example files and fill in your values:

```bash
cp .env.example .env
cp .env.backend.example .env.backend
cp .env.frontend.example .env.frontend
```

#### `.env` - Server and Git Configuration

```env
# Server Details
SERVER_IP=66.116.205.60
SSH_USER=root
SSH_KEY_PATH=/Users/yourname/.ssh/id_rsa

# Git Details
GIT_REPO_URL=https://github.com/yourusername/your-project.git
GIT_TOKEN=github_pat_xxxxx
GIT_BRANCH=main

# Domain
DOMAIN=saffron-staging.example.com

# Node.js Version
NODE_VERSION=22

# Deployment Path
DEPLOYMENT_PATH=/var/www/saffron
```

#### `.env.backend` - Backend Environment Variables

This file will be uploaded to `/var/www/saffron/backend/.env` on the server.

Include all your backend environment variables:
- Database connection string
- JWT secrets
- API URLs
- Email configuration
- etc.

#### `.env.frontend` - Frontend Environment Variables

This file will be uploaded to `/var/www/saffron/frontend/.env.production` on the server.

**Important**: Frontend environment variables that need to be accessible in the browser must have the `NEXT_PUBLIC_` prefix.

### 3. Deploy

```bash
npx sst deploy
```

This single command will:
1. Detect the server OS (Ubuntu or AlmaLinux/CentOS)
2. Install Node.js, PM2, Apache, and Certbot
3. Obtain SSL certificate
4. Clone/pull your Git repository
5. Upload environment files
6. Build both frontend and backend
7. Configure PM2 for process management
8. Configure Apache reverse proxy with WebSocket support
9. Start all services

## Deployment Flow

```
1. System Setup
   ├── OS Detection (apt/dnf)
   ├── Install Node.js (version from .env)
   ├── Install PM2
   ├── Install Apache with modules
   └── Install Certbot

2. SSL Setup
   └── Obtain Let's Encrypt certificate

3. Git Deployment
   └── Clone or pull repository

4. Environment Upload
   ├── Upload .env.backend → server/backend/.env
   └── Upload .env.frontend → server/frontend/.env.production

5. Backend Build
   ├── npm install
   ├── prisma generate
   ├── prisma migrate deploy
   └── npm run build

6. Frontend Build
   ├── npm install
   └── npm run build

7. PM2 Configuration
   ├── Create ecosystem.config.js
   └── Start backend (port 8000) and frontend (port 3000)

8. Apache Configuration
   ├── HTTP VirtualHost (redirect to HTTPS)
   └── HTTPS VirtualHost (reverse proxy with WebSocket support)

9. Final Setup
   ├── Set file permissions
   └── Verify services
```

## Apache Configuration

The deployment automatically configures Apache as a reverse proxy:

- **Port 80**: Redirects all HTTP traffic to HTTPS
- **Port 443**: Main HTTPS configuration with:
  - `/api/*` → Backend (port 8000)
  - `/socket.io/*` → Backend WebSocket (port 8000)
  - `/assets/uploads/*` → Backend static files (port 8000)
  - All other requests → Frontend (port 3000)

## PM2 Process Management

Applications are managed with PM2:

- **Backend**: `saffron-backend` running on port 8000
- **Frontend**: `saffron-frontend` running on port 3000

### Useful PM2 Commands (on server)

```bash
# View status
pm2 list

# View logs
pm2 logs
pm2 logs saffron-backend
pm2 logs saffron-frontend

# Restart applications
pm2 restart all
pm2 restart saffron-backend

# Monitor resources
pm2 monit
```

## Troubleshooting

### SSL Certificate Issues

If SSL certificate setup fails:

```bash
# SSH into server and manually run:
certbot --apache -d your-domain.com
```

### Apache Configuration Errors

Check Apache configuration:

```bash
# On CentOS/RHEL
httpd -t

# On Ubuntu/Debian
apache2ctl configtest
```

### PM2 Processes Not Starting

Check PM2 logs:

```bash
pm2 logs --lines 50
```

Verify environment variables are set correctly:

```bash
# On server
cat /var/www/saffron/backend/.env
cat /var/www/saffron/frontend/.env.production
```

### WebSocket Not Working

Ensure `mod_proxy_wstunnel` is enabled:

```bash
# On CentOS/RHEL
grep -r "proxy_wstunnel" /etc/httpd/conf.modules.d/

# On Ubuntu/Debian
apache2ctl -M | grep proxy_wstunnel
```

### Port Already in Use

If ports 3000 or 8000 are already in use:

```bash
# Find process using port
lsof -i :8000
lsof -i :3000

# Kill process or change ports in ecosystem.config.js
```

## Updating Deployment

To update your deployment:

1. Make changes to your code and push to Git
2. Update `.env.backend` or `.env.frontend` if needed
3. Run `npx sst deploy` again

The deployment is idempotent - it will:
- Pull latest code if repository exists
- Restart PM2 processes if they're running
- Rebuild applications
- Reload Apache configuration

## Security Notes

- **Never commit** `.env`, `.env.backend`, or `.env.frontend` files to Git
- Keep your SSH key secure and use strong passwords
- Regularly update Node.js and system packages
- Monitor PM2 logs for errors
- Set up firewall rules (ports 22, 80, 443 only)

## File Structure

```
deployment-solution/
├── sst.config.ts          # Main SST configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── .env                   # Server and Git config (not in Git)
├── .env.backend           # Backend env vars (not in Git)
├── .env.frontend          # Frontend env vars (not in Git)
├── .env.example           # Template for .env
├── .env.backend.example   # Template for .env.backend
├── .env.frontend.example  # Template for .env.frontend
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review PM2 logs: `pm2 logs`
3. Check Apache logs: `/var/log/httpd/` or `/var/log/apache2/`
4. Verify environment variables are correct

## License

This deployment solution is part of the Saffron Fullstack project.
