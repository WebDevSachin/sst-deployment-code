# Environment Files from Your App Repository

You can use environment files directly from your application repository instead of maintaining separate files.

## Example: Using full-stack/.env.production

```bash
# In your deployment-solution/.env
BACKEND_ENV_FILE=full-stack/backend/.env.production
FRONTEND_ENV_FILE=full-stack/frontend/.env.production
```

## Benefits

✅ **Single source of truth** - Environment configs live with your app code  
✅ **Version controlled** - Track environment changes in your app repo  
✅ **Team-friendly** - Everyone uses the same production configs  
✅ **Less duplication** - No need to maintain separate env files  

## File Structure

```
deployment-solution/
├── .env (points to full-stack env files)
├── full-stack/ (your app repository)
│   ├── backend/
│   │   └── .env.production ✅ Used for backend
│   └── frontend/
│       └── .env.production ✅ Used for frontend
└── sst.config.ts
```

## How It Works

1. **SST reads your local `.env`**
   ```env
   BACKEND_ENV_FILE=full-stack/backend/.env.production
   ```

2. **Loads the specified file from your app repo**
   ```bash
   # Reads: deployment-solution/full-stack/backend/.env.production
   ```

3. **Uploads content to server during deployment**
   ```bash
   # Creates: /var/www/myapp/backend/.env (on server)
   ```

4. **Build uses the uploaded file**
   ```bash
   npm run build # Uses /var/www/myapp/backend/.env
   ```

## Common Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| **App repo files** | Env files live with app code | `full-stack/backend/.env.production` |
| **Separate files** | Deployment-specific configs | `.env.backend` |
| **Staging/Prod split** | Multiple environments | `.env.backend.staging` |
| **Secrets directory** | Centralized secrets | `../secrets/.env.prod` |

## Testing

Test locally before deploying:

```bash
# 1. Create your production env files
cat > full-stack/backend/.env.production << 'EOF'
DATABASE_URL=mysql://user:pass@localhost:3306/db
JWT_SECRET=your-secret
PORT=8000
EOF

# 2. Update .env to use them
echo "BACKEND_ENV_FILE=full-stack/backend/.env.production" >> .env
echo "FRONTEND_ENV_FILE=full-stack/frontend/.env.production" >> .env

# 3. Deploy
npx sst deploy
```

You should see:
```
📋 Using environment files:
   Backend:  full-stack/backend/.env.production
   Frontend: full-stack/frontend/.env.production
```

## Deployment Verification

After deployment, verify on the server:

```bash
ssh root@your-server-ip

# Check backend env file
cat /var/www/myapp/backend/.env

# Check frontend env file
cat /var/www/myapp/frontend/.env.production

# Verify PM2 is using the files
pm2 logs app-backend | grep DATABASE_URL
```

## GitHub Actions Integration

The GitHub Actions workflow automatically uses whatever environment files you specify in your `.env`:

```yaml
# Your .env configuration is respected
BACKEND_ENV_FILE=full-stack/backend/.env.production
FRONTEND_ENV_FILE=full-stack/frontend/.env.production

# GitHub Actions will:
# 1. Pull latest code (including updated env files)
# 2. Build with those env files
# 3. Restart PM2
```

**Important:** The environment files must already exist on the server. Run `npx sst deploy` once to set them up, then GitHub Actions can update the app code and rebuild.
