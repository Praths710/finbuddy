@echo off
rem Double-click to run FinMind (backend + frontend) in this one window.
cd /d "%~dp0"
"backend\venv\Scripts\python.exe" dev.py
pause
