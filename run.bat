@echo off
rem One-click start: ensure adb, forward phone camera over USB, install deps, start booth + cloud.
cd /d "%~dp0"

call scripts\install-adb.bat
if errorlevel 1 exit /b 1

rem adb from a fresh install may not be on PATH yet in this session
where adb >nul 2>&1 || set "PATH=%PATH%;%LOCALAPPDATA%\Android\platform-tools"

call scripts\phone-usb.bat
if errorlevel 1 echo Continuing without phone forward...

if not exist node_modules (
  echo Installing booth deps...
  call npm install || exit /b 1
)
if not exist cloud\node_modules (
  echo Installing cloud deps...
  call npm --prefix cloud install || exit /b 1
)

call npm run dev
