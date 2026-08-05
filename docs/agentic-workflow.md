# Agentischer Entwicklungsworkflow

Dieses Dokument beschreibt sechs nachvollziehbare Entwicklungs- und Korrekturschleifen des Repositories. Grundlage sind die vorhandene Git-Historie, die aktuelle Implementierung, Tests und konkrete menschliche Rückmeldungen. Es werden keine erfundenen Agentengespräche oder externen Arbeitsschritte behauptet.

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

### Verworfen

Verworfen wurde das direkte Durchschreiben jeder Basisdatenänderung in den laufenden Fall. Es hätte eine bereits begonnene Dokumentation ohne Rückfrage einem anderen Patientenkontext zugeordnet; an seine Stelle trat die bestätigungspflichtige Edit-Session.

Ebenfalls verworfen wurde, das bloße Öffnen des Directory-Pickers als Exporterfolg zu werten. Ein abgebrochener Picker hätte damit den aktiven Fall archiviert und gelöscht. Stattdessen aktualisiert erst ein tatsächlich geschriebener Datei- oder Freigabeweg `lastSuccessfullyExportedRevision`.

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

### Verworfen

Verworfen wurde die zusätzliche braune Warn-Tooltipfläche neben der bereits vorhandenen kompakten grauen Werteanzeige. Zwei konkurrierende Erklärflächen verdeckten Messwerte und Zeitlinien; die Erklärung liegt seither im zugänglichen Namen, im `title` des Warnbuttons und im vorhandenen Wertehinweis.

Verworfen wurde außerdem, die Thresholds in das Fallmodell und damit in den Export aufzunehmen. Sie sind UI-Konfiguration und keine dokumentierte Messung; sie liegen in einem eigenen, fallbezogenen localStorage-Schlüssel.

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

### Verworfen

Verworfen wurde das automatische Abwählen des Ereigniswerkzeugs nach jeder Platzierung. Mehrere gleichartige Ereignisse hätten damit jeweils eine erneute Auswahl erfordert; das Werkzeug bleibt jetzt bis zum bewussten Abwählen oder `Escape` aktiv.

Verworfen wurde ebenso ein zweiter, nur visueller Auswahlzustand neben dem internen State. Er war die Ursache der Meldung „Bitte zuerst links ein Ereignissymbol auswählen“ trotz optisch aktiver Schaltfläche; Darstellung, `aria-pressed` und Platzierungslogik lesen seither denselben `selectedEventType`.

### Korrektur

Die Auswahl wird über einen einzigen `selectedEventType` geführt. Derselbe Button schaltet sie aus, ein anderer Button ersetzt sie, `Escape` beendet sie, und die Platzierung selbst lässt sie aktiv. `aria-pressed` spiegelt denselben State. Extra-Kommentare erscheinen per Hover und Fokus, sind editier- und löschbar und werden über Migration und Reload erhalten. Die Werkzeugleiste besitzt große Ziele und bleibt im linken Bereich ihrer Lane.

### Automatisierte Verifikation

`tests/unit/timeline/eventSelection.test.ts`, `tests/unit/timeline/caseStore.test.ts`, `tests/unit/timeline/persistence.test.ts` und `e2e/vital-timeline.spec.ts` prüfen Toggle, Mehrfachplatzierung, Escape, Kommentar-CRUD, Migration und Reload. Die Desktop- und iPad-Viewport-Projekte prüfen Maus und Touch; `e2e/accessibility.spec.ts` ergänzt Tastatur, Fokus und Pen-Events.

### Ergebnis

`Extra` ist ein vollwertiger, migrationssicherer Ereignistyp. Auswahlzustand, visuelle Darstellung und zugänglicher Zustand stimmen überein; derselbe Ereignistyp kann kontrolliert mehrfach dokumentiert werden.

## Loop 4 – Playwright-Demoablauf und Videoaufzeichnung

### Ausgangsproblem

Für die Abgabe fehlte eine durchgehende, reproduzierbare Aufzeichnung des Hauptablaufs. Ein erster Durchlauf erzeugte zwar ein Video, dokumentierte die Vitalwerte aber, indem der Test die Zahlen direkt in die Formularfelder tippte. Das zeigte die eigentliche Bedienung der Zeitachse gerade nicht.

### Anforderung

Ein einzelner Test soll den kompletten Ablauf von den Basisdaten bis zur Kontrollseite zeigen, dabei jeden Vitalwert ausschließlich über die Grafik erzeugen, den Mauszeiger sichtbar machen und trotzdem mit echten Assertions arbeiten. Die Uhr muss fixiert sein, damit die Zeitachse in jedem Lauf bei 10:00:00 beginnt.

### Agentischer Umsetzungsschritt

Der Test liest die Koordinatenanzeige der Anwendung (`crosshair-coordinate`) als Quelle der Wahrheit: Zwei Messfahrten im Band ergeben die Zuordnung von Bildschirmhöhe zu Wert, danach wird die Zielhöhe angefahren und genau der dort angezeigte Wert angeklickt. Gespeicherter Wert und angezeigter Wert werden gegeneinander geprüft. Die Uhr wird über `page.clock.install` gesetzt und mit `pauseAt`/`resume` weitergeschaltet. Ein per `addInitScript` eingefügtes Overlay macht den Zeiger im Video sichtbar.

