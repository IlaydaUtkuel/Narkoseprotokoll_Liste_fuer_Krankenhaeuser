# Agentischer Entwicklungsworkflow

Dieses Dokument beschreibt drei nachvollziehbare Entwicklungs- und Korrekturschleifen des Repositories. Grundlage sind die vorhandene Git-Historie, die aktuelle Implementierung, Tests und konkrete menschliche Rückmeldungen. Es werden keine erfundenen Agentengespräche oder externen Arbeitsschritte behauptet.

Agentisches Coding unterstützt Analyse, Implementierung und wiederholte Verifikation. Es ersetzt weder die menschliche Produktentscheidung noch die medizinische Bewertung, die reale Hardwareabnahme oder die Freigabe einer Auslieferung.

## Loop 1 – Basisdaten und Neue-OP-Sicherheit

### Ausgangsproblem

Basisdaten wurden lokal gespeichert, aber der Wechsel zu einer neuen OP musste verhindern, dass aktive oder noch nicht exportierte Dokumentation unbeabsichtigt verloren geht. Die Entwicklung ist in der Historie unter anderem durch `fa3e350`, `02f5fb8`, `46bf630` und `8ac91eb` nachvollziehbar.

### Anforderung

Basisdaten müssen korrigierbar bleiben, ohne laufende Falldaten zu überschreiben. `Neue OP` darf einen aktiven oder seit dem letzten Export geänderten Fall nicht still löschen. Ein abgebrochener Export muss alle Daten bewahren.

### Agentischer Umsetzungsschritt

Die vorhandenen Speicherpfade wurden getrennt betrachtet: sofortige Basisdaten-Persistence, Zustand des aktiven Falls, Exportrevision und der Übergang in einen neuen Fall. Daraus entstanden ein expliziter Basisdaten-Draft, ein OP-Workflow-State und die Unterscheidung zwischen `caseRevision` und `lastSuccessfullyExportedRevision`.

### Menschliche Prüfung

Die menschliche Rückmeldung verlangte ausdrücklich, dass nach dem Fallende `Speichern und Schließen` erscheint, dass der Benutzer den Zielweg wirklich auswählt und dass ein neuer Fall erst nach erfolgreichem Speichern mit leeren Basisdaten beginnt.

### Erkannte Schwachstelle

Eine direkte Änderung der Basisdaten oder ein sofortiger Reset hätte die aktive Dokumentation inkonsistent machen können. Außerdem durfte das Schließen eines Directory-Pickers nicht als erfolgreicher Export gelten.

### Korrektur

Basisdatenänderungen werden in einer Edit-Session als Draft gehalten und erst nach Bestätigung übernommen. `Neue OP` prüft den laufenden Fall und unexportierte Revisionen. Die aktive Fall- und Patientenspeicherung wird erst nach einem tatsächlich erfolgreichen Directory-, Share- oder Download-Weg archiviert und geleert. Picker-Abbruch und Exportfehler lassen den Fall unverändert.

### Automatisierte Verifikation

`tests/unit/patient-basis-edit.test.tsx`, `tests/unit/opWorkflow.test.ts`, `tests/unit/newOperationFlow.test.tsx`, `tests/unit/timeline/caseArchive.test.ts` und die Playwright-Abläufe in `e2e/op-safety-critical.spec.ts` sowie `e2e/vital-timeline.spec.ts` prüfen Draft, Revisionen, Exportabbruch, neue OP und leere Folgedaten. Der vormals zeitabhängige Modaltest wartet nun auf den sichtbaren aktiven Ant-Design-Dialog statt den DOM sofort abzufragen.

### Ergebnis

Der aktive Fall bleibt bis zum erfolgreichen Export erhalten. Ein neuer Fall beginnt kontrolliert mit leeren Basisdaten und ohne Reste der vorherigen kritischen UI-Einstellungen.

## Loop 2 – Kritische Vitalwertwarnungen

### Ausgangsproblem

Kritische Werte sollten visuell auffallen, ohne eine medizinische Entscheidung vorzutäuschen. Die Grundimplementierung ist im Commit `8ac91eb` sichtbar.

### Anforderung

Thresholds müssen konfigurierbar sein, Altersgruppen nachvollziehbar berücksichtigen und ausschließlich Hinweise aus vorhandenen Messungen ableiten. Der Export darf weder Thresholds noch abgeleitete Warnungen enthalten. Das Warnsymbol muss unter Zeitdruck gut erkennbar und per Tastatur zugänglich sein.

### Agentischer Umsetzungsschritt

Threshold-Modell, Altersberechnung, automatische Erwachsenenvorgaben und reine Warnableitung wurden getrennt. Die Einstellungen liegen fallbezogen in einem eigenen localStorage-Schlüssel. Das Fallmodell und der Export bleiben frei von diesem UI-Support-State.

### Menschliche Prüfung

Die visuelle Prüfung zeigte eine überlagernde zweite braune Tooltip-Fläche, ein schlecht erkennbares Ausrufezeichen und die fehlende sichtbare Altersnotiz. Gewünscht war die vorhandene kompakte graue Werteanzeige ohne konkurrierende Warnfläche.

