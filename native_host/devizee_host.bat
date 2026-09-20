@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devizee_host.ps1"
exit /b %ERRORLEVEL%
