@echo off
chcp 65001 >nul
cd /d "%~dp0server"
node scripts\service.js start
pause