### Erkannte Schwachstelle

Zwei gleichzeitig sichtbare Erklärflächen verdeckten Werte und Zeitlinien. Ein kleines Warnzeichen war unter Zeitdruck schwer zu erfassen. Ohne Altersnotiz war die Grundlage der automatisch gewählten Altersgruppe nicht transparent.

### Korrektur

Die konkurrierende braune Warnfläche wurde entfernt. Das Symbol verwendet jetzt ein deutliches Warnzeichen in einem kontrastreichen, fokussierbaren Ziel. Die vollständige Erklärung bleibt im zugänglichen Namen beziehungsweise im vorhandenen kompakten Wertehinweis. `Kritische Werte` zeigt das aus dem Geburtsdatum berechnete Alter als Information. Die 46×46-SVG-Fläche kompensiert Rundungsabweichungen der ViewBox und bleibt visuell zurückhaltend.

### Automatisierte Verifikation

`tests/unit/timeline/criticalValues.test.ts`, `tests/unit/timeline/criticalSettingsStorage.test.ts` und `e2e/op-safety-critical.spec.ts` prüfen Grenzableitung, Alterswechsel, getrennte Speicherung, Tooltip-Inhalt und exportfreie Thresholds. `e2e/accessibility.spec.ts` prüft Fokus, Mindestzielgröße und schwere axe-Verstöße.

### Ergebnis

Kritische Hinweise sind deutlich, textlich zugänglich und vom medizinischen Fall-Export getrennt. Sie bleiben ausdrücklich visuelle Orientierung und keine klinische Empfehlung.

## Loop 3 – Extra-Ereignis und Persistence-Migration

### Ausgangsproblem

Die festen OP-Ereignisse konnten unerwartete Situationen nicht mit freiem Kontext dokumentieren. Gleichzeitig durften neue Eventdaten ältere localStorage-Fälle nicht unlesbar machen.

### Anforderung

Ein gleich großes Werkzeug `Extra` soll an einem Zeitpunkt platziert, kommentiert, bearbeitet und gelöscht werden können. Der Kommentar soll am Marker über Hover und Fokus sichtbar sein, Reload überstehen und in den normalen Export gelangen. Ereigniswerkzeuge müssen im Bereich `Phasen und Ereignisse` bleiben und als Toggle funktionieren.

### Agentischer Umsetzungsschritt

`extra` wurde in die zentrale Ereignistyp-Liste und Definition aufgenommen. Das Eventmodell erhielt `comment`; Drawer, Marker, Tooltip und Persistenzparser wurden erweitert. Der Parser akzeptiert ältere Events ohne Kommentar und ergänzt einen leeren String. Das aktuelle Fallschema wurde auf Version 6 gehoben.

### Menschliche Prüfung

Die Rückmeldung bestätigte die Platzierung im Ereignisbereich, verlangte aber zusätzlich den frei erfassbaren Kommentar sowie Speichern- und Löschen-Aktionen. Eine weitere Prüfung meldete, dass ein optisch aktives Symbol beim Platzieren nicht zuverlässig als ausgewählt erkannt wurde.

### Erkannte Schwachstelle

Automatisches Deaktivieren nach der ersten Platzierung verhinderte mehrere gleichartige Ereignisse. Eine nicht eindeutig gekoppelte visuelle und interne Auswahl führte zu der Meldung, zuerst ein Symbol auszuwählen.

### Korrektur

Die Auswahl wird über einen einzigen `selectedEventType` geführt. Derselbe Button schaltet sie aus, ein anderer Button ersetzt sie, `Escape` beendet sie, und die Platzierung selbst lässt sie aktiv. `aria-pressed` spiegelt denselben State. Extra-Kommentare erscheinen per Hover und Fokus, sind editier- und löschbar und werden über Migration und Reload erhalten. Die Werkzeugleiste besitzt große Ziele und bleibt im linken Bereich ihrer Lane.

### Automatisierte Verifikation

`tests/unit/timeline/eventSelection.test.ts`, `tests/unit/timeline/events.test.ts`, `tests/unit/timeline/persistence.test.ts` und `e2e/vital-timeline.spec.ts` prüfen Toggle, Mehrfachplatzierung, Escape, Kommentar-CRUD, Migration und Reload. Die Desktop- und iPad-Viewport-Projekte prüfen Maus und Touch; `e2e/accessibility.spec.ts` ergänzt Tastatur, Fokus und Pen-Events.

### Ergebnis

`Extra` ist ein vollwertiger, migrationssicherer Ereignistyp. Auswahlzustand, visuelle Darstellung und zugänglicher Zustand stimmen überein; derselbe Ereignistyp kann kontrolliert mehrfach dokumentiert werden.

## Grenzen der agentischen Verifikation

Automatisierte Tests können DOM, Pointer-Events, Viewports, Persistenz und Exportpfade reproduzierbar prüfen. Sie können keine klinische Angemessenheit bestätigen, keine reale Safari-Rendering-Engine auf diesem Windows-Host ersetzen und weder Fingergefühl noch Apple-Pencil-Präzision auf physischer Hardware bewerten. Diese Freigaben bleiben menschliche Aufgaben.
