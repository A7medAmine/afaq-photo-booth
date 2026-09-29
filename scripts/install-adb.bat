@echo off
rem Checks for adb; installs Android platform-tools if missing.
where adb >nul 2>&1
if not errorlevel 1 (
  echo adb already installed:
  adb version | findstr /i "version"
  exit /b 0
)

set "PT=%LOCALAPPDATA%\Android\platform-tools"
if exist "%PT%\adb.exe" goto :addpath

echo adb not found. Downloading platform-tools...
set "ZIP=%TEMP%\platform-tools.zip"
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest https://dl.google.com/android/repository/platform-tools-latest-windows.zip -OutFile '%ZIP%'"
if errorlevel 1 (
  echo Download failed. Check internet connection.
  exit /b 1
)
powershell -NoProfile -Command "Expand-Archive -Force '%ZIP%' '%LOCALAPPDATA%\Android'"
if errorlevel 1 (
  echo Extract failed.
  exit /b 1
)
del "%ZIP%" >nul 2>&1

:addpath
rem Persist to user PATH (if not already there) and to this session.
powershell -NoProfile -Command "$p=[Environment]::GetEnvironmentVariable('Path','User'); if(($p -split ';') -notcontains '%PT%'){[Environment]::SetEnvironmentVariable('Path',($p.TrimEnd(';')+';%PT%'),'User')}"
set "PATH=%PATH%;%PT%"
echo adb installed at %PT%
"%PT%\adb.exe" version | findstr /i "version"
echo Open a new terminal for PATH to take effect everywhere.
exit /b 0
