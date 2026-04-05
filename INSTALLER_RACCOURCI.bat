@echo off
title Installation - Editeur PDF et Word
color 0B

echo.
echo  ============================================
echo   Installation du raccourci Bureau
echo  ============================================
echo.

cd /d "%~dp0"

:: Creer le raccourci sur le bureau
set SCRIPT_DIR=%~dp0
set SHORTCUT_NAME=Editeur PDF et Word
set DESKTOP=%USERPROFILE%\Desktop

:: VBScript pour creer le raccourci
set VBS_FILE=%TEMP%\create_shortcut.vbs

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_FILE%"
echo sLinkFile = "%DESKTOP%\%SHORTCUT_NAME%.lnk" >> "%VBS_FILE%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_FILE%"
echo oLink.TargetPath = "%SCRIPT_DIR%DEMARRER.bat" >> "%VBS_FILE%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS_FILE%"
echo oLink.Description = "Editeur PDF et Word" >> "%VBS_FILE%"
echo oLink.WindowStyle = 1 >> "%VBS_FILE%"
echo oLink.Save >> "%VBS_FILE%"

cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

if exist "%DESKTOP%\%SHORTCUT_NAME%.lnk" (
    echo  [OK] Raccourci cree sur le Bureau : "%SHORTCUT_NAME%"
    echo.
    echo  Double-cliquez sur l'icone "%SHORTCUT_NAME%"
    echo  sur votre Bureau pour lancer l'application !
) else (
    echo  [ERREUR] Impossible de creer le raccourci.
)

echo.
pause
