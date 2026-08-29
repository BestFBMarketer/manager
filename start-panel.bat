@echo off
cd /d "%~dp0"
echo shorts-factory panel baslatiliyor...
start "shorts-factory panel" cmd /k "npm run panel:server"
timeout /t 3 /nobreak >nul
start "" "http://localhost:4000"
