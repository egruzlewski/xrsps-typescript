@echo off
setlocal
cd /d "%~dp0"
cd ..

if not exist "package.json" (
  echo Could not find the repository root from tools\dev.bat.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node v22.16+ from https://nodejs.org/
  pause
  exit /b 1
)

where corepack >nul 2>&1
if errorlevel 1 (
  echo Corepack was not found. Use an official Node.js install so Corepack is included.
  pause
  exit /b 1
)

rem Classic Yarn 1.x on PATH will refuse this repo. Put Corepack shims first
rem so `yarn` is 4.12.0 without needing an elevated `corepack enable`.
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
set "SHIMS=%LOCALAPPDATA%\xrsps-corepack-shims"
if not exist "%SHIMS%" mkdir "%SHIMS%"
call corepack enable --install-directory "%SHIMS%"
if errorlevel 1 (
  echo Failed to set up Yarn via Corepack.
  pause
  exit /b 1
)
set "PATH=%SHIMS%;%PATH%"

set "NEED_SETUP=0"
if not exist "node_modules\.yarn-state.yml" set "NEED_SETUP=1"
if not exist "server\node_modules\.yarn-state.yml" set "NEED_SETUP=1"
if not exist "client\node_modules\.yarn-state.yml" set "NEED_SETUP=1"

if "%NEED_SETUP%"=="1" (
  echo First-time setup: installing packages, fetching the game cache, and building collision data.
  echo This can take several minutes.
  echo.
  rem Yarn 4 cannot run package.json scripts like `yarn setup` until the root
  rem install exists, so install first, then the rest of setup.
  call yarn install --immutable
  if errorlevel 1 (
    echo Root install failed.
    pause
    exit /b 1
  )
  call yarn setup
  if errorlevel 1 (
    echo Setup failed.
    pause
    exit /b 1
  )
  echo.
)

echo Starting the game server and web client...
echo Close this window or press Ctrl+C to stop both.
echo.
call yarn start
if errorlevel 1 pause
