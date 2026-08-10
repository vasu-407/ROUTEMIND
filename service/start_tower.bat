@echo off
echo Starting Enterprise AI Logistics Control Tower...

echo [1/2] Starting FastAPI Backend on Port 8000...
start cmd /k "cd /d %~dp0 && uvicorn api.app:app --host 0.0.0.0 --port 8000"

echo [2/2] Starting React Frontend on Port 5173...
start cmd /k "cd /d %~dp0..\frontend && npm run dev"

echo Both services are starting up! 
echo Backend API: http://localhost:8000/docs
echo Frontend UI: http://localhost:5173 (Check terminal if port changes)
echo Close the command windows to stop the servers.
pause
