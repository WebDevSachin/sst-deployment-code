# Saffron Fullstack Sample Application

This is a sample full-stack application created for testing the deployment solution. It includes a Next.js frontend and Express.js backend with WebSocket support.

## Project Structure

```
deployment-solution/
├── backend/              # Express.js backend
│   ├── src/
│   │   └── server.ts     # Main server file
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── package.json
├── frontend/             # Next.js frontend
│   ├── app/
│   │   ├── page.tsx      # Main page
│   │   ├── layout.tsx    # Root layout
│   │   └── globals.css   # Global styles
│   └── package.json
└── sst.config.ts         # Deployment configuration
```

## Features

### Backend (Express.js)
- REST API endpoints (`/api/health`, `/api/users`)
- WebSocket support with Socket.IO
- CORS enabled
- Prisma ORM setup (MySQL)
- TypeScript

### Frontend (Next.js)
- React 18 with App Router
- Real-time WebSocket connection
- API integration
- Responsive UI
- TypeScript

## Local Development

### Prerequisites
- Node.js 20+
- MySQL (for Prisma, optional for basic testing)

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL="mysql://user:password@localhost:3306/saffron_db"
NODE_ENV="development"
PORT=8000
FRONTEND_URL="http://localhost:3000"
EOF

# Generate Prisma client (if using database)
npx prisma generate

# Run in development mode
npm run dev
```

Backend will run on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=http://localhost:8000
EOF

# Run in development mode
npm run dev
```

Frontend will run on `http://localhost:3000`

## API Endpoints

### GET `/api/health`
Health check endpoint
```json
{
  "status": "ok",
  "message": "Backend API is running",
  "timestamp": "2024-01-10T...",
  "environment": "development"
}
```

### GET `/api/users`
Get list of users
```json
{
  "users": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" }
  ]
}
```

### POST `/api/users`
Create a new user
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

## WebSocket Events

### Client → Server
- `message` - Send a message to the server

### Server → Client
- `welcome` - Welcome message on connection
- `message` - Broadcast message to all clients

## Testing the Application

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser

4. You should see:
   - Backend status (should show ✅)
   - WebSocket connection status
   - Sample users list
   - Form to create new users

5. Test WebSocket:
   - Click "Send Test Message" button
   - Messages should appear in the messages list

## Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

## Deployment

This application is designed to be deployed using the SST deployment solution in the root directory. See the main [README.md](README.md) for deployment instructions.

## Notes

- The backend includes Prisma setup, but the sample endpoints work without a database
- WebSocket support is fully functional and will work with the Apache reverse proxy configuration
- Environment variables are configured for both development and production
- The frontend uses Next.js App Router (Next.js 14+)
