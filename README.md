# Sikant Narkoseprotokoll-Demo

Lokale Next.js-Anwendung zur Dokumentation eines ausschließlich **fiktiven** Narkosefalls: Basisdaten, eine gemeinsame SVG-Zeitachse für vier Vitalparameter, Therapien und Ereignisse sowie ein kontrollierter Fallabschluss mit echtem JSON-Export.

> **Kein Medizinprodukt.** Die Demo enthält keine Diagnose-, Therapie- oder Dosierungsempfehlung. Kritische Hinweise und Vollständigkeitsmeldungen werden ausschließlich aus den eingegebenen Daten und der vorhandenen Konfiguration abgeleitet. Es dürfen **keine realen Patientendaten** verwendet werden; alle Daten bleiben lokal im Browser.

## Voraussetzungen und lokaler Start

Node.js 20 oder neuer, npm, Chromium für die Playwright-Tests.

```bash
npm ci
npx playwright install chromium
npm run dev          # Entwicklung: http://localhost:3000
```

Produktionsstand (der Serwist-Service-Worker entsteht nur im webpack-Build, im Dev-Modus ist er deaktiviert):

```bash
npm run build
npm run start
```

## Zentrale Funktionen

- **Basisdaten** mit Datumsvalidierung, Sofort-Persistence und `Keine Allergien`-Umschalter.
- **Gemeinsame Zeitachse** für SpO₂, Herzfrequenz, NIBP und Temperatur sowie für Medikamente, Infusionen, Phasen und Ereignisse – alles auf derselben Zeitkoordinate.
- **Werte per Zeiger dokumentieren:** Ein Klick in ein Band erzeugt Zeit und Wert aus der Zeigerposition; bestehende Punkte lassen sich ziehen. NIBP besteht aus Mittelwert plus getrennt ziehbaren systolischen und diastolischen Griffen.
- **Kontrollzeit-Modus:** Ab `startedAt + 5 Minuten` markiert die Anwendung unvollständige Fünf-Minuten-Kontrollpunkte. Ein Klick auf das Warnsymbol fixiert die Zeitposition, sodass nur noch die Höhe den Wert bestimmt – ohne Formular.
- **Sechs Ereignistypen** (`Beginn Anästhesie`, `Schnitt`, `Naht`, `Ende Ausleitung`, `Patient aus dem Saal`, `Extra` mit Kommentar), mehrfach platzierbar, verschieb- und löschbar.
- **Kritische Hinweise** aus konfigurierbaren, altersabhängigen Schwellen – als sichtbare Orientierung, nicht als klinische Bewertung.
- **Leerer Fall** zeigt unterhalb der Grafik einen kurzen Hinweis auf den nächsten Schritt; er verschwindet mit dem ersten Eintrag.
- **Fiktiver Demofall** per Klick, dauerhaft als `FIKTIVER DEMOFALL` gekennzeichnet.
- **Kontrollierter Abschluss** mit Vollständigkeitsprüfung und echtem Dateiexport.

## Architekturüberblick

Clientseitige Next.js-Anwendung mit React und TypeScript. Ant Design liefert Formulare, Dialoge und Drawer; die interaktive Zeitachse ist eine eigene SVG-Oberfläche.

- `/` erfasst und validiert die Basisdaten.
- `/dokumentation` enthält die gemeinsame Zeitachse.
- `/abschluss` zeigt nach dem Fallende eine schreibgeschützte Kontrolle, die Vollständigkeitsprüfung und den Export.

Die fachliche Logik für Koordinaten, Skalen, Warnungen, Vollständigkeit und Persistence liegt getrennt von der Darstellung in `lib/` und ist dadurch unit-testbar. Es gibt kein Backend, kein Benutzerkonto und keine Synchronisation.

## Datenmodell

Ein Fall besteht aus **Basisdaten** (Patient/-in, Geburtsdatum, Eingriff, OP-Datum, Gewicht und Einheit, ASA, Mallampati, Allergien), **Fallstatus** (Fall-ID, `startedAt`, optionales `endedAt`, Schema-, Fall- und Exportrevision), **Vitalmessungen**, **Therapien** und **Ereignissen**.

