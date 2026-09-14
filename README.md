# 🌌 Galaxy Sisters - 3D Browser Game

Ein farbenfrohes 3D-Action-Adventure / Platformer im Kawaii-Anime-Stil, direkt im Webbrowser spielbar!

## 🎮 Features im ersten Prototyp

* **Die 4 Galaxie-Schwestern (jederzeit wechselbar mit Tasten 1, 2, 3, 4 oder UI):**
  * 🌙 **Luna (Mond):** Sanftes Schweben / Mond-Schild `[E]` (blockiert Angriffe und verringert Schwerkraft)
  * ⭐ **Stella (Sterne):** Sternen-Dash `[E]` (Sprintet blitzschnell nach vorne & verschießt Sternenkaskaden)
  * ☀️ **Solana (Sonne):** Solar-Explosion `[E]` (Massiver feuriger Flächenschaden & Partikelregen)
  * 🪐 **Saturna (Saturn):** Gravitations-Ringe `[E]` (Schießt kosmische Ringe, die Gegner treffen und kontrollieren)

* **Die Spielwelt:**
  * 🏔️ **Gebirge & Bergspitzen:** Majestätische Klippen mit Schneekappen rund um das Tal.
  * 🌸 **Große Blumenwiese:** Bunte Blumen, Nadelbäume und blühende Kirschblütenbäume.
  * 🛖 **Dorf & Holzhütte:** Gemütliche Hütte mit rauchendem Schornstein und einem niedlichen Katzen-Dorfbewohner.
  * 🏛️ **Versteckter Himmels-Tempel:** Antike Säulen mit schwebendem, leuchtendem Türkis-Kristall.
  * 🦘 **Obby-Parcours:** Schwebende Sprungplattformen, die hinauf zu einem goldenen Himmels-Stern führen.
  * 🐰 **Niedliche Wesen & Bösewichte:** Knuddelige hüpfende Starlet-Kreaturen und besiegbare Wiesen-Slimes.

* **Bosskampf 1: Vortox – Der Wirbelnde Klauenwächter:**
  * Großes grün-blaues Monster mit einem einzigen leuchtend blauen Auge, wehendem langen Haar, kleinen Flügeln, kleinem Schweif und riesigen Klauenpranken!
  * **Signatur-Fähigkeit:** Startet einen rasanten **Tornado-Wirbel**, der auf die Spieler zustürmt.
  * **Schwachstelle:** Nach dem Wirbeln wird ihm schwindelig – die perfekte Chance für das Schwestern-Team!

* **Bosskampf 2 Konzept:**
  * Klick oben rechts auf **„Boss 2 Info“**, um alle Details zu Morvanta (der gigantische Totenkopf-Schmetterling mit peitschenden Fühlern) einzusehen.

---

## 🕹️ Steuerung

| Aktion | Taste / Bedienung |
|---|---|
| **Laufen** | `W`, `A`, `S`, `D` oder Pfeiltasten |
| **Springen** | `Leertaste` |
| **Spezial-Fähigkeit** | `E` oder Klick auf den Aktions-Button |
| **Schwester wechseln** | `1`, `2`, `3`, `4` oder `Q` oder Klick in der Leiste |
| **Kamera drehen / zoomen** | Maus gedrückt halten & ziehen / Mausrad |

---

## 🚀 Spiel starten

### Option 1 (Einfach per Doppelklick auf Windows):
Einfach die Datei **`start_game.bat`** doppelt anklicken. Der Browser öffnet sich automatisch!

### Option 2 (Über Terminal):
```bash
# Im Projektordner c:\Users\Mario\Coding\Galaxy-Sisters ausführen:
python -m http.server 8080
# Danach im Browser öffnen: http://localhost:8080/index.html
```

Oder alternativ mit Vite:
```bash
npm install
npm run dev
```

---

## 🛠️ Empfohlene Technologie & Nächste Schritte

Im Dokument [GDD_Galaxy_Sisters.md](file:///c:/Users/Mario/Coding/Galaxy-Sisters/GDD_Galaxy_Sisters.md) findest du die komplette architektonische Analyse für:
1. **Multiplayer (bis zu 4 Spieler):** Anbindung über WebSockets (Colyseus oder Socket.io / Node.js).
2. **Godot Engine Option:** Falls das Spiel später nativ für Steam/Konsolen kompiliert werden soll.
3. **Weitere Obby-Level & Rätsel-Mechaniken.**
