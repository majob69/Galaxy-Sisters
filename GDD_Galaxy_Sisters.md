# 🌌 Galaxy Sisters - Game Design Document (GDD) & Technischer Entwurf

## 1. Übersicht & Vision
* **Titel:** Galaxy Sisters
* **Genre:** 3D Koop-Action-Adventure / 3D-Platformer mit Obbys & Bosskämpfen
* **Spieler:** 1 bis 4 Spieler (Drop-in / Drop-out Koop)
* **Zielplattform:** Zunächst direkt im Web-Browser (ohne Installation spielbar), später erweiterbar auf PC/Konsole/Mobile
* **Artstyle:** Bunt, Kawaii / Anime-Fantasy, Cel-Shaded (angelehnt an Zelda: The Wind Waker, Genshin Impact & Super Mario Galaxy)

---

## 2. Welche Programmiersprache & Engine eignet sich am besten?

Für ein 3D-Spiel, das **im Browser** laufen soll und später bis zu **4 Spieler** unterstützt, gibt es 3 hervorragende Optionen:

### 🏆 Empfehlung für den Start: **JavaScript / TypeScript mit Three.js (oder Babylon.js)**
* **Warum:** Läuft zu 100% nativ in jedem Browser (Chrome, Firefox, Safari, Edge) ohne Ladebalken von Hunderten Megabytes.
* **Vorteile:**
  * Sofortiger Start: Keine Software-Installation für Spieler nötig – Link anklicken und losspielen!
  * Riesiges Ökosystem, perfekt für schnelle Prototypen und Anpassungen.
  * Für Multiplayer: Leicht kombinierbar mit WebSockets / Node.js (z.B. Colyseus oder Socket.io).
* **Fazit:** Perfekt für den ersten Wurf und interaktive Demos direkt im Browser!

### 🌟 Alternative für langfristige Weiterentwicklung: **Godot Engine 4 (GDScript / C#)**
* **Warum:** Godot ist eine kostenlose Open-Source-Engine mit exzellenter WebGL/WebAssembly-Browser-Exportfunktion.
* **Vorteile:**
  * Kompletter visueller 3D-Editor (Terrain, Animationen, Partikel, Physik).
  * Sehr einsteigerfreundliche Sprache (GDScript ähnelt Python).
  * Eingebautes High-Level Multiplayer-System für bis zu 4 Spieler.
* **Fazit:** Wenn das Spiel später als vollwertiges Steam-/Konsolen-Game erscheinen soll, ist Godot die Top-Wahl.

---

## 3. Die 4 Galaxie-Schwestern (Charaktere & Fähigkeiten)

| Schwester | Himmelskörper | Farbe / Look | Spezialfähigkeit | Rolle im Team |
|---|---|---|---|---|
| **Luna** 🌙 | Mond | Silber / Perlblau / Pastellviolett | **Mond-Schwerkraft & Schild:** Verringert die Fallgeschwindigkeit (sanftes Schweben für Obbys) und erzeugt einen reflektierenden Schutzschild gegen Projektile. | Support / Defense |
| **Stella** ⭐ | Sterne | Goldgelb / Sternenfunkeln | **Sternschnuppen-Sprint & Lichtstrahl:** Kann sich per Sternenblitz nach vorne teleportieren und schießt Sternenkaskaden ab, die dunkle Rätsel aufdecken. | DPS / Mobilität |
| **Solana** ☀️ | Sonne | Warmes Orange / Korallenrot / Gold | **Solar-Supernova & Heilblüte:** Entfesselt einen feurigen Energieimpuls gegen Feinde und hinterlässt eine heilende Sonnenblume für Schwestern. | Allrounder / Heilerin |
| **Saturna** 🪐 | Saturn | Mystisches Lila / Türkis / Ring-Accessoires | **Gravitations-Ringe:** Wirft kreisende Planetenringe, die Gegner heranziehen/festhalten oder schwebende Plattformen in Obbys aktivieren. | Crowd-Control / Puzzle-Master |

---