### Menschliche Prüfung

Die Rückmeldung verlangte ausdrücklich, dass Werte nicht getippt, sondern geklickt und gezogen werden, dass der Zeiger deutlich sichtbar ist, dass Systolisch und Diastolisch gezogen werden, dass der Kontrollzeit-Modus einschließlich Aus- und Wiedereinschalten vorkommt, dass die Medikamenteninformation in den übrigen Bändern erscheint und dass am Ende die Kontrollseite langsam durchgescrollt wird.

### Erkannte Schwachstelle

Drei reproduzierbare Fehlerbilder traten im Testlauf auf. Eine zu kurze Ziehbewegung am NIBP-Griff wurde von der Anwendung korrekt als Tippen gewertet und öffnete das Bearbeitungsformular; dadurch blieb das Fadenkreuz stehen und wirkte eingefroren, weil die Anwendung bei geöffnetem Drawer bewusst keine Hover-Koordinate mehr aktualisiert. Im Kontrollzeit-Modus schlug die Kalibrierung über Hover fehl, weil die Koordinate dort nur bei gedrücktem Zeiger erscheint. Zusätzlich lieferte die Intervall-Linie einer Infusion `toBeVisible() === false`, da eine SVG-Linie ohne Höhe keine Trefferfläche besitzt.

### Verworfen

Verworfen wurde der ursprüngliche Testansatz, Vitalwerte über `fill()` in die Formularfelder zu schreiben. Er hätte im Video eine Bedienung gezeigt, die es so nicht gibt; die Werte entstehen jetzt aus der Zeigerposition, und der Test behauptet nur noch, dass der gespeicherte Wert dem angezeigten entspricht.

Verworfen wurde die einfache Ziehbewegung „von der Startposition direkt zur Zielhöhe“. Liegt das Ziel nah an der Startposition, unterschreitet sie die Bewegungsschwelle und gilt als Tippen. Stattdessen fährt jede Ziehbewegung zuerst einen Ausschlag deutlich über der Schwelle und danach die Zielhöhe an.

Verworfen wurde die Hover-Kalibrierung im Kontrollzeit-Modus. Sie wurde durch eine Kalibrierung innerhalb derselben gedrückten Geste ersetzt, die zusätzlich dem tatsächlichen Bedienmodell entspricht.

Verworfen wurde die Sichtbarkeitsprüfung der Therapie-Intervalllinie über `toBeVisible()`; geprüft wird stattdessen ihre Geometrie.

Das zuvor erzeugte Video wurde vor der Neuaufnahme gelöscht, damit keine veraltete Aufzeichnung mit getippten Werten in die Abgabe gerät.

### Nachtrag: drei fokussierte Kurzaufnahmen

Zur Gesamtaufnahme kamen drei kurze Videos hinzu (`e2e-demo/01-basisdaten-vitalwerte.spec.ts`,
`02-therapien-ereignisse.spec.ts`, `03-abschluss-export.spec.ts`). Die gemeinsamen
Bausteine liegen seither in `e2e-demo/demo-helpers.ts`.

Dabei traten zwei weitere reproduzierbare Fehlerbilder auf. Erstens lag die
Messfahrt der Helfer stets rund eine Minute links der Jetzt-Linie – genau dort,
wo nach einer Dokumentation zur Kontrollzeit bereits ein NIBP-Griff sitzt. Der
Griff fing den Zeigerkontakt ab, wodurch im Kontrollzeit-Modus keine Koordinate
erschien. Die Messfahrt weicht jetzt allen bedienbaren Stellen des Bandes aus.
Zweitens öffnet die Anwendung die Kontrollseite bewusst in einem neuen Tab;
Playwright zeichnet pro Seite ein eigenes Video auf, sodass der Abschluss in einer
zweiten Datei landete. Verworfen wurde deshalb die Aufnahme über den Popup-Tab –
für die Aufzeichnung wird beim Klick lediglich das `target`-Attribut des Links
entfernt, während Schaltfläche, Route und Exportlogik unverändert bleiben.

### Automatisierte Verifikation

`e2e-demo/narkoseprotokoll-demo.spec.ts` läuft über `npm run test:e2e:demo-video` mit einer eigenen Konfiguration (`playwright.demo.config.ts`, ein Chromium-Projekt, `workers: 1`, `retries: 0`, `video: "on"`). Der Test prüft unter anderem, dass im Kontrollzeit-Modus kein Formular öffnet, dass eine Ziehbewegung kein Formular öffnet, dass das kritische Warnsymbol im DOM vor den Griffen liegt und seinen eigenen Messpunkt nicht überdeckt, und dass der Fall auf der Kontrollseite noch nicht archiviert ist.

### Ergebnis

