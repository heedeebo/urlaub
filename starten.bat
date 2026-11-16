@echo off
rem Doppelklick startet die Urlaubs-App lokal. Fenster schliessen beendet sie.
cd /d "%~dp0"
where npm >nul 2>nul || (
  echo Node.js fehlt. Bitte einmal installieren: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
if not exist node_modules (
  echo Erster Start: Pakete werden installiert...
  call npm install
)
start "" http://localhost:5173
call npm run dev
pause
