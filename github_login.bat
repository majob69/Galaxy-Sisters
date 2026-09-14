@echo off
echo =======================================================
echo    GitHub-Login ueber den Browser (z. B. Google-Konto)
echo =======================================================
echo.
echo Es oeffnet sich gleich dein Standard-Browser.
echo Logge dich dort einfach mit deinem Google-Konto ein
echo und klicke auf "Authorize Git Credential Manager".
echo.

git credential-manager github login

echo.
echo =======================================================
echo Wenn dort "success" oder kein Fehler steht, bist du 
echo erfolgreich verbunden!
echo =======================================================
echo.
pause