Ein einzelner Lauf erzeugt eine vollständige Aufzeichnung des Hauptablaufs, in der jeder Vitalwert sichtbar aus einer Zeigerposition entsteht.

## Loop 5 – Leerer Fall ohne Orientierung

### Ausgangsproblem

Ein neuer Fall zeigte die vollständige Zeitachse mit vier leeren Bändern und drei leeren Lanes. Ein dauerhaft eingeblendeter Hinweistext beschrieb zwar das Antippen eines Bandes, aber es fehlte eine Aussage darüber, dass noch überhaupt keine Dokumentation vorliegt.

### Anforderung

Solange weder Messung noch Therapie noch Ereignis existiert, soll ein kurzer deutscher Hinweis den nächsten Schritt benennen. Die Zeitachse muss sichtbar bleiben, der Hinweis mit dem ersten Eintrag verschwinden und nach einem Reload mit vorhandenen Daten nicht wiederkehren.

### Agentischer Umsetzungsschritt

`VitalDocumentation` liest die Summe aus Messungen, Medikamenten, Infusionen und Ereignissen aus dem Fall-Store und zeigt den Hinweis nur, wenn der Store hydratisiert und die Summe null ist.

### Erkannte Schwachstelle

Der Start eines Falls ist noch keine Dokumentation. Würde der Hinweis bereits beim Start verschwinden, bliebe der eigentlich leere Fall unkommentiert.

### Verworfen

Verworfen wurde die Platzierung des Hinweises oberhalb der Zeitachse. Sein Erscheinen und Verschwinden hätte die Bänder vertikal verschoben und damit sowohl die Bedienung als auch die pixelgenauen Messfahrten des Demotests gestört; der Hinweis steht deshalb unterhalb der Grafik.

Verworfen wurde ein größeres Onboarding mit mehreren Schritten. Gefordert war eine knappe Orientierung, kein Tutorial.

### Automatisierte Verifikation

`e2e/vital-timeline.spec.ts` prüft in beiden Playwright-Projekten, dass der Hinweis im leeren Fall sichtbar ist, den Start überlebt, nach dem ersten Vitalwert verschwindet und nach einem Reload mit vorhandener Messung nicht zurückkehrt.

### Ergebnis

Ein leerer Fall benennt den nächsten Schritt, ohne den Hauptablauf oder die Darstellung der Zeitachse zu verändern.

## Loop 6 – Flakiger Dropdown-Test

### Ausgangsproblem

Im vollständigen Playwright-Lauf schlug `iPad R5 Story 10: erste Einheit (mL) laesst sich antippen und wird uebernommen` gelegentlich fehl, während derselbe Test einzeln und dateiweise zuverlässig bestand.

### Anforderung

Der Test soll dieselbe fachliche Aussage prüfen – der erste Eintrag der Einheitenliste ist gross genug und per Tippen wählbar – aber nicht mehr vom Zufall abhängen.

### Agentischer Umsetzungsschritt

Die Fehlermeldung `expect(optionBox!.height).toBeGreaterThanOrEqual(24)` mit dem Wert `0` wies auf eine Messung während der Einblendanimation von Ant Design hin. Die Höhe wird seither zustandsbasiert über `expect.poll` gemessen, zusätzlich wird die Option vorher auf Sichtbarkeit und Bedienbarkeit geprüft.

### Menschliche Prüfung

Die Rückmeldung verlangte ausdrücklich eine echte Stabilisierung statt eines Vermerks „bekannt flakig“.

### Erkannte Schwachstelle

`toBeVisible()` beweist nur, dass ein Element sichtbar ist – nicht, dass seine Geometrie bereits final ist. Eine einmalige Messung direkt danach greift der Animation vor.

### Verworfen

Verworfen wurde, den Fehlschlag als bekannten flakigen Test zu dokumentieren und stehenzulassen.

Ebenso verworfen wurden alle Varianten, die das Symptom verdecken statt es zu beheben: den Test überspringen, die Schwelle von 24 px senken, die Assertion entfernen oder `retries` erhöhen. Der geprüfte Ablauf und der Grenzwert sind unverändert geblieben.

Verworfen wurde auch ein fester Wartezeitraum vor der Messung; er wäre auf langsameren Rechnern erneut zu kurz.

### Automatisierte Verifikation

Datei einzeln je Projekt (35/35 und 35/35), beide Projekte vollständig (83/83 und 83/83) sowie der komplette Lauf `npm run test:e2e` mit 166/166 bestandenen Tests.

### Ergebnis

Die Standard-Suite ist vollständig grün, ohne dass eine Prüfung entfernt oder abgeschwächt wurde.

## Grenzen der agentischen Verifikation

Automatisierte Tests können DOM, Pointer-Events, Viewports, Persistenz und Exportpfade reproduzierbar prüfen. Sie können keine klinische Angemessenheit bestätigen, keine reale Safari-Rendering-Engine auf diesem Windows-Host ersetzen und weder Fingergefühl noch Apple-Pencil-Präzision auf physischer Hardware bewerten. Diese Freigaben bleiben menschliche Aufgaben.
