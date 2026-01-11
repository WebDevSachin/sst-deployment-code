# GitHub Actions CI/CD Setup

This guide will help you set up automated deployment using GitHub Actions.

## Prerequisites

1. Your application repository on GitHub
2. A deployed server (Ubuntu/CentOS with PM2 and Apache configured)
3. SSH access to your server

## Step 1: Add GitHub Secrets

Go to your repository on GitHub:
- Click **Settings** > **Secrets and variables** > **Actions**
- Click **New repository secret**

Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SSH_PRIVATE_KEY` | Your SSH private key content | Contents of `~/.ssh/id_ed25519` |
| `SERVER_IP` | Server IP or domain | `sachink.store` or `66.116.205.60` |
| `SSH_USER` | SSH username | `root` |
| `DEPLOYMENT_PATH` | Server deployment path | `/var/www/myapp` |
| `APP_NAME` | Application name (for PM2) | `myapp` |
| `DOMAIN` | Production domain for health checks | `yourdomain.com` |

### Getting Your SSH Private Key

```bash
# On your local machine
cat ~/.ssh/id_ed25519

# Copy the entire output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ... key content ...
# -----END OPENSSH PRIVATE KEY-----
```

**Important:** Never commit this key to your repository!

## Step 2: Copy Workflow File

The workflow file is already in `.github/workflows/deploy.yml`. If using your own repository:

```bash
# Copy from deployment-solution to your app repo
cp .github/workflows/deploy.yml /path/to/your-app/.github/workflows/
```

## Step 3: Ensure Environment Files Exist on Server

The GitHub Actions workflow expects `.env` files to already exist on the server.

### Option A: Deploy with SST First (Recommended)

```bash
# Use SST to do the initial deployment
npx sst deploy
```

This will:
- Set up the server
- Copy environment files
- Build and deploy

### Option B: Manually Copy Environment Files

```bash
# SSH to your server
ssh root@your-server-ip

# Create backend .env
cat > /var/www/myapp/backend/.env << 'EOF'
DATABASE_URL="mysql://user:pass@localhost:3306/db"
JWT_SECRET="your-secret"
# ... other variables
EOF

# Create frontend .env.production
cat > /var/www/myapp/frontend/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
# ... other variables
EOF

# Set proper permissions
chmod 600 /var/www/myapp/backend/.env
chmod 600 /var/www/myapp/frontend/.env.production
```

## Step 4: Test the Workflow

### Automatic Trigger

Push to `main` or `master` branch:

```bash
git add .
git commit -m "Test deployment"
git push origin main
```

### Manual Trigger

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **Deploy to Production** workflow
4. Click **Run workflow**
5. Select branch and click **Run workflow**

## Workflow Behavior

### What It Does

1. **Checkout** - Gets latest code from GitHub
2. **Setup Node.js** - Installs Node.js 22
3. **Install Dependencies** - Runs `npm ci`
4. **Setup SSH** - Configures SSH connection to server
5. **Deploy to Server** - Connects via SSH and:
   - Pulls latest code
   - Verifies `.env` files exist
   - Builds backend (Prisma + TypeScript)
   - Builds frontend (Next.js)
   - Restarts PM2 processes
6. **Health Check** - Verifies frontend and backend are running
7. **Cleanup** - Removes SSH keys

### Deployment Time

- First deployment: ~5-7 minutes
- Subsequent deployments: ~3-5 minutes

### Build Artifacts

All builds happen on the server (not in GitHub Actions) to ensure:
- Environment variables are secure
- Builds use the same environment as production
- No need to transfer large build artifacts

## Monitoring Deployments

### View Deployment Status

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click on the running/completed workflow
4. View logs for each step

### PM2 Logs on Server

```bash
ssh root@your-server-ip

# View all logs
pm2 logs

# View specific app logs
pm2 logs myapp-backend
pm2 logs myapp-frontend

# View last 100 lines
pm2 logs --lines 100
```

## Troubleshooting

### Issue: SSH Connection Failed

**Error:** `Permission denied (publickey)`

**Solution:**
1. Verify `SSH_PRIVATE_KEY` secret is correct
2. Ensure the public key is in server's `~/.ssh/authorized_keys`
3. Test SSH manually: `ssh -i ~/.ssh/id_ed25519 root@your-server-ip`

### Issue: Environment File Not Found

**Error:** `backend/.env not found!`

**Solution:**
- Run initial deployment with SST: `npx sst deploy`
- Or manually create `.env` files on server (see Step 3, Option B)

### Issue: Build Failed

**Error:** `npm run build failed`

**Solution:**
1. Check build logs in GitHub Actions
2. Test build locally: `npm run build`
3. Verify environment variables are correct
4. Check Node.js version matches

### Issue: Health Check Failed

**Error:** `Frontend health check failed`

**Solution:**
1. Check if PM2 processes are running: `pm2 list`
2. Check Apache is running: `systemctl status apache2`
3. View PM2 logs: `pm2 logs`
4. Check domain DNS: `dig yourdomain.com`

## Advanced Configuration

### Multiple Environments

Create separate workflows for staging:

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches:
      - develop
```

Use different secrets for staging:
- `STAGING_SERVER_IP`
- `STAGING_DEPLOYMENT_PATH`
- `STAGING_DOMAIN`

### Custom Node Version

Update the workflow:

```yaml
env:
  NODE_VERSION: '20'  # Change version
```

### Skip Health Checks

Remove the "Health Check" step from the workflow.

### Add Slack Notifications

Add a step at the end:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Security Best Practices

1. ✅ Use GitHub Secrets for sensitive data
2. ✅ Never commit `.env` files to Git
3. ✅ Rotate SSH keys regularly
4. ✅ Use read-only Git credentials if possible
5. ✅ Limit SSH key permissions (600)
6. ✅ Use strong passwords for database
7. ✅ Keep dependencies updated
8. ✅ Review deployment logs regularly

## Next Steps

- Set up monitoring (e.g., UptimeRobot)
- Configure log aggregation (e.g., Papertrail)
- Add automated backups
- Set up staging environment
- Configure rollback procedures
