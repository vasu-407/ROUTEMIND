@echo off
echo ============================================================
echo  RouteMind AI Logistics Control Tower
echo  Amazon Last Mile Routing Challenge
echo ============================================================
echo.

echo [1/4] Starting Python Optimization Service (Port 8000)...
start "Optimization API" cmd /k "cd /d %~dp0service && uvicorn api.app:app --host 0.0.0.0 --port 8000"

echo [2/4] Starting ML Prediction Service (Port 8001)...
start "ML API" cmd /k "cd /d %~dp0service && python ml/ml_api.py"

echo [3/4] Starting Node.js API Gateway (Port 3000)...
start "Node.js Gateway" cmd /k "cd /d %~dp0backend && node src/app.js"

echo [4/4] Starting React Frontend...
start "React UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo  All services starting...
echo.
echo  React Dashboard  : http://localhost:5173
echo  Node.js Gateway  : http://localhost:3000
echo  Optimization API : http://localhost:8000/docs
echo  ML Service       : http://localhost:8001/docs
echo ============================================================
pause
