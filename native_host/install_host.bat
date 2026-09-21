@echo off
setlocal
set HOST_NAME=com.devizee.native_host
set SCRIPT_DIR=%~dp0
set MANIFEST_PATH=%SCRIPT_DIR%com.devizee.native_host.json
set HOST_EXE=%SCRIPT_DIR%devizee_host.exe

REM --- Copy the native host binary if not already present ---
if not exist "%HOST_EXE%" (
    echo Native host binary not found in %SCRIPT_DIR%.
    echo Checking for a release build...
    set "RELEASE_EXE=%SCRIPT_DIR%..\src-tauri\target\release\devizee_host.exe"
    if exist "%RELEASE_EXE%" (
        copy /Y "%RELEASE_EXE%" "%HOST_EXE%" >nul
        echo Copied devizee_host.exe from release build.
    ) else (
        set "DEBUG_EXE=%SCRIPT_DIR%..\src-tauri\target\debug\devizee_host.exe"
        if exist "%DEBUG_EXE%" (
            copy /Y "%DEBUG_EXE%" "%HOST_EXE%" >nul
            echo Copied devizee_host.exe from debug build.
        ) else (
            echo ERROR: Could not find devizee_host.exe. Build it first with:
            echo   cargo build --release --bin devizee_host
            pause
            exit /b 1
        )
    )
)

echo.
echo Registering Devizee Native Messaging Host: %HOST_NAME%
echo Manifest path: %MANIFEST_PATH%

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo Done! Native host registered successfully for Chrome and Edge.
pause
