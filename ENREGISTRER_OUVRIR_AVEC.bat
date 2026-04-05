@echo off
title Enregistrement - Ouvrir avec Editeur PDF & Word
color 0B

cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"
set "BAT_FILE=%SCRIPT_DIR%OUVRIR_AVEC.bat"
set "APP_NAME=Editeur PDF et Word"
set "APP_ID=EditeurPDFWord"

echo.
echo  ============================================
echo   Enregistrement "Ouvrir avec" pour .docx
echo  ============================================
echo.
echo  Dossier de l'application : %SCRIPT_DIR%
echo.

:: Verifier que Node.js est installe
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe.
    echo  Installez-le sur https://nodejs.org puis relancez.
    pause
    exit /b 1
)

echo  Enregistrement dans le registre Windows...
echo.

:: Creer la cle dans le registre pour l'association .docx
:: 1. Enregistrer l'application dans HKCU\Software\Classes\Applications
reg add "HKCU\Software\Classes\Applications\%APP_ID%.bat" /f >nul 2>&1
reg add "HKCU\Software\Classes\Applications\%APP_ID%.bat\shell\open\command" /f /ve /d "cmd.exe /C \"%BAT_FILE%\" \"%%1\"" >nul 2>&1
reg add "HKCU\Software\Classes\Applications\%APP_ID%.bat" /f /v "FriendlyAppName" /d "%APP_NAME%" >nul 2>&1

:: 2. Associer .docx avec cette application dans OpenWithList
reg add "HKCU\Software\Classes\.docx\OpenWithList\%APP_ID%.bat" /f >nul 2>&1

:: 3. Aussi pour .doc
reg add "HKCU\Software\Classes\.doc\OpenWithList\%APP_ID%.bat" /f >nul 2>&1

:: 4. Aussi pour .pdf (ouvrir un PDF = l'editer n'est pas possible, mais on peut au moins lancer l'app)
reg add "HKCU\Software\Classes\Applications\%APP_ID%.bat\SupportedTypes" /f /v ".docx" /d "" >nul 2>&1
reg add "HKCU\Software\Classes\Applications\%APP_ID%.bat\SupportedTypes" /f /v ".doc" /d "" >nul 2>&1

:: Rafraichir l'explorateur Windows
ie4uinit.exe -show >nul 2>&1

echo  [OK] "%APP_NAME%" est maintenant disponible dans
echo       Clic droit > "Ouvrir avec" sur les fichiers .docx et .doc
echo.
echo  Si l'application n'apparait pas immediatement,
echo  redemarrez l'Explorateur Windows (Ctrl+Shift+Esc > Redemarrer).
echo.
pause
