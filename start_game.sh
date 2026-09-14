#!/bin/bash
echo "==================================================="
echo "  Starte Galaxy Sisters 3D (Linux / Chromebook)... "
echo "==================================================="
echo ""
echo "Server startet auf Port 8080..."
echo "Oeffne deinen Browser unter: http://localhost:8080"
echo ""

if which xdg-open > /dev/null; then
  xdg-open http://localhost:8080 &
elif which google-chrome > /dev/null; then
  google-chrome http://localhost:8080 &
fi

python3 -m http.server 8080 || python -m http.server 8080 || npx serve -l 8080 .
