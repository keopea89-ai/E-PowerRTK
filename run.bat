@echo off
cd /d "%~dp0"
title E-PowerRTK - Electricity Billing System

echo ===================================================
echo     E-PowerRTK: Electricity Billing System
echo ===================================================
echo.
echo Starting Web Server on http://127.0.0.1:5050 ...
echo Opening your browser automatically...
echo.

if exist "C:\Program Files\Python313\python.exe" (
    "C:\Program Files\Python313\python.exe" app.py
) else (
    py app.py
)

pause
