@echo off
rem Checks for Node.js (Vite needs 20.19+ or 22.12+); if missing or too old, unpacks the
rem official portable Node LTS zip into %LOCALAPPDATA%\nodejs (no installer, no admin).
set "ND=%LOCALAPPDATA%\nodejs"
if exist "%ND%\node.exe" set "PATH=%ND%;%PATH%"

where node >nul 2>&1
if errorlevel 1 goto :install
node -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||a===22&&b>=12||a===20&&b>=19?0:1)"
if not errorlevel 1 (
  for /f "delims=" %%v in ('node -v') do echo Node already installed: %%v
  exit /b 0
)
for /f "delims=" %%v in ('node -v') do echo Node %%v is too old ^(need 20.19+ or 22.12+^).

:install
set "ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"

set "VER="
for /f "delims=" %%v in ('powershell -NoProfile -Command "$r = Invoke-RestMethod https://nodejs.org/dist/index.json; ($r | Where-Object { $_.lts })[0].version"') do set "VER=%%v"
if not defined VER (
  echo Could not look up Node LTS version. Check internet connection.
  exit /b 1
)

set "NAME=node-%VER%-win-%ARCH%"
set "ZIP=%TEMP%\%NAME%.zip"
echo Downloading Node %VER%...
where curl >nul 2>&1
if not errorlevel 1 (
  curl -fL --progress-bar -o "%ZIP%" "https://nodejs.org/dist/%VER%/%NAME%.zip"
) else (
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest https://nodejs.org/dist/%VER%/%NAME%.zip -OutFile '%ZIP%'"
)
if errorlevel 1 (
  echo Download failed. Check internet connection.
  exit /b 1
)

rem tar (built into Windows 10+) unpacks far faster than Expand-Archive
if exist "%LOCALAPPDATA%\%NAME%" rmdir /s /q "%LOCALAPPDATA%\%NAME%"
tar -xf "%ZIP%" -C "%LOCALAPPDATA%" 2>nul || powershell -NoProfile -Command "Expand-Archive -Force '%ZIP%' '%LOCALAPPDATA%'"
if errorlevel 1 (
  echo Extract failed.
  exit /b 1
)
del "%ZIP%" >nul 2>&1
if exist "%ND%" rmdir /s /q "%ND%"
move "%LOCALAPPDATA%\%NAME%" "%ND%" >nul || exit /b 1

rem Persist to user PATH (if not already there) and to this session.
powershell -NoProfile -Command "$p=[Environment]::GetEnvironmentVariable('Path','User'); if(($p -split ';') -notcontains '%ND%'){[Environment]::SetEnvironmentVariable('Path',($p.TrimEnd(';')+';%ND%'),'User')}"
set "PATH=%ND%;%PATH%"
for /f "delims=" %%v in ('node -v') do echo Node %%v installed at %ND%
echo Open a new terminal for PATH to take effect everywhere.
exit /b 0
