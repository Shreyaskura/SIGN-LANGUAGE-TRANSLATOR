@echo off
echo ====================================
echo Starting Backend API Server
echo ====================================
echo.
echo Backend API will run on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo Press Ctrl+C to stop the server
echo.
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
