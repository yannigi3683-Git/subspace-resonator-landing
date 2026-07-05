@echo off
title Subspace Radio Restreamer
cd /d "%~dp0"
:loop
echo ============================================================
echo  Subspace Radio restreamer starting. Keep this window OPEN.
echo  Close it when your show is over.
echo ============================================================
node --env-file=.env src/index.mjs
echo.
echo Restreamer stopped. Restarting in 3s...  (close this window to stop for real)
timeout /t 3 >nul
goto loop
