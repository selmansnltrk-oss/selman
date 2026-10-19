@echo off
setlocal
cd /d "%~dp0"
title Defter Mini
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden Node.js 24 LTS yukleyin.
  pause
  exit /b 1
)
if not exist "node_modules\.package-lock.json" (
  echo Ilk kurulum yapiliyor. Internet baglantisi gereklidir...
  call npm ci
  if errorlevel 1 goto hata
)
node node_modules/electron/install.js
if errorlevel 1 goto hata
node node_modules/esbuild/install.js
if errorlevel 1 goto hata
call npm run desktop
if errorlevel 1 goto hata
exit /b 0
:hata
echo.
echo Baslatma tamamlanamadi. Yukaridaki hata mesajini paylasabilirsiniz.
pause
exit /b 1
