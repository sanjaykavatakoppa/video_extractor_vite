#!/bin/bash

echo "🚀 Starting Video Extractor Application..."
echo ""
echo "Starting servers:"
echo "  - React App: http://localhost:3000"
echo "  - API Server: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Kill any existing processes on these ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Start both servers
npm run dev:all

