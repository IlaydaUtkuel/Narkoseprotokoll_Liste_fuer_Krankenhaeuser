# Narkoseprotokoll Demo – Basisdaten des Narkosefalls

Kleine, aber vollständig funktionierende Webanwendung zur Erfassung der
**Basisdaten eines fiktiven Narkosefalls**. Diese erste Entwicklungsstufe
umfasst ausschließlich das Basisdaten-Formular mit automatischem lokalem
Speichern und Offline-Fähigkeit. Es gibt noch **keine** Vitalwertkurve,
Medikamente, Infusionen oder Ereignisse.

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
- **`localStorage`** für die acht kleinen Formulardaten (kein Backend, keine Datenbank)
- **Serwist** (`@serwist/next`) für Service Worker / PWA
- **Vitest** + **Testing Library** (Unit-Tests)
- **Playwright** (End-to-End-Tests, Chromium)
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
npm run test        # Unit-Tests (Vitest)
npm run build       # Produktions-Build (inkl. TypeScript-Prüfung + Service Worker)
npm run test:e2e    # End-to-End-Tests (Playwright, Chromium)
```

Für `npm run test:e2e` muss zuvor `npm run build` gelaufen sein – Playwright
startet den Produktionsserver (Port 3100) mit `npm run start`.

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

## Wichtige Hinweise zur Speicherung

- Die Speicherung gilt **nur** für **denselben Browser, dasselbe Gerät und
  dieselbe Domain**. Es werden **keine** Daten an einen Server oder an andere
  Geräte übertragen.
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
- Automatisierte Tests laufen in **Chromium**; Safari/WebKit wird manuell auf dem
  iPad geprüft.
- Es gibt in dieser Stufe bewusst noch **keine** Vitalwerte, Medikamente,
  Infusionen, Ereignisse, Backend, Login o. Ä.

## Nächster geplanter Entwicklungsschritt

**Interaktive Vitalwertkurve mit Pointer Events** (Maus, Finger, Apple Pencil):
`pointerdown`, `pointermove`, `pointerup`, `pointercancel`. Die aktuelle
Architektur (getrennte Komponenten, Styles und Event-Handling, keine Abhängigkeit
von reinen Mouse-Events) ist bereits darauf vorbereitet.
