// Beat RealCore – Legacy League: Stammdaten (Verein, Spieler, Gegner, Taktik)
export const PLAYER = 0, ENEMY = 1;

export const DIFFICULTY = {
  messe: { name: 'Messe', desc: 'Entspannt – ideal für die erste Saison am Stand.', opp: 0.9, budget: 2800, mult: 0.8, inj: 0.6 },
  profi: { name: 'Profi', desc: 'Für alle, die schon mal eine Relegation überlebt haben.', opp: 1.0, budget: 2200, mult: 1.0, inj: 1.0 },
  gf:    { name: 'Geschäftsführung', desc: 'Finale gegen die GF. Keine Gnade für Legacy.', opp: 1.08, budget: 1700, mult: 1.5, inj: 1.3 },
};

// Positionen: TW Torwart, IV Innenverteidiger, AV Außenverteidiger, DM defensives Mittelfeld, ZM zentrales Mittelfeld, FL Flügel, ST Sturm
export const POS = { TW: 'Torwart', IV: 'Innenverteidiger', AV: 'Außenverteidiger', DM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld', FL: 'Flügel', ST: 'Sturm' };
export const POS_GROUP = { TW: 'tw', IV: 'def', AV: 'def', DM: 'mid', ZM: 'mid', FL: 'att', ST: 'att' };

// Formationen: Positionen in Spielfeldanteilen (x = 0 eigenes Tor … 1 gegnerisches Tor, y = 0 … 1 quer)
export const FORMATIONS = {
  '4-4-2': { name: '4-4-2 · Klassisch', slots: [['TW', .04, .5], ['AV', .2, .14], ['IV', .17, .38], ['IV', .17, .62], ['AV', .2, .86], ['FL', .45, .14], ['ZM', .4, .4], ['ZM', .4, .6], ['FL', .45, .86], ['ST', .68, .4], ['ST', .68, .62]] },
  '4-3-3': { name: '4-3-3 · Offensiv', slots: [['TW', .04, .5], ['AV', .2, .14], ['IV', .17, .38], ['IV', .17, .62], ['AV', .2, .86], ['DM', .35, .5], ['ZM', .46, .3], ['ZM', .46, .7], ['FL', .7, .16], ['ST', .74, .5], ['FL', .7, .84]] },
  '5-3-2': { name: '5-3-2 · Clean Core', slots: [['TW', .04, .5], ['AV', .22, .1], ['IV', .15, .3], ['IV', .13, .5], ['IV', .15, .7], ['AV', .22, .9], ['DM', .38, .5], ['ZM', .44, .28], ['ZM', .44, .72], ['ST', .68, .4], ['ST', .68, .62]] },
  '3-5-2': { name: '3-5-2 · Big Bang', slots: [['TW', .04, .5], ['IV', .16, .28], ['IV', .14, .5], ['IV', .16, .72], ['FL', .48, .1], ['DM', .36, .5], ['ZM', .5, .35], ['ZM', .5, .65], ['FL', .48, .9], ['ST', .7, .4], ['ST', .7, .62]] },
};
export const STYLES = {
  clean:  { name: 'Clean Core', desc: 'Kompakt stehen, wenig Risiko, saubere Pässe. Gut gegen starke Gegner.', press: 0.35, risk: 0.3, line: -0.04 },
  agile:  { name: 'Agile Pressing', desc: 'Früh stören, schnell umschalten. Kostet Kondition.', press: 0.85, risk: 0.55, line: 0.03 },
  bigbang:{ name: 'Big Bang', desc: 'Alles nach vorn. Viele Chancen – und viele Konter.', press: 0.6, risk: 0.85, line: 0.08 },
};
export const TEMPO = { slow: { name: 'Ruhig', k: 0.85 }, normal: { name: 'Normal', k: 1 }, fast: { name: 'Hoch', k: 1.15 } };

// Stammkader TechHub United – jede Rolle kommt aus dem Legacy-Wars-Universum
// Attribute 1–99: tempo, technik, abwehr, schuss, kondition
export const SQUAD = [
  { id: 'fw1', name: 'Fiete Firewall', nick: 'Die Firewall', pos: 'TW', tempo: 48, technik: 55, abwehr: 84, schuss: 20, kondition: 72, age: 31, value: 420, unit: 'firewall', desc: 'Blockiert alles, was nicht autorisiert ist. Günstig, robust, nie überrascht.' },
  { id: 'gw1', name: 'Gerd Gateway', nick: 'API-Gateway', pos: 'TW', tempo: 45, technik: 50, abwehr: 72, schuss: 18, kondition: 70, age: 27, value: 220, unit: 'gateway', desc: 'Zweiter Torwart. Reagiert auf jede Anfrage – manchmal mit Timeout.' },
  { id: 'ab1', name: 'Arno ABAP', nick: 'Der Veteran', pos: 'IV', tempo: 52, technik: 66, abwehr: 86, schuss: 58, kondition: 68, age: 34, value: 600, unit: 'abap', desc: 'Kennt jeden Z-Report seit 1997. Köpft Fernschüsse weg wie Dumps.' },
  { id: 'tw1', name: 'Clemens Clean-Core', nick: 'Der Turm', pos: 'IV', tempo: 50, technik: 60, abwehr: 82, schuss: 40, kondition: 76, age: 29, value: 560, unit: 'tower', desc: 'Steht wie ein Clean-Core-Turm. Laser-Tackling inklusive.' },
  { id: 'bt1', name: 'Benno BTP', nick: 'Das Bollwerk', pos: 'IV', tempo: 56, technik: 64, abwehr: 80, schuss: 62, kondition: 82, age: 28, value: 700, unit: 'btp', desc: 'Das Rückgrat jeder Transformation. Schwer zu überlaufen.' },
  { id: 'av1', name: 'Sina Service-Center', nick: 'Die Reparatur', pos: 'AV', tempo: 70, technik: 68, abwehr: 72, schuss: 50, kondition: 85, age: 26, value: 480, unit: 'service', desc: 'Läuft die Linie rauf und runter und repariert jeden Fehler.' },
  { id: 'av2', name: 'Olaf Ops-Center', nick: 'SOC', pos: 'AV', tempo: 66, technik: 62, abwehr: 74, schuss: 46, kondition: 80, age: 30, value: 430, unit: 'soc', desc: 'Überwacht die Flanke mit großer Sichtweite.' },
  { id: 'dp1', name: 'Pia Pipeline', nick: 'Die Datenpipeline', pos: 'DM', tempo: 62, technik: 70, abwehr: 72, schuss: 48, kondition: 92, age: 25, value: 520, unit: 'pipe', desc: 'Liefert ununterbrochen. Kondition ohne Ende, Pässe ohne Verlust.' },
  { id: 'cp1', name: 'Carlo CPI', nick: 'Der Integrator', pos: 'ZM', tempo: 68, technik: 82, abwehr: 55, schuss: 64, kondition: 78, age: 24, value: 650, unit: 'cpi', desc: 'Integriert alles: Pässe, Räume, Gegner. Herz des Spiels.' },
  { id: 'cp2', name: 'Clara CPI', nick: 'Die Schnittstelle', pos: 'ZM', tempo: 72, technik: 78, abwehr: 52, schuss: 60, kondition: 80, age: 22, value: 540, unit: 'cpi', desc: 'Schnell, flexibel, in Masse stark – verbindet Abwehr und Angriff.' },
  { id: 'an1', name: 'Anton Analyst', nick: 'Security-Analyst', pos: 'ZM', tempo: 60, technik: 80, abwehr: 66, schuss: 74, kondition: 70, age: 29, value: 580, unit: 'analyst', desc: 'Präzisionspässe über 40 Meter. Trifft jede Lücke mit einem Schuss.' },
  { id: 'fi1', name: 'Fiona Fiori', nick: 'Der Flitzer', pos: 'FL', tempo: 90, technik: 76, abwehr: 30, schuss: 66, kondition: 74, age: 21, value: 620, unit: 'fiori', desc: 'Schnell, wendig, schickes UI. Fliegt über jede Abwehrreihe.' },
  { id: 'ky1', name: 'Kim Kyma', nick: 'Der Späher', pos: 'FL', tempo: 86, technik: 72, abwehr: 34, schuss: 60, kondition: 78, age: 23, value: 500, unit: 'drone', desc: 'Sieht jede Lücke früher als alle anderen.' },
  { id: 'jj1', name: 'Jules Joule', nick: 'Der Sprinter', pos: 'ST', tempo: 92, technik: 74, abwehr: 25, schuss: 84, kondition: 70, age: 24, value: 900, unit: 'jet', desc: 'KI-Turbo im Sturm. Sehr schnell, eiskalt vor dem Tor.' },
  { id: 'ai1', name: 'Max Mech', nick: 'AI4BIZ', pos: 'ST', tempo: 58, technik: 70, abwehr: 40, schuss: 88, kondition: 66, age: 27, value: 850, unit: 'mech', desc: 'Wuchtiger Abschluss: Wenn Max schießt, zittert das Netz.' },
  { id: 'ba1', name: 'Bastian Batch', nick: 'Der Fernschuss', pos: 'ST', tempo: 44, technik: 60, abwehr: 35, schuss: 80, kondition: 60, age: 33, value: 380, unit: 'batch', desc: 'Nächtliche Batchläufe als Fernschuss. Langsam, aber enorme Reichweite.' },
];
// Trainerstab (fix)
export const STAFF = { physio: 'Basis-Admin Birgit', scout: 'Lena Hoff', coach: 'du' };

// Transfermarkt: Vorlagen für freie Spieler:innen (Cloud-Talente und Veteranen)
export const MARKET_POOL = [
  { name: 'Dana Datasphere', pos: 'ZM', base: [66, 84, 50, 62, 76], desc: 'Verteilt Daten – und Bälle – überall hin, wo sie gebraucht werden.' },
  { name: 'Kurt Kubernetes', pos: 'DM', base: [60, 68, 80, 44, 90], desc: 'Orchestriert das Mittelfeld. Skaliert bei Druck automatisch.' },
  { name: 'Nils Native', pos: 'FL', base: [92, 70, 28, 62, 72], desc: 'Cloud-native Flügelflitzer. Startet in Millisekunden.' },
  { name: 'Hanna HANA', pos: 'ST', base: [78, 76, 32, 86, 70], desc: 'In-Memory-Abschluss: denkt nicht, trifft.' },
  { name: 'Joule Junior', pos: 'ST', base: [84, 64, 22, 72, 68], desc: 'Talent aus dem Hangar. Noch roh, aber schnell.' },
  { name: 'Ida Integration', pos: 'ZM', base: [70, 80, 58, 58, 78], desc: 'Hält alle Schnittstellen im Blick.' },
  { name: 'Theo Terraform', pos: 'IV', base: [54, 62, 84, 40, 78], desc: 'Baut die Abwehr als Code. Reproduzierbar stabil.' },
  { name: 'Greta Governance', pos: 'IV', base: [50, 66, 82, 36, 74], desc: 'Lässt nichts durch, was nicht freigegeben ist.' },
  { name: 'Ole OAuth', pos: 'TW', base: [50, 56, 86, 20, 74], desc: 'Hält nur, wer berechtigt ist. Niemand ist berechtigt.' },
  { name: 'Mila Monitoring', pos: 'AV', base: [74, 64, 74, 44, 86], desc: 'Erkennt Konter, bevor sie entstehen.' },
  { name: 'Sven S/4', nick: 'Der Core', pos: 'ZM', base: [64, 86, 62, 70, 80], desc: 'Der Kern der Mannschaft. Teuer, aber sauber.' },
  { name: 'Lotte Low-Code', pos: 'FL', base: [80, 74, 30, 60, 70], desc: 'Viel Wirkung mit wenig Aufwand.' },
  { name: 'Rudi Rollout', pos: 'AV', base: [72, 60, 70, 50, 82], desc: 'Hat schon in 19 Ländern gespielt. Kennt jede Linie.' },
  { name: 'Hilde Hypercare', pos: 'DM', base: [58, 66, 78, 40, 88], desc: 'Räumt auf, wenn es brennt. Unermüdlich.' },
  { name: 'Yusuf Yaml', pos: 'ZM', base: [62, 76, 60, 56, 76], desc: 'Strukturiert jedes Spiel. Ein Einrückungsfehler und alles steht.' },
  { name: 'Quirin Quantum', pos: 'ST', base: [88, 68, 20, 82, 60], desc: 'Ist gleichzeitig links und rechts. Bis jemand hinschaut.' },
];
export const MARKET_SELL_FACTOR = 0.6;

// Trainingsschwerpunkte
export const TRAINING = {
  angriff:   { name: 'Abschlusstraining', desc: 'Schuss +, Technik + für Stürmer und Flügel.', gain: { schuss: 3, technik: 1 }, group: ['att'] },
  mittelfeld:{ name: 'Integrationstraining', desc: 'Technik +, Tempo + für das Mittelfeld.', gain: { technik: 3, tempo: 1 }, group: ['mid'] },
  abwehr:    { name: 'Clean-Core-Abwehr', desc: 'Abwehr + für Verteidigung und Torwart.', gain: { abwehr: 3, kondition: 1 }, group: ['def', 'tw'] },
  kondition: { name: 'Hypercare-Lauf', desc: 'Kondition + für alle, Fitness vollständig regeneriert.', gain: { kondition: 2 }, group: ['tw', 'def', 'mid', 'att'], fit: true },
  team:      { name: 'Teambuilding', desc: 'Moral + für alle. Kein Attributgewinn.', gain: {}, group: [], morale: 12 },
};

// Gegner der Legacy League – sieben Spieltage, jede Begegnung spiegelt ein Legacy-Thema
export const OPPONENTS = [
  { id: 'silos', club: 'FC Datensilo', short: 'Datensilo', color: '#c9a227', color2: '#5a4310', strength: 58, style: 'silo', seed: 101,
    teaser: 'Vier Abteilungen, vier Wahrheiten: Beim FC Datensilo passt niemand zum Nachbarn. Jeder hält den Ball – keiner teilt ihn.',
    lena: 'Erster Spieltag gegen den FC Datensilo. Die halten den Ball wie ihre Daten: fest und für sich. Presst früh, dann fällt das Silo.',
    legacy: 'Meine Spieler reden nicht miteinander. Das nennt man Abteilungsgrenzen.',
    real: 'Datensilos kosten Unternehmen jeden Tag Zeit und Entscheidungsqualität. Mit SAP BTP, Datasphere und sauberer Integration bringen wir Daten aus allen Bereichen zusammen – eine Wahrheit statt vier Excel-Versionen.',
    offer: ['Datenintegration & SAP Datasphere', 'BTP-Plattformarchitektur', 'KI-gestützte Analytics'],
    names: ['Vertrieb Volker', 'Einkauf Erwin', 'Finanzen Frank', 'Logistik Lars', 'Silo Sigi', 'Insel Ingo', 'Kennzahl Karl', 'Excel Edgar', 'Wahrheit Willi', 'Abteilung Achim', 'Monat Manfred'] },
  { id: 'spaghetti', club: 'Spaghetti Interface SV', short: 'Spaghetti', color: '#ff7a1f', color2: '#6b2d05', strength: 63, style: 'chaos', seed: 202,
    teaser: '312 Punkt-zu-Punkt-Pässe pro Spiel, keiner weiß, wohin. Der Spaghetti Interface SV spielt wild – und manchmal trifft es.',
    lena: 'Die Spaghetti-Elf passt wie wild – ohne Plan. Bleibt kompakt, lasst sie laufen und schlagt zu, wenn sich die Leitung verknotet.',
    legacy: 'Jede einzelne Nudel ist geschäftskritisch. Angeblich.',
    real: 'Gewachsene Punkt-zu-Punkt-Schnittstellen machen jede Änderung teuer und riskant. Mit der SAP Integration Suite (CPI) und einer klaren Integrationsarchitektur werden Schnittstellen beherrschbar, überwacht und wiederverwendbar.',
    offer: ['SAP Integration Suite / CPI', 'Schnittstellen-Inventur & Monitoring', 'API-Strategie'],
    names: ['Nudel Norbert', 'Knoten Kai', 'IDoc Ines', 'P2P Paul', 'Middleware Moritz', 'Flat-File Fred', 'Mapping Marta', 'Schleife Sören', 'Timeout Tim', 'Endlos Elke', 'Monster Mike'] },
  { id: 'excel', club: 'Excel-Makro Kickers', short: 'Makros', color: '#2fa84f', color2: '#0c3a1a', strength: 66, style: 'swarm', seed: 303,
    teaser: 'Die Kickers kommen im Schwarm: 87 kleine Chancen pro Spiel. Einzeln harmlos, zusammen Version 47_final_FINAL.',
    lena: 'Die Makro-Kickers schwärmen. Viele kleine Vorstöße, wenig Wucht. Eine stabile Viererkette und ein sicherer Torwart reichen – wenn ihr nicht die Nerven verliert.',
    legacy: 'Fachbereich meldet: 87 neue Excel-Makros. Alle in der Startelf.',
    real: 'Schatten-IT und Excel-Lösungen entstehen, wo Standardsysteme zu langsam liefern. Mit Low-Code auf der SAP BTP und klaren Fachbereichs-Apps holen wir diese Prozesse zurück ins System – sicher und nachvollziehbar.',
    offer: ['Low-Code-Apps auf SAP BTP', 'Fiori-Entwicklung', 'Schatten-IT-Inventur'],
    names: ['Makro Mandy', 'Zelle Zeno', 'VBA Vera', 'Pivot Peter', 'Zirkel Zenzi', 'Final Finn', 'Kopie Konrad', 'Spalte Sabine', 'Blatt Bruno', 'Summe Sam', 'Fehler Fiete'] },
  { id: 'zombies', club: 'Z-Report Zombies 1998', short: 'Zombies', color: '#8a6d4a', color2: '#3a2a16', strength: 70, style: 'wall', seed: 404,
    teaser: 'Langsam, zäh, undokumentiert: Die Zombies stehen mit zehn Mann hinten und laufen seit 1998 ohne Doku.',
    lena: 'Die Zombies mauern. Geduld, Geduld, Geduld – und dann ein Fernschuss von Anton oder ein Tempo-Lauf von Jules. Nicht in die Masse rennen.',
    legacy: 'Meine Z-Reports laufen seit 1998 ohne Doku. Und jetzt laufen sie zu euch.',
    real: 'Eine S/4HANA-Transformation gelingt, wenn Eigenentwicklungen vorher transparent sind. Mit Z-Insight analysieren wir eure Z-Erweiterungen und Systemgesundheit – und begleiten die Migration bis zum Go-Live.',
    offer: ['S/4HANA-Transformation', 'Z-Insight Custom-Code-Analyse', 'Datenmigration'],
    names: ['Zombie Zed', 'Report Rolf', 'Doku Dieter', 'Include Ivo', 'Legacy Leo', 'Modpool Moni', 'Dynpro Dirk', 'Batch Bodo', 'Spool Sven', 'Job Jürgen', 'Mauer Malte'] },
  { id: 'hypercare', club: 'SV Ticketflut', short: 'Ticketflut', color: '#38e1ff', color2: '#0b3d4a', strength: 73, style: 'press', seed: 505,
    teaser: 'Nach dem Go-Live kommt die Hypercare: Der SV Ticketflut presst 90 Minuten mit Prio 1. Wer die Nerven behält, gewinnt.',
    lena: 'Ticketflut presst wie am ersten Tag nach dem Go-Live. Kurze, sichere Pässe, Kondition schonen – und in der Schlussphase zuschlagen, wenn ihnen die Luft ausgeht.',
    legacy: 'Neues System, neue Fehler. Ich habe Zeit. Ihr nicht.',
    real: 'Nach dem Go-Live entscheidet die Hypercare über den Erfolg: Tickets, Performance, Nutzerfragen. Mit Application Management und Monitoring sorgen wir dafür, dass der neue Betrieb stabil läuft.',
    offer: ['Hypercare & Application Management', 'SAP-Basis-Betrieb', 'Monitoring & Alerting'],
    names: ['Ticket Tanja', 'Prio Pit', 'Eskalation Emil', 'Hotline Hans', 'Incident Inka', 'Störung Stefan', 'Nachfrage Nadja', 'Warteschlange Wenzel', 'Erstkontakt Erik', 'Reopen Ria', 'Deadline Dagmar'] },
  { id: 'rollout', club: 'Fax-Werk Süd', short: 'Fax-Werk', color: '#b8b8b8', color2: '#3b3b3b', strength: 76, style: 'longshot', seed: 606,
    teaser: 'Werk Süd will sein eigenes Template – und schießt aus jeder Lage. Das Fax-Werk trifft aus 30 Metern. Manchmal sogar das Tor.',
    lena: 'Auswärts in Werk Süd. Die schießen aus jeder Entfernung – rückt raus, stellt die Schusslinien zu. Und bringt unser Template heil nach Hause.',
    legacy: 'Jedes Werk hat seine eigenen Prozesse. Ich habe dafür gesorgt.',
    real: 'Internationale Rollouts gelingen mit einem stabilen Template und klarer Steuerung. Wir begleiten SAP-Rollouts von der Template-Entwicklung bis zur Einführung in den Landesgesellschaften.',
    offer: ['Internationale SAP-Rollouts', 'Template-Management', 'Change & Schulung'],
    names: ['Fax Ferdinand', 'Kopierer Klaus', 'Werk Werner', 'Sonderlocke Silke', 'Formular Fritz', 'Durchschlag Doris', 'Papier Pamela', 'Stempel Stan', 'Postweg Percy', 'Telex Toni', 'Ausnahme Axel'] },
  { id: 'monolith', club: 'Legacy-Monolith FC', short: 'Monolith', color: '#ff4d2e', color2: '#4a0d05', strength: 82, style: 'boss', seed: 707,
    teaser: 'Das Finale. Der Legacy-Monolith FC: seit 1998 ungeschlagen, nie dokumentiert, im Sturm der Mainframe-Koloss. Wer ihn stürzt, gewinnt die Liga.',
    lena: 'Das Finale gegen den Monolithen. Der Koloss im Sturm ist langsam – aber wenn er schießt, wackelt das Stadion. Doppelt decken, Tempo über die Flügel, und dann: Clean Core.',
    legacy: 'Ihr wollt mich abschalten? Ich BIN die Dokumentation.',
    real: 'Monolithische Altsysteme bremsen Innovation. Mit Clean Core, BTP-Erweiterungen und KI-Lösungen wie AI4BIZ modernisieren wir Schritt für Schritt – ohne Big Bang.',
    offer: ['Clean-Core-Strategie', 'BTP Side-by-Side-Erweiterungen', 'AI4BIZ'],
    names: ['Monolith Manfred', 'Mainframe Magnus', 'COBOL Conny', 'Koloss Kalle', 'Never-Touch Norman', 'Running-System Rainer', 'Bandlaufwerk Bernd', 'Kernel Kurt', 'Root Rosa', 'Uptime Ulf', 'Dump Dagobert'] },
];

export const SEASON_SCORE = { win: 1000, draw: 400, goal: 120, cleanSheet: 300, title: 3000, second: 1500, third: 800, budget: 0.15 };

// Störungen der Legacy-KI zwischen den Spieltagen
export const EVENTS = {
  release_freeze: { name: 'Release-Freeze', desc: 'Ein Leistungsträger ist für das nächste Spiel gesperrt – „keine Deployments bis Montag“.' },
  change_requests:{ name: 'Change-Request-Flut', desc: 'Ein Spieler verletzt sich im Training: zu viele Änderungen auf einmal.' },
  budget_cut:     { name: 'Budgetkürzung', desc: 'Das Controlling streicht einen Teil des Transferbudgets.' },
  shadow_it:      { name: 'Schatten-IT', desc: 'Der Gegner stellt heimlich einen zusätzlichen Starspieler auf.' },
  koloss:         { name: 'Mainframe-Koloss', desc: 'Der Gegner bringt den Koloss: ein Stürmer mit Wucht, aber ohne Tempo.' },
  wave_now:       { name: 'Pressing-Welle', desc: 'Der Gegner presst das ganze Spiel über mit voller Intensität.' },
};

export const TAUNTS = {
  release_freeze: ['Release-Freeze! Niemand spielt irgendwas. Anweisung von ganz oben.', 'Change Advisory Board tagt. Euer Kapitän sitzt mit drin.'],
  change_requests: ['Eine Flut von Change Requests rollt an. Alle mit Prio 1 – und alle auf eure Knie.', 'Fachbereich meldet: Zu viele Änderungen, Spieler verletzt.'],
  budget_cut: ['Das Controlling hat euer Transferbudget gekürzt. Ich hatte nichts damit zu tun. Fast.', 'Budgetrunde vorbei – ihr habt verloren.'],
  shadow_it: ['Schatten-IT aktiviert. Habt ihr den Spieler im Keller vergessen?', 'Irgendwer hat da einen Spieler gebaut … und er lebt.'],
  koloss: ['Ich hole den Mainframe aus dem Keller. Bandlaufwerke bereit.', 'COBOL-Koloss erwacht. Er hat 40 Jahre Wartungsrückstand – und einen Schuss wie ein Batchlauf.'],
  wave_now: ['Batchlauf gestartet. Ziel: euer Strafraum.', 'Change Request genehmigt: Vollpressing!'],
  win: ['Never touch a running system – ich touche euch trotzdem.', 'Ihr wollt Clean Core? Ich will Chaos.', 'Hab ich doch gesagt. Never touch a running system.'],
  lose: ['Zurück ins Backlog. Wir kommen wieder – mit mehr Change Requests.', 'Das war ein Testsystem. Angeblich.', 'Ich bin älter als eure Frameworks. Und ich habe mehr Zeit.'],
};

export const CLUB = { name: 'TechHub United', short: 'TechHub', color: '#3ddc84', color2: '#0b3b22', stadium: 'Clean-Core-Arena Essen' };

// Wochenziele von Lena Hoff – Bonuspunkte für die Liga-Wertung
export const OBJECTIVES = {
  clean:  { name: 'Zu null spielen', desc: 'Kein Gegentor – die Firewall hält.', bonus: 300 },
  goals2: { name: 'Mindestens zwei Tore', desc: 'Zwei Treffer oder mehr.', bonus: 250 },
  margin: { name: 'Mit zwei Toren Vorsprung gewinnen', desc: 'Ein deutlicher Sieg für die Tabelle.', bonus: 400 },
  poss:   { name: 'Mehr Ballbesitz als der Gegner', desc: 'Das Spiel kontrollieren.', bonus: 200 },
  fair:   { name: 'Keine Karte kassieren', desc: 'Sauber bleiben – kein Ticket vom Schiedsrichter.', bonus: 200 },
  young:  { name: 'Ein Talent unter 24 trifft', desc: 'Die Jugend soll sich zeigen.', bonus: 300 },
  early:  { name: 'Tor in der ersten Halbzeit', desc: 'Früh in Führung gehen.', bonus: 200 },
  shots:  { name: 'Mindestens zehn Torschüsse', desc: 'Druck machen, immer wieder abschließen.', bonus: 200 },
};

// Entscheidungen des Vorstands – eine pro Woche ab dem zweiten Spieltag, jede mit Abwägung
export const DECISIONS = {
  sponsor: { title: 'Sponsorangebot', text: 'Die Data Lake GmbH will aufs Trikot. Sie bietet 300 T€ sofort – oder 150 T€ für jeden Sieg bis zum Saisonende.',
    options: [{ key: 'now', label: '300 T€ sofort', effect: 'Budget +300 T€' }, { key: 'perwin', label: '150 T€ pro Sieg', effect: 'Bonus nach jedem Sieg' }] },
  talent: { title: 'Talent aus der Akademie', text: 'Die Jugendakademie meldet ein Talent: 18 Jahre, roh, aber mit großem Potenzial. Hochziehen oder an einen Partnerclub verleihen?',
    options: [{ key: 'promote', label: 'In den Kader', effect: 'Neue:r Spieler:in, Potenzial ★★★★★' }, { key: 'loan', label: 'Verleihen', effect: 'Budget +120 T€' }] },
  fanday: { title: 'Fan-Tag im TechHub', text: 'Die Fans wünschen sich einen Tag der offenen Tür mit Training zum Anschauen. Kostet 120 T€ – und hebt die Stimmung.',
    options: [{ key: 'yes', label: 'Fan-Tag machen', effect: 'Stimmung +10, Budget −120 T€' }, { key: 'no', label: 'Absagen', effect: 'Keine Änderung' }] },
  overtime: { title: 'Zusatzschicht', text: 'Der Trainerstab schlägt eine zweite Trainingseinheit vor. Mehr Fortschritt, aber schwere Beine am Spieltag.',
    options: [{ key: 'yes', label: 'Zweite Einheit', effect: 'Noch ein Training, Fitness −12' }, { key: 'no', label: 'Regeneration', effect: 'Fitness +6' }] },
  press: { title: 'Pressekonferenz', text: 'Die Sportschau fragt nach dem Saisonziel. Große Töne motivieren die Kabine – und den Gegner.',
    options: [{ key: 'bold', label: '„Wir werden Meister“', effect: 'Stimmung +6, Gegner +4 Stärke' }, { key: 'humble', label: '„Spiel für Spiel“', effect: 'Stimmung +2' }] },
  scout: { title: 'Gegneranalyse', text: 'Ein Berater bietet eine Datenanalyse des nächsten Gegners an – Schwachstellen inklusive. Preis: 100 T€.',
    options: [{ key: 'buy', label: 'Analyse kaufen', effect: 'Gegner −6 Stärke, Budget −100 T€' }, { key: 'no', label: 'Ablehnen', effect: 'Keine Änderung' }] },
  hypercare: { title: 'Hypercare-Einsatz', text: 'Der Betrieb braucht dringend Verstärkung im Go-Live eines Kunden. Ein:e Spieler:in aus der Startelf könnte helfen – gegen gute Bezahlung.',
    options: [{ key: 'yes', label: 'Abstellen', effect: 'Budget +200 T€, ein:e Stammspieler:in erschöpft' }, { key: 'no', label: 'Ablehnen', effect: 'Keine Änderung' }] },
  offer: { title: 'Transferanfrage', text: 'Ein Club bietet 150 % des Marktwerts für {p}. Verkaufen oder halten?',
    options: [{ key: 'sell', label: 'Verkaufen', effect: 'Budget +{v} T€' }, { key: 'keep', label: 'Behalten', effect: 'Stimmung des Spielers +8' }] },
};