SpO₂, Herzfrequenz und Temperatur sind Einzelwerte mit Zeitpunkt. Eine NIBP-Messung fasst systolisch, Mittelwert und diastolisch zu **einem** Datensatz mit gemeinsamem Zeitpunkt zusammen. Therapien tragen Bezeichnung, Beginn, Dosis oder Menge, strukturierte Einheit, Anwendungsart und entweder ein Ende oder den Status `ongoing`.

Kritische Warnungen, Fünf-Minuten-Hinweise und Vollständigkeitsergebnisse werden **nicht** gespeichert, sondern bei jeder Anzeige neu aus den Falldaten berechnet.

## Zuordnung von Pointer-Koordinaten

Pointer-Ereignisse liefern Fensterkoordinaten. Diese werden zunächst in das lokale SVG-Koordinatensystem überführt, damit Scrollposition und responsive Größe berücksichtigt werden. Die X-Koordinate wird proportional auf den sichtbaren Zeitbereich abgebildet (linker Rand = Beginn, rechter Rand = Ende), die Y-Koordinate über die aktive Y-Skala des jeweiligen Bandes in einen Messwert zurückgerechnet – parameterspezifisch, da jedes Band eine eigene, aus den vorhandenen Daten abgeleitete Skala besitzt. Ergebnisse werden auf die Genauigkeit des Parameters gerundet; Positionen außerhalb der Zeichenfläche werden begrenzt oder verworfen.

Bei NIBP behalten alle drei Werte denselben Zeitpunkt, auch wenn systolischer und diastolischer Griff einzeln gezogen werden. Unit-Tests prüfen die Umrechnung für verschiedene Positionen und Größen; die Demo-Tests vergleichen zusätzlich die angezeigte Koordinate mit dem tatsächlich gespeicherten Wert.

## Persistence und Export

Basisdaten und Falldokumentation werden sofort nach jeder abgeschlossenen Änderung in `localStorage` geschrieben; die 600-ms-Verzögerung betrifft nur den sichtbaren Wechsel zu `✓ Gespeichert`. Die aktuelle Fall-Schema-Version ist **6**; ältere Stände ab Version 1 werden beim Laden migriert. Beschädigtes JSON wird nicht still überschrieben.

Nach dem Fallende zeigt `/abschluss` Basisdaten, eine schreibgeschützte Timeline-Vorschau und die Vollständigkeitsprüfung, danach Dateiauswahl und letzte Bestätigung. Je nach Browser wird die JSON-Datei über die File System Access API in einen gewählten Ordner geschrieben, über Web Share angeboten oder als Download bereitgestellt. Erst ein tatsächlich erfolgreicher Schreibweg archiviert und schließt den Fall; ein Abbruch verändert nichts. Kritische Schwellen sind bewusst **nicht** Teil des Exports.

## Tests und verifizierter Endstand

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

`npm run test:e2e` startet den zuvor gebauten Produktionsstand auf Port 3100 und führt zwei Projekte aus: `chromium` (Desktop, 1280 × 800) und `ipad-viewport` (810 × 1080 mit Touch). Einzeln über `npx playwright test --project=<name>`.

Verifiziert am 05.08.2026 auf dem finalen Commit:

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | bestanden |
| `npm run lint` | bestanden |
| `npm run test` | 297 Tests in 53 Dateien bestanden |
| `npm run build` | bestanden |
| `npx playwright test --project=chromium` | 83/83 |
| `npx playwright test --project=ipad-viewport` | 83/83 |
| `npm run test:e2e` | 166/166 |
| `npm run test:e2e:demo-videos` | 3/3 |
| `npm run test:e2e:demo-video` | 1/1 |

Das iPad-Projekt läuft auf diesem Windows-Host mit Chromium und ersetzt keine Prüfung mit WebKit oder auf echter Hardware.

