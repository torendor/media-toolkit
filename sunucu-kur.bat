@echo off
chcp 65001 >nul
cd /d "%~dp0server"
title Media Toolkit - Kurulum
echo Indirme sunucusu 7/24 modunda kuruluyor (Windows acilisinda otomatik baslar)...
node scripts\service.js install
echo.
echo Pencereyi kapatabilirsiniz, sunucu arka planda calismaya devam eder.
pause

