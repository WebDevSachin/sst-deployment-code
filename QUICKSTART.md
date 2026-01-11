# Quick Start Guide

## Sample Application Setup

This repository contains a complete sample full-stack application ready for deployment testing.

### Project Structure

```
deployment-solution/
├── backend/          # Express.js + Socket.IO backend
├── frontend/         # Next.js frontend
└── sst.config.ts    # Deployment automation
```

## Local Testing (Before Deployment)

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start Backend (Terminal 1)

```bash
cd backend
npm run dev
```

Backend runs on: `http://localhost:8000`

### 4. Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend runs on: `http://localhost:3000`

### 5. Test the Application

Open `http://localhost:3000` in your browser. You should see:
- ✅ Backend status indicator
- ✅ WebSocket connection status
- ✅ Sample users list
- ✅ Form to create new users
- ✅ Test message button

## Deployment to Server

### 1. Prepare Environment Files

Copy and configure the environment files:

```bash
cp .env.example .env
cp .env.backend.example .env.backend
cp .env.frontend.example .env.frontend
```

Edit each file with your actual values.

### 2. Deploy

```bash
npm install  # Install SST dependencies
npx sst deploy
```

The deployment will:
- Detect your server OS
- Install all required software
- Clone this repository
- Build and deploy both applications
- Configure Apache reverse proxy
- Setup SSL certificates

## What's Included

### Backend Features
- ✅ Express.js REST API
- ✅ Socket.IO WebSocket server
- ✅ Health check endpoint
- ✅ User CRUD endpoints
- ✅ Prisma ORM setup
- ✅ CORS configuration
- ✅ TypeScript

### Frontend Features
- ✅ Next.js 14 with App Router
- ✅ Real-time WebSocket client
- ✅ API integration
- ✅ User management UI
- ✅ Responsive design
- ✅ TypeScript

## Git Repository Setup

To push this to your Git repository:

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Sample full-stack application"

# Add remote
git remote add origin https://github.com/yourusername/your-repo.git

# Push
git push -u origin main
```

**Important**: Make sure `.env`, `.env.backend`, and `.env.frontend` are in `.gitignore` (they already are).

## Next Steps

1. Test locally to ensure everything works
2. Update environment files with your server details
3. Push code to your Git repository
4. Run `npx sst deploy` to deploy to your server
5. Visit your domain to see the application live!

## Troubleshooting

### Backend won't start
- Check if port 8000 is available: `lsof -i :8000`
- Verify Node.js version: `node -v` (should be 20+)

### Frontend won't start
- Check if port 3000 is available: `lsof -i :3000`
- Clear Next.js cache: `rm -rf frontend/.next`

### WebSocket not connecting
- Verify backend is running
- Check CORS settings in backend
- Verify WebSocket URL in frontend `.env.local`