## Playwright-Demo-Videos

Alle Aufnahmen stammen aus erfolgreichen Testläufen, zeigen einen sichtbaren Mauszeiger und wurden anhand gerenderter Einzelbilder visuell geprüft. Vitalwerte werden darin nie eingetippt, sondern ausschließlich aus der Zeigerposition erzeugt.

| Video | Ablauf | Befehl | Status |
| --- | --- | --- | --- |
| `docs/videos/00-gesamtablauf.webm` | Gesamter Ablauf von den Basisdaten bis zur Kontrollseite (2:15 min) | `npm run test:e2e:demo-video` | bestanden |
| `docs/videos/01-basisdaten-vitalwerte-persistence.webm` | Basisdaten, Start, Temperatur und NIBP per Klick, Griffe ziehen, Kontrollzeit-Modus, Persistence nach Reload (0:54 min) | `npm run test:e2e:demo:basisdaten` | bestanden |
| `docs/videos/02-therapien-ereignisse-bearbeiten.webm` | Medikament, Infusion und Ereignis anlegen, bearbeiten, auf der Zeitachse verschieben, löschen, Therapie-Tooltips (0:29 min) | `npm run test:e2e:demo:therapien` | bestanden |
| `docs/videos/03-abschluss-kontrolle-export.webm` | Kritischer Wert mit Hinweis, Korrektur per Ziehen, Fall beenden, Kontrollseite, Export mit Prüfung der JSON-Datei (0:34 min) | `npm run test:e2e:demo:abschluss` | bestanden |

`npm run test:e2e:demo-videos` erzeugt die drei kurzen Aufnahmen nacheinander. Die zugehörigen Tests liegen in `e2e-demo/` und laufen über `playwright.demo.config.ts`, getrennt von der Standard-Suite.

Im Abschluss-Video wird ausschließlich der native Ordnerdialog (`window.showDirectoryPicker`) gemockt; beide Schaltflächen werden sichtbar geklickt, und Validierung, Exporterzeugung sowie Dateiname und JSON-Inhalt werden real geprüft.

## Agentische Entwicklung

Drei repräsentative Schleifen; die vollständige Dokumentation aller sechs steht in [docs/agentic-workflow.md](docs/agentic-workflow.md).

**1. Vitalwerteingabe über Zeigerkoordinaten**
*Ziel:* Werte sollen aus der Grafikposition entstehen, nicht aus Formulareingaben.
*Aufgabe:* Einen Demoablauf bauen, der jeden Wert per Klick oder Ziehen erzeugt und ihn trotzdem exakt prüft.
*Ergebnis:* Der Test kalibriert die Y-Achse über zwei Messfahrten, liest die Koordinatenanzeige der Anwendung und behauptet, dass der gespeicherte Wert dem angezeigten entspricht.
*Menschliches Review:* Rückmeldung, dass Zahlen nicht eingetippt werden dürfen und der Zeiger sichtbar sein muss.
*Verworfen:* Das Setzen der Werte über `fill()` in die Formularfelder – es hätte eine Bedienung gezeigt, die es so nicht gibt.

**2. iPad-Interaktionen und ein instabiler Ablauf**
*Ziel:* Die Standard-Suite soll vollständig und reproduzierbar grün sein.
*Aufgabe:* Den nur im Gesamtlauf fehlschlagenden Test `iPad R5 Story 10` stabilisieren, ohne die Aussage zu verändern.
*Ergebnis:* Die Höhe des ersten Dropdown-Eintrags wird nach einer Sichtbarkeits- und Bedienbarkeitsprüfung zustandsbasiert über `expect.poll` gemessen; 166/166 Tests bestehen.
*Menschliches Review:* Ausdrückliche Forderung nach einer echten Korrektur statt eines Vermerks „bekannt flakig“.
*Verworfen:* Überspringen, Absenken des 24-px-Grenzwerts, feste Wartezeiten und höhere Retries – alle hätten das Symptom verdeckt.

