# Narkoseprotokoll Demo – Basisdaten des Narkosefalls

Webanwendung zur Dokumentation eines **fiktiven Narkosefalls**. Der Ablauf ist
zweistufig:

1. **`/` – Basisdaten des Narkosefalls**: Formular mit acht Feldern, feldweisem
   Autosave, Datumsvalidierung und Offline-Fähigkeit. Das leere OP-Datum öffnet
   den Kalender beim heutigen Tag und bietet die Direktwahl `Heute`.
2. **`/dokumentation` – Vitalparameter-Zeitgrafik** (nach „Okay und Weiter“): eine
   gemeinsame SVG-Zeitgrafik mit Therapie-/Ereignis-Lanes und vier Baendern
   (SpO₂, Herzfrequenz, NiBP, Temperatur), Start-/Ende-/Jetzt-Logik und Eingabe
   per Maus, Finger und Apple Pencil.

> ⚠️ **Nur fiktive Demodaten.** Es dürfen niemals echte Patientendaten
> eingegeben oder gespeichert werden.

## Projektziel

Erfassung der acht Basisfelder eines Narkosefalls in einem ruhigen,
professionellen Formular, das

- auf einem aktuellen iPad in Safari und auf dem Desktop in aktuellem Chrome läuft,
- Eingaben pro Feld automatisch lokal speichert und nach Neuladen/Neustart
  wiederherstellt,
- nach dem ersten Online-Aufruf auch offline erneut geöffnet werden kann,
- technisch so aufgebaut ist, dass später **Pointer Events** (Maus, Finger,
  Apple Pencil) für eine grafische Vitalwertkurve ergänzt werden können.

## Verwendete Technologien

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** (Strict Mode)
- **Ant Design 6** als zentrale UI-Bibliothek (deutsche Lokalisierung, ruhiges
  medizinisches Theme, grüner Erfolgsstatus)
- **dayjs** für die Datumsfelder
- **d3-scale** – Zeit↔X- und Wert↔Y-Umrechnung (`scaleTime`, `scaleLinear`)
- **d3-shape** – SpO₂-Step-Linie/-Flaeche und Linienpfade (`curveStepAfter`, `line`, `area`)
- **Zustand** – Fall-State (Start-/Endzeit, Messungen, Medikamente, Infusionen,
  Ereignisse und Speicherstatus) mit localStorage-Persistenz
- **`localStorage`** für Basisdaten und Vitaldaten (kein Backend, keine Datenbank)
- **Serwist** (`@serwist/next`) für Service Worker / PWA
- **Vitest** + **Testing Library** (Unit-/Komponententests)
- **Playwright** (End-to-End-Tests, Chromium + iPad-naher Viewport)
- **npm** als Paketmanager

## Voraussetzungen

- **Node.js ≥ 20** (getestet mit Node 24) und npm

## Installationsschritte

```bash
npm install
npx playwright install chromium   # Browser für die E2E-Tests
```

Optional (App-Icons neu erzeugen):

```bash
npm run generate-icons
```

## Startbefehl (Entwicklung)

