@echo off
echo =======================================================
echo    Lade Galaxy Sisters zu GitHub (majob69) hoch...
echo =======================================================
echo.
echo Falls sich ein GitHub-Login-Fenster oeffnet, bitte kurz bestaetigen.
echo.

git push -u origin main

echo.
if %errorlevel% equ 0 (
  echo =======================================================
  echo   ERFOLGREICH HOCHGELADEN! 
  echo   Du kannst es jetzt auf jedem Rechner klonen mit:
  echo   git clone https://github.com/majob69/Galaxy-Sisters.git
  echo =======================================================
) else (
  echo Fehler beim Hochladen. Bitte pruefe die Internetverbindung oder deinen GitHub-Login.
)
echo.
pause
