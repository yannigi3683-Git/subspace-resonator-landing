@echo off
title Reset Subspace Radio Restreamer
echo ============================================================
echo  Clearing leftover restreamers and freeing the audio port.
echo  Run this ONLY if the restreamer showed "bind failed" or you
echo  suspect an old copy is still running. It is safe to run
echo  anytime the show is OFF.
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetUDPEndpoint -LocalPort 5004 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*index.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
echo.
echo Done. Leftovers cleared. Now double-click start-restreamer.bat.
echo.
pause
