@echo off
:: Ce script est appele par Windows "Ouvrir avec"
:: %1 = chemin du fichier .docx a ouvrir

setlocal

set "FILE_PATH=%~1"
set "SCRIPT_DIR=%~dp0"

cd /d "%SCRIPT_DIR%"

:: Tuer tout serveur existant sur le port 3456
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3456"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Lancer le serveur avec le fichier en argument
if defined FILE_PATH (
    start "" /B node "%SCRIPT_DIR%server.js" "%FILE_PATH%"
) else (
    start "" /B node "%SCRIPT_DIR%server.js"
)

:: Attendre que le serveur demarre
timeout /t 2 /nobreak >nul

:: Ouvrir le navigateur
start http://localhost:3456

exit
