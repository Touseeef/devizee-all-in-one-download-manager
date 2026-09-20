@echo off
setlocal
set HOST_NAME=com.devizee.native_host
set MANIFEST_PATH=%~dp0com.devizee.native_host.json

echo Registering Devizee Native Messaging Host: %HOST_NAME%
echo Manifest path: %MANIFEST_PATH%

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo Done! Native host registered successfully for Chrome and Edge.
pause
