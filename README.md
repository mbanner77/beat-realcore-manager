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
- Sprecher (DE/EN): echte, vorproduzierte Stimmen (Piper-TTS, gemastert) unter `public/audio/voice/<lang>/` für Intro, Lena, Legacy-KI, Abpfiff und Meisterfeier; der Live-Kommentar mit Spielernamen nutzt ergänzend die Sprachausgabe des Geräts. Abschaltbar. Neue Zeilen: Text in `tools/voice/lines.mjs` ergänzen und `tools/voice/gen_de.py` / `gen_en.py` (Piper-Modelle: thorsten-high, eva_k, ryan-high, hfc_female, alan) laufen lassen (Manifest = Text → Datei)
- Intro läuft beim Start (Klick auf „Los geht's“ schaltet Ton frei), Abpfiff-Animation (Sieg/Remis/Niederlage) und Meisterfeier mit Feuerwerk, Pokal und Konfetti
- Spielanimation: Schuss-/Passbewegung, Torwartparaden, Grätschen, Protest bei Karten, Schiedsrichter, TV-Zoom im Angriffsdrittel, Torwiederholung in Zeitlupe aus der Torkamera, pulsierendes Publikum, Kick-Sounds
- Untertitel: jede gesprochene Ansage (Sprecher, Lena, Legacy-KI, Live-Kommentar) wird auch als Text eingeblendet
- Kommentar in deutscher Sprache (Inbetriebnahme, Schnellkorrektur, Änderungsantrag, Schnittstelle …), Aussprachehilfen für englische Spielernamen in der Sprachausgabe; Halbzeitfazit, Nachspielzeit, gegnerische Auswechslungen
- Live-Kommentar mit echter Stimme: Satzteile, Spieler-/Vereinsnamen und Zahlen werden einzeln produziert (`tools/voice/frags.mjs` + `gen_frags.py`, Ausgabe `public/audio/voice/<lang>/c/`) und im Browser per Web Audio nahtlos zusammengesetzt; Gerätestimme nur noch als Rückfall
- Wetter (Sonne, Regen, Sturm, Schnee) mit Einfluss auf Pässe, Tempo und Abschlüsse sowie 3D-Regen/-Schnee; Kabinenansprache zur Halbzeit; Live-Konditionsanzeige mit Wechselhinweisen
- Wirtschaft: Eintrittspreis (10–60 €) mit Zuschauerprognose, Fan-Stimmung (Ergebnisse, Tore, Preise, volle Ränge), Stadionausbau in drei Stufen (12.000 → 42.000 Plätze), Fanshop, VIP-Logen, Trainingszentrum, Reha-Zentrum, Gehälter und Unterhalt, Abrechnung je Spieltag mit Verlauf
- Saisonlänge wählbar: kurz (7 Spieltage) oder voll (14 Spieltage, Hin- und Rückrunde); Punkte werden auf 7 Spieltage normiert, damit die Bestenliste vergleichbar bleibt
- 3D-Spieler mit Gelenken (Hüfte, Wirbelsäule, Kopf, Schulter/Ellbogen, Hüfte/Knie/Fuß), Haarstile, Rückennummern, Torwarthandschuhe; Laufzyklus mit Kniebeuge und Armschwung, Bereitschaftshaltung des Torwarts, Schuss-, Hechtsprung-, Grätschen- und Jubelposen
- Nachbearbeitung (Kantenglättung, Leuchten, Kontrast, Vignette; schaltet sich bei schwacher Hardware ab), detaillierter Rasen, Kameramodi TV / Nah / Hinter dem Angriff / Taktik
- Weiche Posenübergänge, Kopf folgt dem Ball, Ball am Fuß beim Dribbling, Gesichter (Augen, Brauen, Ohren, Mund – nur in Nahansichten), Trikotmuster je Verein (Streifen, Ringel, Schärpe, Seitenbahnen) mit Brustwappen, Netz wölbt sich beim Tor, flatternde Eckfahnen, Trainerbänke, Anzeigetafel mit Spielstand, Flugspur bei Schüssen
- Training 2.0: Schwerpunkt (inkl. Taktiktraining), Intensität (leicht/normal/hart mit Verletzungsrisiko), Einzeltraining für bis zu zwei Spieler:innen, Vorschau der Wirkung, Trainingsbericht mit Wertänderungen; Eingespieltheit je Formation und Spielstil (wirkt −4 % bis +4 % auf alle Werte)
- Spielerprofil per Klick im Kader: Netzdiagramm (aktuell vs. Saisonstart), Werteentwicklung, Statistiken, Aktionen (Kapitän, Elfmeter, Einzeltraining, Verkaufen)
- Startseite 2.0: 3D-Stadion im Hintergrund mit laufendem Demo-Spiel und Kamerafahrt, Live-Matchcenter, persönliche Bilanz, Bereiche „Das Spiel“, „Die Gegner“, „In drei Schritten“; Spielstand wird automatisch gesichert („Weiterspielen“)
- Startbildschirm: sofortige Ladeanzeige, Flutlicht-Stimmung, echter Ladefortschritt (Schriften, Stimmen, Liga, 3D-Stadion), Wahl zwischen Intro und direktem Einstieg
- Erfolge: 16 freischaltbare Erfolge über alle Saisons (z. B. Weiße Weste, Hattrick, Comeback, Monolith gestürzt, Beat RealCore) mit Einblendung und Übersicht auf der Startseite
- Übersicht: Gegneranalyse (Abwehr/Mittelfeld/Angriff im Vergleich, Tipp zur Spielweise), Mini-Tabelle, Restprogramm; Kader sortier- und filterbar; Saisonverlauf (Tabellenplatz je Spieltag) im Tabellen-Tab
- Das Intro läuft bei jedem Start nach „Los geht's“ (im Intro überspringbar)
- 3D-Spieler 2.0: echte Figuren mit Skelett-Animationen (Quaternius, CC0) – Stehen, Joggen, Sprinten, Grätsche, Abwurf, Jubel, Protest, Torwart-Bereitschaft; Schuss als Zusatzbewegung im Code; Trikotfarben über Farbzonen-Palette. Modell neu bauen: `node tools/build-player-model.mjs <UAL1.glb> <UAL2.glb> public/models/player.glb` (benötigt @gltf-transform/core, @gltf-transform/functions, meshoptimizer)
- Echte Himmel (Poly Haven, CC0) für Tag, Regen/Schnee und Flutlicht; Rasen mit Relief (Normalenkarte „Leafy Grass“, CC0)
- Fußball-Bewegungen aus Mixamo (Adobe, Motion-Capture): Pass, Chip, Schuss aus dem Lauf und aus dem Stand, Kopfball, Grätsche, Sturz und Aufstehen, Dribbling, Fußball-Jog, Torwart-Bereitschaft, Seitschritt, Hechtparade links/rechts, Fangen, Abstoß, Abwurf, Jubel. Übertragung auf das Spielerskelett: `node tools/retarget-mixamo.mjs <modell.glb> <ausgabe.glb> name=datei.glb[:inplace] …` (FBX vorher mit FBX2glTF umwandeln). Start jeder Aktion kurz vor dem Ballkontakt, damit Fuß und Ball zusammenpassen
- HD-Spieler: realistischer Körper (Quaternius „Universal Base Characters“, CC0) mit Gesicht, Augen, Augenbrauen; Trikot, Hose, Stutzen, Schuhe und Haare werden pro Spieler in die Körpertextur gemalt (Zonenkarte `public/models/hd/kit-zones.png`, erzeugt mit `tools/build-hd-model.mjs` + `tools/build-kit-zones.py`); Hauttöne gemischt; auf schwächeren Geräten automatisch die einfache Figur (`?hd=0/1` erzwingt)
- 3D-Publikum: einige Tausend Zuschauer als Instanzen in Vereinsfarben (Gästeblock), springen bei Toren auf und reißen die Arme hoch; echte Schatten der Spieler; nasser Rasen bei Regen
- Kamera bleibt immer im Stadioninneren (Intro, Torjubel, Wiederholung); Tribünen steigen vom Spielfeld aus an und haben eine Rückwand
- Leistung: Animationen werden je Spieler erst bei Bedarf angelegt, Trikotbilder seitenweit wiederverwendet, Modelle schon während des Startbildschirms geladen; Intro, Startseite und Meisterfeier nutzen die leichte Figur; automatische Qualitätsstufe (Schatten nur bei genug Leistung, bei Ruckeln werden Effekte schrittweise abgeschaltet); Einstellung „Grafik“: Automatisch / Hoch / Mittel / Schnell
- Standardsituationen: echte Ecken (Spieler laufen in den Strafraum, Manndeckung, Flanke, Kopfballduell, Torwart fängt ab), Freistöße mit Mauer (direkt aufs Tor oder in den Strafraum, Schütze = Elfmeterschütze), Flanken von außen, Paraden und abgefälschte Schüsse zur Ecke; Statistik mit xG, Ecken und Fouls
- Kamera „Regie“ (Standard): nah von der Seite im Spielaufbau, näher und zum Tor gedreht im Angriffsdrittel, erhöht in den Strafraum bei Ecken, hinter dem Schützen bei Freistoß und Elfmeter; weitere Kameras über den Kamera-Knopf
