@echo off
echo ====================================================
echo Starting Universal Media & Audio Toolkit Dev Servers
echo ====================================================

start "Media Toolkit - Server (Port 3001)" cmd /k "cd server && npm start"
start "Media Toolkit - Client (Port 5173)" cmd /k "cd client && npm run dev"

echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Both servers are starting in separate windows...

