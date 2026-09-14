@echo off
echo ===================================================
echo     Starte Galaxy Sisters 3D Browser-Prototyp...
echo ===================================================
echo.
echo Der lokale Server wird gestartet und der Browser geoeffnet.
echo Zum Beenden dieses Fensters einfach schliessen.
echo.

start http://localhost:8080/index.html
python -m http.server 8080
if %errorlevel% neq 0 (
  echo Python nicht gefunden, starte mit npx serve...
  npx --yes serve -l 8080 .
)
pause
