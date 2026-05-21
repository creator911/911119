@echo off
setlocal

cd /d "%~dp0"

if not exist "data" mkdir "data"

if not exist "data\db.json" (
  echo data\db.json not found.
  exit /b 1
)

if exist "data\mobile-preview-db.json" (
  choice /C YN /N /M "Reset mobile preview DB from data\db.json? [Y/N] "
  if errorlevel 2 goto run_preview
)

copy /Y "data\db.json" "data\mobile-preview-db.json" >nul

:run_preview
set "PORT=3100"
set "ITEMZONE_MOBILE_PREVIEW=true"
set "ITEMZONE_DB_PATH=data\mobile-preview-db.json"
set "ITEMZONE_DATABASE_URL="
set "DATABASE_URL="

echo Mobile preview: http://127.0.0.1:3100
node server.mjs
