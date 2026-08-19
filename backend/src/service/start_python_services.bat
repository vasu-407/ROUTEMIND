@echo off
echo Starting All Python Backend Services...

echo [1/2] Starting Optimization API (Port 8000)...
start "Optimization API" cmd /k "uvicorn api.app:app --host 0.0.0.0 --port 8000"

echo [2/2] Starting ML Prediction API (Port 8001)...
start "ML API" cmd /k "python ml/ml_api.py"

echo Both Python services are starting up in separate windows!
echo Close the command windows to stop them.
pause