```bash
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen.

Produktionsbetrieb lokal:

```bash
npm run build
npm run start
```

> Hinweis: Der Produktions-Build nutzt bewusst **webpack**
> (`next build --webpack`), weil der Service Worker über das webpack-basierte
> Serwist-Plugin erzeugt wird. Der Service Worker ist im Entwicklungsmodus
> deaktiviert und nur im Produktions-Build aktiv.

## Testbefehle

```bash
npm run lint        # ESLint
npm run test        # Unit-/Komponententests (Vitest)
npm run build       # Produktions-Build (inkl. TypeScript-Prüfung + Service Worker)
npm run test:e2e    # End-to-End-Tests (Playwright)
```

Für `npm run test:e2e` muss zuvor `npm run build` gelaufen sein – Playwright
startet den Produktionsserver (Port 3100) mit `npm run start`. Es gibt zwei
Projekte: `chromium` (Desktop) und `ipad-viewport` (iPad-naher Viewport 810×1080
mit Touch). Für WebKit zusaetzlich `npx playwright install webkit`.

**Videos** werden für **alle** Tests erzeugt (auch erfolgreiche Haupt-Flows,
`video: "on"`) und liegen unter:

```text
test-results/<test-ordner>/video.webm
```

## Erklärung des Autosaves

Jedes der acht Felder speichert **eigenständig** mit einem **eigenen
Debounce-Timer**:

1. Bei einer Änderung erscheint an der Zeile sofort der neutrale Status
   `Wird gespeichert …`.
2. Erst **2,5 Sekunden** nach der letzten Änderung dieses Feldes wird der Wert
   nach `localStorage` geschrieben. Jede weitere Eingabe innerhalb dieser Zeit
   startet die Wartezeit für dieses Feld neu.
3. Nach dem erfolgreichen Schreiben erscheint rechts neben dem Feld das grüne
   `✓ Gespeichert`.
4. Schlägt das Speichern fehl, erscheint stattdessen `Speichern fehlgeschlagen`
   – Fehler werden nicht still ignoriert.

Unterhalb der Felder zeigt ein Gesamtstatus:

- `✓ Alles dauerhaft automatisch gespeichert` (grün), wenn nichts mehr aussteht,
- `Änderungen werden automatisch gespeichert …`, solange ein Feld noch wartet,
- eine klare Fehlermeldung, falls ein Speichern fehlgeschlagen ist (dann wird der
  grüne Erfolgsstatus nicht angezeigt).

„Dauerhaft gespeichert“ bedeutet hier: **lokal in diesem Browser** – nicht auf
einem Server und nicht auf anderen Geräten.

## Erklärung von `localStorage`

- Die Daten liegen unter dem Schlüssel
  `sikant-anesthesia-demo.patient-base-data.v1`.
- Beim Laden der Startseite werden gespeicherte Daten gelesen, einfach validiert
  und wiederhergestellt. **Beschädigtes/ungültiges JSON** führt nicht zum
  Absturz – es wird auf einen leeren Zustand zurückgegriffen.
- Lese- und Schreibfehler werden mit `try/catch` behandelt. Auch leere Werte
  werden korrekt gespeichert und wiederhergestellt.
- Sofern der Browser es unterstützt, wird einmalig `navigator.storage.persist()`
  als Best-Effort angefragt; die App funktioniert auch bei Ablehnung.

## Erklärung der PWA-/Offline-Funktion

- Die App ist eine **PWA** mit Web-App-Manifest (`/manifest.webmanifest`) und
  neutralen, selbst erstellten Icons.
- Beim ersten **Online**-Aufruf speichert der **Service Worker** alle zum Öffnen
  der Startseite nötigen Dateien (Precache inkl. der vorgerenderten Routen `/`
  und `/dokumentation`).
- Danach lassen sich `/` und `/dokumentation` auch **ohne Internetverbindung**
  erneut öffnen; die bereits gespeicherten Formulardaten werden offline geladen
  und können offline bearbeitet und gespeichert werden.
- Bei fehlender Verbindung erscheint der unaufdringliche Hinweis
  `Offline – Änderungen werden lokal gespeichert`; er verschwindet automatisch,
  sobald wieder eine Verbindung besteht.
- Eine Serversynchronisation gibt es in dieser Stufe bewusst nicht.

## Vitalparameter-Zeitgrafik (`/dokumentation`)

### Warum ein einziges SVG?

Die vier Baender (SpO₂, Herzfrequenz, NiBP, Temperatur) sind **kein** Verbund aus
vier unabhaengigen Charts, sondern **ein gemeinsames SVG**. Nur so teilen sich
alle Baender exakt dieselbe X-Achse: derselbe Zeitpunkt liegt in allen vier
Baendern an derselben senkrechten Position, und der Jetzt-Indikator ist **eine
einzige** vertikale Linie durch alle Baender. Es wird keine High-Level-Chart-
Bibliothek (Recharts/Chart.js/ECharts) und kein Canvas verwendet.

### d3-scale / d3-shape

- **d3-scale** (`lib/timeline/scales.ts`): `scaleTime` rechnet echte Zeit ↔ X-Pixel
  (`timeToX`/`xToTime`), je ein `scaleLinear` pro Band rechnet Wert ↔ Y-Pixel und
  – per `invert` – Pointer-Y ↔ echter Messwert.
- **d3-shape** (`lib/timeline/spo2Path.ts`, `components/vitals/LineBand.tsx`):
  SpO₂ nutzt `curveStepAfter` für Step-Linie und `area` für die wasserartige
  Flaeche; Herzfrequenz/Temperatur nutzen `line`.

React rendert alle SVG-Elemente; D3 manipuliert das DOM **nicht** direkt.

### Pointer → Zeit und Wert

`lib/timeline/pointerMapping.ts` wandelt eine Pointer-Position um:
`getBoundingClientRect()` → SVG-Koordinaten → Band-Erkennung über Y →
`scaleTime.invert` (Zeit) und `scaleLinear.invert` (Wert), gerundet gemaess
Parameter-Precision. Zukunft und Bereich vor dem Start werden als **Fehler**
gemeldet (keine stille Clamp). Nahe der Jetzt-Linie wird auf „jetzt“ geschnappt.

Eine gemeinsame Pointer-Logik (`hooks/useTimelinePointer.ts`) behandelt Maus,
Finger und Stift über `pointerdown/move/up/cancel` + `setPointerCapture`
(`pointerType` wird ausgewertet). Kurze Bewegung = Tap; groessere Bewegung auf
dem Plot = Seiten-Scroll (`touch-action: pan-y`), auf einem Punkt = Ziehen
(`touch-action: none`). Waehrend des Ziehens gibt es nur eine Live-Preview;
gespeichert wird **einmalig** beim Loslassen.

### Start-/Jetzt-Logik und wachsende Zeitachse

- Der Start-Button zeigt vor dem Start die laufende Uhr `HH:mm:ss`; beim Klick wird
  `Date.now()` als Startzeit gespeichert und aendert sich danach nie mehr.
- `domainStart` bleibt fix auf der Startzeit (immer links sichtbar), `domainEnd`
  waechst mit `now + 30 min`, wodurch die 5-Minuten-Spalten mit der Zeit schmaler
  werden. Es gibt **kein** horizontales Scrollen.
- Die 5-Minuten-Ticks sind **relativ zur Startzeit** (Start 19:03 → 19:03, 19:08 …),
  nicht an der Wanduhr ausgerichtet.
- „Jetzt“ wird immer aus `Date.now()` berechnet (auch nach `visibilitychange`),
  nie hochgezaehlt. Der Jetzt-Indikator aktualisiert isoliert (~250 ms), ohne die
  ganze Seite mit 60 fps neu zu rendern.

### SpO₂-Step-Area

Der zuletzt gemessene SpO₂-Wert wird als Stufe **bis zur Jetzt-Linie** gehalten
(nie in die Zukunft), ohne kuenstliche Schwankungen. Neue Werte erzeugen eine
neue Stufe (`curveStepAfter`).

### Erweiterte Timeline-Interaktion

- `Eingriff beenden` ist vor dem Start deaktiviert und verlangt eine explizite
  Bestätigung. `endedAt = Date.now()` wird sofort gespeichert. Danach frieren
  phosphorgrüne Spur, Punkt, gemeinsame Jetzt-Linie und Zeit-Domain ein; der
  Zustand `Beendet um HH:mm:ss` besitzt eine validierte Korrekturfunktion.
- Kurze Fälle verwenden dünne 1-Minuten-Minor- und stärkere beschriftete
  5-Minuten-Major-Linien. Bei langen Eingriffen werden Linien und Beschriftungen
  anhand der verfügbaren Pixelbreite adaptiv ausgedünnt, damit Messwerte und
  Texte lesbar bleiben.
- Ein Crosshair zeigt Zeit, aktiven Parameter, Pointerwert und Einheit. Bei NiBP
  ist dies nur der **Zeigerwert**; Systole und Diastole werden nie abgeleitet.
  Crosshair-State ist transient und wird nicht in localStorage geschrieben.
- Reines Nearest-Point-Hit-Testing nutzt Radien von **12 px (Maus)**,
  **16 px (Pen)** und **18 px (Touch)**. NiBP prüft nur die vertikale
  Systole-Diastole-Linie und den Mittelwertpunkt. Ausserhalb der Toleranz öffnet
  ein neuer Eintrag; grosse 44×44-Overlay-Rechtecke gibt es nicht.
- Pointer-Zeit und -Wert werden im neuen Vitalformular vorbelegt. Temperatur
  nutzt einen such- und direkt auswählbaren 0,1-°C-Picker statt Spinbuttons; bei
  NiBP wird nur `Mittel` vorbelegt. Jedes neue
  und bestehende Formular besitzt ein editierbares `Zeit`-Feld (`HH:mm:ss`) mit
  Start-, Zukunfts- und Ende-Validierung.
- NiBP wird zweistufig erfasst: zuerst Zeit und `Mittel`, anschließend werden
  die kleinen oberen/unteren SVG-Griffe für `Systolisch` und `Diastolisch`
  direkt gezogen. Ein kurzer Klick/Tap auf einen weißen Griff öffnet zusätzlich
  die direkte Zahleneingabe für Systolisch und Diastolisch. Während Hover, Pen-
  oder Touch-Interaktion zeigt ein kompakter Tooltip alle drei Zahlen und genau
  eine feste Einheit `mmHg`.

### Medikamente, Infusionen und Ereignisse

Oberhalb der Vitalbänder liegen drei Teile **desselben SVG und derselben X-Skala**:

- **Medikamente**: Bolus oder kontinuierliche Gabe mit Name, Zeitpunkt,
  Dosis/Rate, Einheit, optionaler Darstellungsdauer/Endzeit beziehungsweise
  explizitem laufenden Status.
- **Infusionen und Flüssigkeiten**: Name, Beginn, Menge/Dosis, Einheit,
  optionale Dauer/Endzeit und laufender Status.
- **Phasen und Ereignisse**: Beginn Anästhesie, Schnitt, Naht, Ende Ausleitung
  und Patient aus dem Saal. Jeder Typ ist pro Fall einmalig; erneute Auswahl
  öffnet die Bearbeitung.

Medikament-/Infusionsmarker sind editier- und löschbar. Ein ausschließlich vom
Benutzer angegebener Zeitraum wird ohne Flächenfärbung als diagonale
**Hatch-Linien innerhalb jedes Vitalbands** gezeichnet. Farbe, Richtung,
Strichstärke, Abstand und Strichstil unterscheiden parallele Einträge; Hover,
Pen und Touch zeigen Name, Typ sowie Start-/Endzeit. Explizite Dauer/Endzeit
wird vollständig angezeigt, laufende Gaben enden am aktuellen Zeitpunkt bzw.
`endedAt`. Ohne Dauer/Endzeit entsteht nur ein Marker mit Startlinie. Es wird keine
pharmakologische Wirkung, Verweildauer oder Behandlungsempfehlung abgeleitet.

Allgemeine Hinzufügen-Buttons gibt es nicht mehr: Ein Klick in die
Medikamenten- beziehungsweise Infusions-Lane übernimmt exakt die angezeigte
Zeit in das Formular. Die fünf Ereigniswerkzeuge liegen im linken Gutter der
Lane `Phasen und Ereignisse`; nach der Auswahl zeigt die Lane Symbol- und
Sekundenzeit-Preview und platziert das Ereignis beim Klick. Im Edit-Drawer sind
Ereignistyp/-name und Zeit änderbar. Eine erneute Berührung desselben Symbols
hebt die Auswahl nicht auf; sie bleibt bis zur Platzierung stabil.

Nach `Eingriff beenden` erscheint **Speichern und Schließen**. Die Aktion
öffnet eine eigene Registerkarte, fragt nach Bestätigung und `Ordnerpfad`, legt
ein vollständiges lokales Archiv an und leert erst danach aktive Fall- und
Patientendaten. **Neuen Fall starten** führt zu leeren Basisdaten; nach
`Okay und Weiter` steht wieder der reguläre Start-Button bereit.

Eventmarker besitzen Symbol, Namen und Sekundenzeit. Sie lassen sich per Pointer
Events mit `setPointerCapture` ausschließlich horizontal verschieben. Während
des Drags erscheint eine Vorschau; persistiert wird einmal bei `pointerup`.
Gleichzeitige Marker werden im Lane vertikal getrennt, ihre Zeitlinien behalten
die exakte gemeinsame X-Position.

### Farben (zentrale Tokens)

Semantische Farben als CSS-Variablen in `app/globals.css`:
`--vital-spo2` (blau), `--vital-heart-rate` (rot), `--vital-nibp` (grau),
`--vital-temperature` (orange), `--timeline-now*` (grün). Farbe ist nie die
einzige Information – jedes Band hat Name, Einheit, eigene Form und `aria-label`.

### State & Persistenz (Zustand + localStorage)

`store/anesthesiaCaseStore.ts` haelt Start-/Endzeit, Messungen, Medikamente,
Infusionen, Ereignisse und Speicherstatus und
persistiert **sofort** nach jeder abgeschlossenen Aktion unter dem versionierten
Schlüssel `sikant-anesthesia-demo-case:v1` (`schemaVersion`). Gespeichert werden
nur echte Zeit-, Mess-, Dosis-, Einheits- und Dauerwerte, **niemals Pixelkoordinaten** –
bei Groessenaenderung werden alle Positionen neu berechnet (`ResizeObserver`).

Die aktuelle Schema-Version ist **3**. Bestehende Version-1- und Version-2-Fälle
werden beim Lesen verlustfrei migriert. Version 3 erlaubt bei einer neuen
NiBP-Messung zunächst offene (`null`) Systole-/Diastole-Griffe; vorhandene
vollständige Blutdruckwerte bleiben unverändert. Bei Version 1 bleiben
`startedAt` und Vitalmessungen erhalten, `endedAt` wird `null` und
Medikamente/Infusionen/Ereignisse werden leere Arrays.
Beschädigte oder unbekannte Daten werden nicht still überschrieben.

**Recovery nach Reload:** Start-/Endzeit, Messungen, Therapien, Ereignisse und
SpO₂-Flaeche werden wiederhergestellt. Ohne `endedAt` springt der Jetzt-Indikator
auf die echte aktuelle Zeit; mit `endedAt` bleibt er dort stehen.
Beschaedigte Daten fuehren nicht zum Absturz: es erscheint
„Gespeicherte Falldaten konnten nicht geladen werden.“ mit der Option
**„Demofall zurücksetzen“** – beschaedigte Daten werden **nicht** still ueberschrieben.

### iPad & Desktop / Apple Pencil

Bedienbar mit Maus (Desktop), Finger und Apple Pencil (iPad). Ein echter Apple
Pencil laesst sich nicht automatisiert testen; die Pointer-Events-Logik ist aber
fuer `mouse`, `touch` und `pen` gemeinsam implementiert und wird per Playwright
(Maus + iPad-Viewport) geprueft.

Die Unit-Suite umfasst **103 Tests** unter anderem für Ende/Domain, Migration,
Hit-Testing, Pointer-Mapping, Zeitvalidierung, Grid-Ticks, Therapiedauern und
CRUD/Persistenz. Playwright umfasst **46 Läufe** (23 Szenarien mal
Desktop-Chromium und iPad-naher Touch-Viewport), einschließlich Ende,
präzisem Hit-Testing, Zeitbearbeitung, NIBP-Griffen, kontextuellen Lanes,
Hatch-Tooltips, Therapie-CRUD, Event-Drag, Fallabschluss und der wieder
großzügig lesbaren Timeline.

## Wichtige Hinweise zur Speicherung

- Die Speicherung gilt **nur** für **denselben Browser, dasselbe Gerät und
  dieselbe Domain**. Es werden **keine** Daten an einen Server oder an andere
  Geräte übertragen.
- Der beim Abschluss eingegebene `Ordnerpfad` ist in der Browser-Demo eine
  Ablagebezeichnung des lokalen Archivs; Webbrowser dürfen aus Sicherheitsgründen
  nicht allein anhand eines Textpfads beliebige Betriebssystemordner beschreiben.
- **Privates Surfen** (Inkognito) oder das **manuelle Löschen der Browserdaten**
  hebt die Speicherung auf.
- Es dürfen **ausschließlich fiktive Daten** verwendet werden.

## Manuelle Prüfung auf iPad Safari

Die Playwright-Tests laufen headless in Chromium. Die **endgültige manuelle
Prüfung muss auf einem realen iPad mit Safari** erfolgen:

1. Öffentliche URL (siehe unten) einmal **online** in Safari öffnen.
2. Alle acht Felder mit **fiktiven** Daten ausfüllen; prüfen, dass pro Feld
   `Wird gespeichert …` und nach ca. 2,5 s `✓ Gespeichert` erscheint.
3. Prüfen, dass unten `✓ Alles dauerhaft automatisch gespeichert` erscheint.
4. Safari-Tab schließen und erneut öffnen → Werte sind noch vorhanden.
5. iPad in den **Flugmodus** schalten und die Seite neu laden → App öffnet sich,
   Daten sind sichtbar; der Offline-Hinweis erscheint.
6. Offline einen Wert ändern, neu laden → Änderung bleibt erhalten.
7. Bedienbarkeit prüfen: alle Felder mit dem Finger bequem bedienbar, keine
   Funktion nur per Hover erreichbar, kein ungewolltes horizontales Scrollen,
   Bildschirmtastatur verdeckt keine wichtigen Bedienelemente.
8. Optional: über „Zum Home-Bildschirm“ als App installieren.

## Öffentliche Deployment-URL

> _Wird nach dem Vercel-Deployment hier eingetragen._
>
> Das Deployment auf Vercel benötigt eine einmalige Anmeldung (`vercel login`)
> bzw. ein Vercel-Zugriffstoken. Siehe Abschnitt „Deployment“.

## Deployment (Vercel)

```bash
npm i -g vercel      # oder: npx vercel
vercel               # Vorschau-Deployment (fragt bei Bedarf nach Login)
vercel --prod        # Produktions-Deployment
```

Nach erfolgreichem Deployment die ausgegebene HTTPS-URL oben unter
„Öffentliche Deployment-URL“ eintragen.

## Bekannte Einschränkungen

- Reiner **Client-Speicher**: Daten leben nur lokal im Browser; kein Backend,
  keine Geräte-Synchronisation, kein Mehrbenutzerbetrieb.
- Der Service Worker ist **nur im Produktions-Build** aktiv (im Dev-Modus
  bewusst deaktiviert).
- **WebKit auf diesem Windows-Host nicht startbar** („Host system is missing
  dependencies“). Das iPad-Projekt läuft daher lokal auf der **Chromium-Engine**
  mit iPad-Viewport + Touch. Auf macOS/Linux(-CI) kann stattdessen WebKit
  verwendet werden (`npx playwright install webkit`, Projekt-`browserName` auf
  `webkit` bzw. `devices["iPad (gen 7)"]`). Die endgültige Safari-Prüfung erfolgt
  manuell auf einem realen iPad.
- Ein echter **Apple Pencil** lässt sich nicht automatisiert testen; die
  Pointer-Events-Logik ist für `mouse`/`touch`/`pen` gemeinsam implementiert.
- Die Zeitfelder bearbeiten `HH:mm:ss` auf dem Kalendertag des Falls; ein über
  Mitternacht laufender Mehrtageseingriff ist in dieser Demo nicht modelliert.
- Medikament-/Infusionsnamen und Einheiten sind freie Benutzereingaben. Es gibt
  bewusst keine Arzneimitteldatenbank, Plausibilitätsprüfung oder medizinische
  Empfehlung.
- Das Kalender-Popup der Datumsfelder kann sich am unteren Feldrand minimal
  überlappen (funktional ohne Einschränkung).

## Nächster geplanter Entwicklungsschritt

Naheliegend sind ein **PDF-Export**, optional strukturierte Kataloge ohne
medizinische Vorschlagslogik und die reale Safari-/Apple-Pencil-Abnahme auf
Hardware. Die gemeinsame Skala und die persistierten fachlichen Werte sind
darauf vorbereitet.