## 4. Die Spielwelt: Das Himmelsgebirge (Sky Mountain Range)

Die Spielwelt ist offen, freundlich und lädt zum Erkunden ein:
* **Gebirge & Klippen:** Hohe Felsplateaus, die durch kleine Obbys (schwebende Steine, rotierende Ringe) erklommen werden können.
* **Große Blumenwiese:** Farbenfrohe Blumen, Schmetterlinge und glitzernde Partikel.
* **Versteckte Tempel:** Mystische Sternen- und Mondschreine mit Koop-Druckplatten, Runenrätseln und Schätzen.
* **Dörfchen & Hütten:** Kleine gemütliche Kawaii-Holzhütten mit bunten Dächern und rauchenden Schornsteinen.
* **NPCs & Lebewesen:**
  * *Kleine Wesen:* Sternen-Tropfen (Starlets) – niedliche Maskottchen, die einem hinterherhüpfen und Tipps geben.
  * *Dorfbewohner:* Lustige Bergwesen (Astral-Kätzchen oder Wolken-Bärchen), die Quests vergeben.
  * *Kleine Bösewichte:* Sternenstaub-Goblins & Schatten-Slimes (einfach zu besiegen, ideal zum Ausprobieren der Fähigkeiten).

---

## 5. Die Bosskämpfe

### 🐉 Boss 1: "Vortox – Der Wirbelnde Klauenwächter"
* **Aussehen:** Großes, grün-blaues Monster mit schuppiger/weicher Textur, einem einzigen großen leuchtend blauen Auge, niedlich-gefährlichem kleinen Schweif, wehendem langen Haar, kleinen Flügelchen auf dem Rücken und massiven Pranken mit scharfen Klauen.
* **Mechaniken:**
  1. **Tornado-Spin:** Er beginnt schnell zu rotieren und jagt die Spielerinnen über das Kampffeld. Richtet Flächenschaden an, stößt Schwestern weg!
  2. **Klauenhieb & Slam:** Schlägt wuchtig mit seinen Klauen auf den Boden und erzeugt Schockwellen.
  3. **Schwindel-Phase (Konter):** Nach 3 Sekunden Spin wird Vortox schwindelig und taumelt. In diesem Moment öffnet sich sein blaues Auge ganz weit – die Schwestern können gemeinsam Kombo-Attacken landen!

### 🦋 Boss 2: "Morvanta – Die Totenkopf-Mottenkönigin"
* **Aussehen:** Majestätischer Riesenschmetterling. Gewaltige, leuchtend rote Flügel mit auffälligem Totenkopf-Muster und geheimnisvollen Punkt-Markierungen. Sehr lange, pechschwarze Fühler.
* **Mechaniken:**
  1. **Flügelschlag-Hurrikan:** Schlägt mit gewaltiger Wucht die Flügel zusammen – ein roter Windstoß drückt alle Spielerinnen zurück und wirft Felsen durch die Arena.
  2. **Fühler-Grätsch & Einschnürung:** Morvanta schießt ihre langen schwarzen Fühler nach einer Spielerin, fängt sie ein, wickelt sie ein und beginnt, sie zu zerquetschen!
  3. **Koop-Rettung:** Die anderen Schwestern müssen sofort auf die Fühler einschlagen oder Saturna/Stella müssen sie mit ihren Fähigkeiten trennen, um die Gefährtin zu befreien!
  4. **Pollenregen:** Rote Glitzerpartikel regnen herab, die man per Ausweichsprung meiden muss.

---

## 6. 4-Spieler Koop-Features
* **Kombinierte Attacken:**
  * Wenn Saturna einen Boss mit Ringen festhält, richtet Solanas Solarstrahl doppelten Schaden an!
  * Lunas Schwerkraftfeld lässt alle 4 Schwestern gemeinsam weite Obby-Abgründe überspringen.
* **Wiederbelebung:** Fällt eine Schwester um, können die anderen zu ihr eilen und sie durch "Sternen-Highfive" wieder aufwecken.
