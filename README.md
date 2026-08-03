# Sikant Narkoseprotokoll-Demo

Lokale Next.js-Anwendung zur Dokumentation eines ausschließlich **fiktiven** Narkosefalls. Die Anwendung verbindet Basisdaten, eine gemeinsame SVG-Zeitachse für vier Vitalparameter, Therapien und Ereignisse sowie einen kontrollierten Fallabschluss mit echtem JSON-Dateiexport.

> **Wichtiger Hinweis:** Diese Demo ist kein Medizinprodukt und enthält keine Diagnose-, Therapie- oder Dosierungsempfehlung. Kritische Hinweise und Vollständigkeitsmeldungen werden ausschließlich aus den eingegebenen Daten und der vorhandenen Konfiguration abgeleitet. Für die Demo dürfen keine realen Patientendaten verwendet werden.

## Voraussetzungen

- Node.js 20 oder neuer
- npm
- Chromium für die automatisierten Playwright-Tests

## Installation

```bash
npm ci
npx playwright install chromium
```

## Lokaler Start

Entwicklung:

```bash
npm run dev
```

Danach ist die Anwendung unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Build

```bash
npm run build
npm run start
```

Der Build verwendet bewusst webpack, weil der Serwist-Service-Worker damit erzeugt wird. Der Service Worker ist im Entwicklungsmodus deaktiviert.

## Tests

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

`npm run test:e2e` startet den zuvor gebauten Produktionsstand auf Port 3100. Die Standardkonfiguration enthält ein Desktop-Projekt mit Chromium bei 1280×800 und ein iPad-nahes Chromium-Projekt bei 810×1080 mit Touch. Erfolgreiche Standardtests erzeugen keine Video-Artefaktflut; Videos werden nur bei Fehlern behalten.

Die letzte vollständige Verifikation umfasst **222 Vitest-Tests in 39 Dateien** und **94 Playwright-Läufe in zwei Projekten**. Die Zahlen müssen nach Änderungen aus den tatsächlichen Ausgaben von `npm run test` und `npx playwright test --list` aktualisiert werden.

## Bedienung

1. Auf `/` werden die Basisdaten eingegeben oder der eindeutig markierte fiktive Demofall geladen.
2. `Okay und Weiter` öffnet `/dokumentation`.
3. `Start` setzt die unveränderliche Startzeit des Falls.
4. Werte werden direkt in den vier Vitalbändern dokumentiert. Medikamente, Infusionen und Flüssigkeiten werden durch Auswahl eines Zeitpunkts in ihrer jeweiligen Lane angelegt.
5. Ereignissymbole werden in `Phasen und Ereignisse` gewählt und anschließend auf derselben Zeitachse platziert. Ein erneuter Klick auf das aktive Symbol oder `Escape` beendet die Auswahl; nach einer Platzierung bleibt das Werkzeug für weitere gleichartige Ereignisse aktiv.
6. `Eingriff beenden` speichert `endedAt`. Danach führt `Speichern und Schließen` zur schreibgeschützten Kontrolle und zum Dateiexport.

Die sechs Ereignistypen sind `Beginn Anästhesie`, `Schnitt`, `Naht`, `Ende Ausleitung`, `Patient aus dem Saal` und `Extra`. Derselbe Typ kann mehrfach platziert werden. `Extra` besitzt zusätzlich einen frei bearbeitbaren Kommentar und kann wie andere Ereignisse verschoben, bearbeitet und gelöscht werden.

## Vital-Timeline

Alle Therapie-Lanes und Vitalbänder liegen in einem gemeinsamen SVG und verwenden dieselbe Zeitkoordinate. SpO₂ wird als Step-Linie dargestellt, Herzfrequenz und Temperatur als Linienverlauf. NIBP besteht aus Mittelwertpunkt sowie getrennt editierbaren systolischen und diastolischen Griffen; `mmHg` wird als feste Einheit gezeigt und nicht an jedem Wert wiederholt.

Jedes Vitalband berechnet seine Y-Skala aus den im sichtbaren Zeitbereich vorhandenen Werten. NIBP berücksichtigt Systole, Mittelwert und Diastole gemeinsam. Endliche negative, kleine oder große Zahlen werden nicht durch medizinische Hardlimits abgeschnitten. Ein visueller Rand verhindert, dass Einzel- oder Extremwerte am Bandrand kleben.

Die relativen Fünf-Minuten-Kontrollpunkte beginnen bei `startedAt + 5 Minuten`. Fehlt an einem abgeschlossenen Kontrollpunkt mindestens eines der vier Vitalbänder oder ist ein NIBP-Datensatz unvollständig, erscheinen eine rote Linie und ein zugänglicher Warnbutton. Diese Hinweise sind abgeleiteter UI-Zustand und werden nicht persistiert.

## Desktop- und iPad-Unterstützung

