# Modular Configuration Structure

The deployment solution has been refactored into modular, maintainable files for better organization and reusability.

## File Structure

```
deployment-solution/
├── sst.config.ts                 # Main SST configuration (orchestrates all modules)
├── config/
│   ├── types.ts                  # TypeScript interfaces and types
│   ├── load-config.ts            # Configuration loader (reads .env files)
│   ├── system-setup.ts           # OS detection & software installation
│   ├── ssl-setup.ts              # SSL certificate management
│   ├── git-deploy.ts             # Git repository deployment
│   ├── build.ts                  # Backend & frontend build processes
│   ├── pm2-config.ts             # PM2 process manager configuration
│   ├── apache-config.ts          # Apache reverse proxy configuration
│   └── final-setup.ts            # Final permissions & verification
├── .env                          # Environment configuration (not in git)
├── .env.example                  # Template for .env
├── .env.backend                  # Backend environment variables (not in git)
├── .env.backend.example          # Template for .env.backend
├── .env.frontend                 # Frontend environment variables (not in git)
└── .env.frontend.example         # Template for .env.frontend
```

## Dynamic Application Name

The application name is now dynamically loaded from the `.env` file using the `APP_NAME` variable:

```env
APP_NAME=myapp
```

This name is used throughout the deployment for:

- **PM2 Process Names**: `myapp-backend`, `myapp-frontend`
- **Apache Config Files**: `myapp-http.conf`, `myapp-https.conf`
- **Log Files**: 
  - PM2: `/var/log/pm2/myapp-backend-error.log`, `/var/log/pm2/myapp-frontend-error.log`
  - Apache: `/var/log/httpd/myapp_error.log`, `/var/log/httpd/myapp_ssl_error.log`
- **Deployment Path**: `/var/www/myapp` (if DEPLOYMENT_PATH not specified)

## Module Descriptions

### `config/types.ts`
Defines TypeScript interfaces for configuration and connection objects.

### `config/load-config.ts`
- Loads and parses `.env` files
- Reads backend and frontend environment files
- Validates required configuration
- Returns a `Config` object with all deployment settings

### `config/system-setup.ts`
- Detects operating system (Ubuntu/Debian vs CentOS/AlmaLinux/RHEL)
- Installs Node.js (version from .env)
- Installs PM2, Apache, MySQL/MariaDB, Certbot
- Configures firewall (firewalld on CentOS, ufw on Ubuntu)
- Configures SELinux for Apache proxy (CentOS only)
- Enables required Apache modules

### `config/ssl-setup.ts`
- Obtains SSL certificates from Let's Encrypt
- Tries Apache plugin first, falls back to standalone mode
- Sets up auto-renewal cron job
- Validates certificate acquisition

### `config/git-deploy.ts`
- Clones or pulls Git repository
- Uploads environment variables to server
- Validates repository structure (backend/frontend folders)

### `config/build.ts`
- **Backend Build**: npm install, Prisma generate, database migrations, TypeScript compilation
- **Frontend Build**: npm install, Next.js build with optimizations

### `config/pm2-config.ts`
- Creates dynamic PM2 ecosystem config using `APP_NAME`
- Configures process restart policies
- Sets up log rotation
- Starts/restarts processes

### `config/apache-config.ts`
- Detects Apache configuration directory (CentOS vs Ubuntu)
- Creates HTTP VirtualHost (redirects to HTTPS)
- Creates HTTPS VirtualHost with:
  - SSL configuration
  - Security headers
  - API proxy to backend (port 8000)
  - WebSocket support
  - Frontend proxy (port 3000)
- Uses dynamic filenames based on `APP_NAME`

### `config/final-setup.ts`
- Sets file permissions and ownership
- Creates upload directories
- Verifies PM2 processes are running
- Verifies Apache configuration
- Tests SSL certificate
- Checks listening ports
- Displays deployment summary

## Benefits of This Structure

1. **Maintainability**: Each module handles one specific aspect of deployment
2. **Reusability**: Modules can be imported and reused in other projects
3. **Testability**: Individual modules can be tested independently
4. **Readability**: Each file is focused and easier to understand
5. **Scalability**: Easy to add new deployment steps or modify existing ones
6. **Dynamic**: Application name and all configurations are loaded from .env

## Usage

The main `sst.config.ts` file now simply orchestrates the modules:

```typescript
const config = await loadConfig();
const systemSetup = new command.remote.Command("SystemSetup", {
  connection,
  create: createSystemSetupCommand(config),
});
// ... and so on
```

All deployment logic is encapsulated in the respective modules, making the main config file clean and declarative.

## Adding New Features

To add a new deployment step:

1. Create a new file in `config/` directory
2. Export a function that returns the shell command string
3. Import and use it in `sst.config.ts`
4. Add dependencies as needed

Example:

```typescript
// config/database-backup.ts
export function createDatabaseBackupCommand(config: Config) {
  return `
    mysqldump -u root ${config.appName}_db > /backups/${config.appName}_\$(date +%Y%m%d).sql
  `;
}

// sst.config.ts
const { createDatabaseBackupCommand } = await import("./config/database-backup");
const dbBackup = new command.remote.Command("DatabaseBackup", {
  connection,
  create: createDatabaseBackupCommand(config),
}, { dependsOn: [finalSetup] });
```

## Environment Variables

All environment variables are loaded from `.env`:

- `APP_NAME` - **NEW!** Application identifier (default: "app")
- `SERVER_IP` - Server hostname or IP address
- `SSH_USER` - SSH username (default: "root")
- `SSH_KEY_PATH` - Path to SSH private key
- `GIT_REPO_URL` - Git repository URL
- `GIT_TOKEN` - GitHub personal access token
- `GIT_BRANCH` - Branch to deploy (default: "main")
- `DOMAIN` - Domain name for the application
- `NODE_VERSION` - Node.js version to install (default: "22")
- `DEPLOYMENT_PATH` - Where to deploy the app (default: `/var/www/APP_NAME`)

## Best Practices

1. **Always set APP_NAME** in your `.env` file to avoid conflicts
2. **Use descriptive names** that identify your project (e.g., "ecommerce", "blog", "api")
3. **Avoid spaces** in APP_NAME (use hyphens or underscores)
4. **Keep modules focused** on single responsibilities
5. **Update types.ts** when adding new configuration options
6. **Document new modules** in this README
