@echo off
title Editeur PDF et Word
color 0A

cd /d "%~dp0"

echo.
echo  ============================================
echo   Editeur PDF et Word - Demarrage...
echo  ============================================
echo.

:: Verifier si Node.js est installe
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe !
    echo.
    echo  Telechargez Node.js sur : https://nodejs.org
    echo  Puis relancez ce fichier.
    echo.
    pause
    exit /b 1
)

:: Installer les dependances si necessaire
if not exist "node_modules\express" (
    echo  Installation des dependances (premiere fois uniquement)...
    echo  Cela peut prendre 2-3 minutes...
    echo.
    call npm install 2>&1
    echo.
    echo  Installation terminee !
    echo.
)

:: Tuer tout serveur existant sur le port 3456
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3456 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  Demarrage sur http://localhost:3456
echo  Le navigateur va s'ouvrir automatiquement...
echo.
echo  [Pour arreter : fermez cette fenetre ou appuyez sur Ctrl+C]
echo.

node server.js

pause