Das Layout vermeidet horizontalen Seiten-Overflow und ist für Desktop 1280×800 sowie den automatisierten iPad-nahen Viewport 810×1080 geprüft. Der iPad-Viewport-Test läuft auf diesem Windows-System mit Chromium. Er ist **kein** Ersatz für Safari, iPadOS oder ein physisches Gerät.

Die noch ausstehende reale Hardwareabnahme ist in [docs/ipad-acceptance-test.md](docs/ipad-acceptance-test.md) vorbereitet.

## Pointer-, Touch- und Pen-Unterstützung

Die Anwendung verwendet bereits Pointer Events für Maus, Finger und Stift: `pointerdown`, `pointermove`, `pointerup`, `pointercancel` und bei Drag-Interaktionen Pointer Capture. Kurze Gesten werden als Tap, größere Bewegungen als Drag oder vertikales Scrollen ausgewertet. Ereigniswerkzeuge sowie kleine Warn- und Ereignismarker besitzen mindestens 44×44 CSS-Pixel große Interaktionsflächen; sichtbare Symbole dürfen kleiner bleiben. Tastaturziele unterstützen Fokus, Enter und Space, Toggle-Werkzeuge zusätzlich `aria-pressed` und `Escape`.

Ein echter Apple Pencil kann in dieser Umgebung nicht automatisiert geprüft werden. Der `pen`-Pfad ist durch Unit- und Browser-Events abgedeckt, die physische Prüfung bleibt dennoch erforderlich.

## Datenhaltung und Persistence

Basisdaten und Falldokumentation werden sofort nach einer abgeschlossenen Änderung in `localStorage` geschrieben. Die 600-ms-Verzögerung betrifft nur den sichtbaren Wechsel von `Wird gespeichert …` zu `✓ Gespeichert`; sie verzögert nicht das Schreiben. Daten bleiben auf denselben Browser, dasselbe Gerät und dieselbe Origin beschränkt. Es gibt kein Backend und keine Synchronisation.

Die aktuelle Fall-Schema-Version ist **6**. Der Parser akzeptiert Version 1 bis 5 und überführt sie in Version 6:

- Version 1 bewahrt Startzeit und Messungen; damals nicht vorhandene Therapien und Ereignisse werden als leere Listen ergänzt.
- Version 2 bewahrt vollständige NIBP-Dreierwerte.
- Version 3 unterstützt vorübergehend offene systolische und diastolische NIBP-Werte.
- Version 4 erhält sichere Defaults für Fallrevision und Exportrevision.
- Version 5 erhält vorhandene Ereignisse, ergänzt fehlende Kommentare leer und bewahrt `Extra`-Kommentare.
- Ältere Therapieeinheiten werden in die aktuelle strukturierte Einheit überführt.

Beschädigtes JSON wird nicht still überschrieben und bringt die Anwendung nicht zum Absturz. Start, Ende, Messungen, Therapien, Ereignisse und Revisionen werden nach Reload wiederhergestellt. Kritische Threshold-Einstellungen liegen getrennt pro Fall und sind ausdrücklich **nicht** Teil des Fall-Exports. Vollständigkeits- und Warnresultate werden nicht gespeichert, sondern bei jeder Anzeige neu aus den Falldaten berechnet.

## Export

Nach dem Fallende zeigt `/abschluss` zuerst Basisdaten, eine schreibgeschützte echte Timeline-Vorschau und die `Vollständigkeitsprüfung`. Erst danach folgt die Dateiauswahl und die letzte Bestätigung.

- Unterstützt der Browser `window.showDirectoryPicker`, öffnet `Ordner auswählen` den echten Systemdialog und schreibt die JSON-Datei über die File System Access API in den gewählten Ordner.
- Unterstützt ein Gerät Dateifreigabe über `navigator.canShare({ files })`, wird die reale JSON-Datei über Web Share angeboten, beispielsweise für `In Dateien sichern` auf iPadOS.
- Andernfalls wird eine reale JSON-Datei als Download bereitgestellt.

Abbruch oder Schreibfehler erzeugen keine Erfolgsmeldung, archivieren den Fall nicht und löschen keine aktiven Daten. Erst ein erfolgreich gestarteter Datei- oder Freigabeweg aktualisiert die Exportrevision, archiviert und schließt den Fall. Der Export enthält Schema-Version, Basisdaten, Fall-ID, Start/Ende, Messungen einschließlich NIBP, Therapien, Ereignisse und Archivierungszeit.

## Fiktiver Demofall

`Fiktiven Demofall laden` erzeugt mit einem Klick einen ausschließlich fiktiven, beendeten Fall im normalen Schema. Er enthält fiktive Basisdaten, mehrere Vitalsets, vollständige NIBP-Dreierwerte, Bolus und kontinuierliche Gabe, eine Infusion, mehrere Ereignisse, einen kommentierten `Extra`-Eintrag, kritische Beispielwerte sowie kontrolliert offene Dokumentationshinweise. Im Kopf bleibt dauerhaft sichtbar:

