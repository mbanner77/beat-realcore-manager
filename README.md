# Beat RealCore – Legacy League

Der RealCore-Fußballmanager im Browser: Führe TechHub United durch sieben Spieltage gegen die Clubs der Legacy-IT – bis zum Finale gegen den Legacy-Monolith FC.

- `npm start` – startet den Server (Node 22.5+, SQLite integriert)
- Umgebungsvariablen: `PORT`, `DATA_DIR`, `ADMIN_PASSWORD` (für `/admin`), `TEAM_CODE` (RealCore-Benchmark), `ANTHROPIC_API_KEY` (KI-Texte, optional)
- Deploy: Render Blueprint (`render.yaml`), Docker

## Spielinhalt
- Kader, Aufstellung, Formation, Spielstil, Training, Transfermarkt
- Wochenziele (Bonuspunkte), Vorstandsentscheidungen, Kapitän, Elfmeterschütze, Potenzial und Entwicklung junger Spieler:innen
- Spielsimulation in 3D (Babylon.js, lokal gebündelt unter `public/vendor/`, Lizenz: Apache 2.0) mit 2D-Fallback; Live-Ticker, Elfmeter, Karten, Verletzungen, Wechsel, Spielstil live umschaltbar
- Störungen der Legacy-KI, Bestenliste mit RealCore-Benchmark, Gutschein-Flow, DE/EN
- Filmisches Intro (Kamerafahrt durchs Stadion, Titelbutton „Intro“, einmalig vor der ersten Saison)
- Oberfläche 2.0: Übersichts-Tab, Vereinswappen, Spieler-Avatare, Trikots auf dem Aufstellungsbrett, Spielzeitleiste, Ballbesitz, Spieler:in des Spiels, Saison-Auszeichnungen, Torjägerliste
