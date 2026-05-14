@echo off
echo OutbreakOS Backend — Starting...
echo.

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt

echo.
echo =========================================
echo  OutbreakOS API  http://localhost:8000
echo  Docs            http://localhost:8000/docs
echo =========================================
echo.
echo Press Ctrl+C to stop.
echo.

uvicorn server:app --reload --port 8000 --host 0.0.0.0
pause