```text
FIKTIVER DEMOFALL – Keine realen Patientendaten
```

Existieren bereits lokale Angaben oder eine aktive Dokumentation, verlangt das Laden vorher eine ausdrückliche Bestätigung. Reload, Export und `Neuen Fall starten` verwenden dieselben produktiven Persistence- und Sicherheitswege wie ein normaler Fall; das Exportschema erhält kein Demo-Sonderfeld.

## Vollständigkeitsprüfung

Die zentrale Prüfung ist eine reine, testbare Auswertung vorhandener Daten. Sie kontrolliert:

- formale Basisdaten nach den vorhandenen Datumsregeln,
- Start- und Endstatus,
- abgeleitete offene Fünf-Minuten-Vitalcheckpoint-Hinweise,
- nicht beendete kontinuierliche Medikamentengaben und Infusionen,
- tatsächlich unvollständige Therapieeinheiten,
- optional ausdrücklich konfigurierte Pflicht-Ereignisse.

Standardmäßig ist kein medizinisches Ereignis verpflichtend. Hinweise sind keine klinische Bewertung und keine Empfehlung. Bei offenen Punkten kann zur passenden Seite zurückgekehrt oder nach bewusster Kenntnisnahme mit dem Export fortgefahren werden.

## Kritische Vitalwertwarnungen

Kritische Hinweise werden aus benutzerseitig konfigurierbaren Thresholds und vorhandenen Messungen abgeleitet. Automatische Erwachsenenvorgaben sind eine visuelle Orientierung, keine medizinische Entscheidung. Die Oberfläche zeigt die aus dem Geburtsdatum berechnete Altersnotiz. Das Warnsymbol besitzt einen klaren zugänglichen Namen und eine sichtbare Fokusmarkierung; die Erklärung ist nicht nur durch Farbe codiert. Die Thresholds und abgeleiteten Warnungen werden nicht in den Fall-Export geschrieben.

## Barrierefreiheit

- Ereignis-, Warn- und zentrale Timeline-Ziele besitzen große Hitflächen.
- Toggle-Zustände verwenden `aria-pressed` und eine zusätzliche sichtbare Markierung.
- Fokuszustände sind sichtbar; wichtige SVG-Ziele sind per Tastatur erreichbar.
- Warnungen besitzen Text und zugängliche Namen statt reiner Farbcodierung.
- `@axe-core/playwright` prüft Basisdaten, Dokumentation und Abschluss auf schwere und kritische WCAG-Verstöße.
- Extra-Kommentare sind per Hover und Fokus erreichbar.

Axe ersetzt keine Prüfung mit Screenreader, realer Tastatur, Safari, Touch oder Apple Pencil. Diese Punkte bleiben Teil der manuellen Abnahme.

## Agentic Development Workflow

Die verifizierbaren Entwicklungs- und Korrekturschleifen sind in [docs/agentic-workflow.md](docs/agentic-workflow.md) dokumentiert. Agentische Unterstützung ersetzt dort ausdrücklich nicht die menschliche Produkt- und Sicherheitsprüfung.

## Bekannte Einschränkungen

- Kein Backend, keine Geräte- oder Benutzersynchronisation und kein Mehrbenutzerbetrieb.
- Die Offline-Funktion steht erst nach einem erfolgreichen Produktionsaufruf mit Service Worker zur Verfügung.
- Playwrights iPad-Projekt nutzt Chromium und emuliert weder Mobile Safari noch einen echten Apple Pencil.
- Die Dateifreigabe auf iPadOS hängt von Safari, iPadOS und der vom Benutzer gewählten Files-/Share-Aktion ab.
- Physische iPad-, Apple-Pencil-, Screenreader- und vollständige manuelle Kontrastprüfung sind noch offen.
- Zeitfelder beziehen sich auf den lokalen Kalendertag des Falls; ein mehrtägiger Eingriff über Mitternacht ist nicht als eigener Workflow modelliert.
- Die Anwendung besitzt keine Arzneimitteldatenbank und führt keine medizinische Plausibilitätsprüfung durch.

## Deployment

Eine öffentliche Bereitstellung wurde für diese Abgabe noch nicht eingerichtet. Die Anwendung kann mit den oben beschriebenen Befehlen lokal gestartet werden. Im Repository wurden weder eine Vercel-Projektverknüpfung noch eine Deployment-URL oder ein Deployment-Workflow gefunden; Vercel CLI war in der geprüften Umgebung nicht verfügbar. Ohne ausdrückliche Freigabe wird kein externes Projekt erstellt und kein Production-Deployment ausgelöst.

Der überprüfbare Lieferstatus und die noch manuellen Schritte stehen in [docs/delivery-checklist.md](docs/delivery-checklist.md).