**3. Leerer Fall**
*Ziel:* Ein Fall ohne jeden Eintrag soll den nächsten Schritt benennen.
*Aufgabe:* Einen knappen Hinweis ergänzen, der mit dem ersten Eintrag verschwindet und nach einem Reload nicht zurückkehrt.
*Ergebnis:* Hinweis unterhalb der Grafik, abgeleitet aus dem Fall-Store, in beiden Playwright-Projekten geprüft.
*Menschliches Review:* Vorgabe, die Zeitachse sichtbar zu lassen und kein Onboarding einzubauen.
*Verworfen:* Die Platzierung oberhalb der Grafik – ihr Erscheinen hätte die Bänder vertikal verschoben.

## Manuelle iPad-Prüfung

Die folgenden Abläufe wurden von der Auftraggeberin manuell auf einem physischen iPad geprüft:

- Vitalwerte hinzufügen und verschieben
- systolischen und diastolischen NIBP-Wert ziehen
- Medikamente hinzufügen
- Infusionen hinzufügen
- Drawer-Verhalten ohne unerwünschtes Seitenscrollen
- Scrollverhalten bei Finger- und Pencil-Interaktionen
- Ereignisse hinzufügen und korrigieren
- Persistence nach einem Reload
- Export- beziehungsweise Files-Ablauf

Gerätemodell, iPadOS- und Browserversion sowie das Apple-Pencil-Modell sind nicht dokumentiert; über eine bestimmte Browser-Engine wird daher keine Aussage getroffen. Die restlichen Zeilen der Prüfliste stehen in [docs/ipad-acceptance-test.md](docs/ipad-acceptance-test.md).

## Bewusst nicht umgesetzt und bekannte Grenzen

Nicht Teil der Demo sind Backend und Datenbank, Anmeldung und Mehrbenutzerbetrieb, Gerätesynchronisation, Anbindung an Patientenmonitore, eine Arzneimitteldatenbank, Abrechnung oder KIS-Anbindung, automatische Diagnose-, Behandlungs- und Dosierungsempfehlungen, medizinische Plausibilitätsentscheidungen, ein zertifizierter Medizinprodukt-Workflow sowie ein eigener Workflow für mehrtägige Eingriffe.

Bekannte Grenzen:

- Keine Synchronisation; Daten bleiben an Browser, Gerät und Origin gebunden.
- Offline-Betrieb erst nach einem Produktionsaufruf mit aktivem Service Worker.
- Das iPad-Playwright-Projekt nutzt Chromium; WebKit lässt sich auf dem verwendeten Windows-Host nicht starten.
- Der Files-/Freigabe-Ablauf auf iPadOS hängt vom Betriebssystem und der gewählten Aktion ab.
- Screenreader-, vollständige Kontrast- und die restliche iPad-Prüfliste sind offen.
- Zeitfelder beziehen sich auf den lokalen Kalendertag des Falls.
- Automatisierte Prüfungen ersetzen keine medizinische Bewertung.

Barrierefreiheit ist über große Trefferflächen, `aria-pressed`, sichtbare Fokuszustände, Tastaturbedienung wichtiger SVG-Ziele und `@axe-core/playwright` abgedeckt.

## Deployment

Produktions-URL: **https://sikant.vercel.app**

Die Bereitstellung erfolgt über die Vercel-Git-Integration des Branches `main`. Für den finalen Commit wurde am 05.08.2026 geprüft, dass das zugehörige Production-Deployment den Status `Ready` besitzt, denselben Commit trägt und die URL mit HTTP 200 die Anwendung ausliefert.

## Weiterführende Dokumente

- [docs/agentic-workflow.md](docs/agentic-workflow.md) – alle sechs Entwicklungs- und Korrekturschleifen
- [docs/delivery-checklist.md](docs/delivery-checklist.md) – Lieferstatus, Verifikation und offene Punkte
- [docs/ipad-acceptance-test.md](docs/ipad-acceptance-test.md) – Prüfliste für die manuelle iPad-Abnahme
