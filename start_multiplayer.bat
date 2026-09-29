@echo off
echo ===================================================
echo     Galaxy Sisters - Koop-Server (2-4 Spieler)
echo ===================================================
echo.
echo Freunde im gleichen WLAN oeffnen die Adresse, die unten steht
echo ("Freunde: http://..."), und geben denselben Raum-Code ein.
echo Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.

start http://localhost:8080/index.html
node server\server.mjs
if %errorlevel% neq 0 (
  echo.
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
)
pause
