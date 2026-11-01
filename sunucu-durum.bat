@echo off
chcp 65001 >nul
cd /d "%~dp0server"
title Media Toolkit - Durum
node scripts\service.js status
pause

