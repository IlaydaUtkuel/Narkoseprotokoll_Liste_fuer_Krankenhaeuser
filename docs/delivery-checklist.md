# Liefer- und Bereitstellungscheckliste

Stand: 05.08.2026. Ein Haken bedeutet ausschließlich, dass der Punkt in dieser
Arbeitsumgebung tatsächlich ausgeführt und beobachtet wurde.

## Ausgeführte Verifikation

Alle Befehle wurden am 05.08.2026 auf dem finalen Arbeitsstand ausgeführt.

| Prüfung | Befehl | Ergebnis |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Bestanden, keine Ausgabe |
| Lint | `npm run lint` | Bestanden, keine Meldungen |
| Unit- und Integrationstests | `npm run test` | Bestanden: 53 Testdateien, 297/297 Tests |
| Production-Build | `npm run build` | Bestanden: Next.js 16.2.12 mit webpack, vier statische Routen |
| Playwright Desktop | `npx playwright test --project=chromium` | Bestanden: 83/83 |
| Playwright iPad-nah | `npx playwright test --project=ipad-viewport` | Bestanden: 83/83 |
| Playwright gesamt | `npm run test:e2e` | Bestanden: 166/166 |
| Demo-Videos (drei kurze) | `npm run test:e2e:demo-videos` | Bestanden: 3/3 |
| Demo-Video (Gesamtablauf) | `npm run test:e2e:demo-video` | Bestanden: 1/1 |

Der Gesamtumfang der Standard-Suite beträgt laut `npx playwright test --list`
166 Tests in 9 Dateien, verteilt auf die Projekte `chromium` und `ipad-viewport`
mit je 83 Tests. Die Demo-Aufnahmen laufen über eine eigene Konfiguration
(`playwright.demo.config.ts`) und sind nicht Teil dieser Zahl.

### Behobener flakiger Test

`e2e/ipad-interactions.spec.ts` → `iPad R5 Story 10: erste Einheit (mL) laesst sich antippen und wird uebernommen`
maß die Höhe des ersten Dropdown-Eintrags einmalig direkt nach `toBeVisible()`.
Während der Einblendanimation von Ant Design lieferte die Bounding-Box
gelegentlich `0`. Die Höhe wird jetzt zustandsbasiert über `expect.poll`
gemessen, nachdem die Option zusätzlich auf Sichtbarkeit und Bedienbarkeit
geprüft wurde. Grenzwert, Ablauf und Aussage des Tests sind unverändert; es wurde
weder übersprungen, abgeschwächt noch mit Retries überdeckt.

## Demo-Videos

Alle vier Aufnahmen stammen aus erfolgreichen Testläufen und wurden anschließend
visuell gesichtet: Aus jedem Video wurden repräsentative Einzelbilder gerendert
und geprüft.

| Video | Test | Befehl | Dauer | Ergebnis |
| --- | --- | --- | --- | --- |
| `docs/videos/00-gesamtablauf.webm` | `e2e-demo/narkoseprotokoll-demo.spec.ts` | `npm run test:e2e:demo-video` | 2:15 min | Bestanden |
| `docs/videos/01-basisdaten-vitalwerte-persistence.webm` | `e2e-demo/01-basisdaten-vitalwerte.spec.ts` | `npm run test:e2e:demo:basisdaten` | 0:54 min | Bestanden |
| `docs/videos/02-therapien-ereignisse-bearbeiten.webm` | `e2e-demo/02-therapien-ereignisse.spec.ts` | `npm run test:e2e:demo:therapien` | 0:29 min | Bestanden |
| `docs/videos/03-abschluss-kontrolle-export.webm` | `e2e-demo/03-abschluss-export.spec.ts` | `npm run test:e2e:demo:abschluss` | 0:34 min | Bestanden |

`npm run test:e2e:demo-videos` führt die drei kurzen Aufnahmen nacheinander aus
und bricht bei einem Fehlschlag mit einem Exit-Code ungleich 0 ab. Im Anschluss
kopiert `scripts/collect-demo-videos.mjs` die fertigen Dateien nach
`docs/videos/`. Die Playwright-Rohausgabe unter `demo-artifacts/` ist über
`.gitignore` von der Versionierung ausgenommen.

Zwei bewusst dokumentierte Eingriffe betreffen ausschließlich die Aufzeichnung,
nicht die Anwendung:

* Im Abschluss-Video wird `window.showDirectoryPicker` – also der native
  Systemdialog – durch einen Mock ersetzt, der die geschriebene Datei mitliest.
  Beide Klicks (`Ordner auswählen`, `Speichern und Schließen`) erfolgen sichtbar,
  Validierung, Vollständigkeitsprüfung und Exporterzeugung laufen unverändert
  durch die Anwendung, und der Test prüft Dateiname und JSON-Inhalt.
* Die Anwendung öffnet die Kontrollseite in einem neuen Tab. Da Playwright pro
  Seite ein eigenes Video aufzeichnet, wird beim Klick lediglich das
  `target`-Attribut des Links entfernt, damit eine durchgehende Aufnahme
  entsteht. Schaltfläche, Route und Exportlogik bleiben unverändert.

## Manuelle iPad-Prüfung

Die Auftraggeberin hat folgende Abläufe manuell auf einem physischen iPad
geprüft: Vitalwerte hinzufügen, Vitalwerte verschieben, systolischen und
diastolischen NIBP-Wert ziehen, Medikamente hinzufügen, Infusionen hinzufügen,
Drawer-Verhalten ohne unerwünschtes Seitenscrollen, Scrollverhalten bei Finger-
und Pencil-Interaktionen, Ereignisse hinzufügen, Ereignisse korrigieren,
Persistence nach einem Reload sowie den Export- beziehungsweise Files-Ablauf.

Nicht dokumentiert sind Gerätemodell, iPadOS- und Browserversion sowie das
Apple-Pencil-Modell. Die restlichen Zeilen der Prüfliste in
`docs/ipad-acceptance-test.md` bleiben offen.

## Weitere Lieferpunkte

| Punkt | Status | Nachweis oder nächster Schritt |
| --- | --- | --- |
| Quellcode vollständig | Implementiert | Produkt-, Test- und Dokumentationsbausteine vorhanden |
| Leerer Fall | Implementiert | Hinweis `Noch keine Dokumentation vorhanden.` unterhalb der Zeitachse; in `e2e/vital-timeline.spec.ts` in beiden Projekten geprüft |
| Touch Targets | Bestanden | Automatisiert mit mindestens 44×44 CSS-Pixel geprüft |
| Vollständigkeitsprüfung | Bestanden | Reine Auswertung, UI und bestätigter Exportpfad unit- und browsergetestet |
| Fiktiver Demofall | Bestanden | Ein-Klick-Laden, Warnbanner, Reload und Export browsergetestet |
| Agentic Workflow | Bestanden | `docs/agentic-workflow.md`, sechs Schleifen mit jeweils eigenem Abschnitt `Verworfen` |
| Public Deployment | Bestanden | `https://sikant.vercel.app`, Vercel-Projekt `sikant`; Verifikation siehe unten |
| Screenreader- und Kontrastprüfung | Nicht durchgeführt | Axe deckt nur automatisierbare WCAG-Verstöße ab |
| Mobile Safari / WebKit | Nicht durchgeführt | WebKit lässt sich auf diesem Windows-Host nicht starten; das iPad-Projekt nutzt Chromium |
| Restliche iPad-Prüfliste | Offen | Siehe `docs/ipad-acceptance-test.md` |
| Repository private | Nicht verifiziert | GitHub CLI nicht verfügbar; in GitHub unter `Settings → General → Visibility` prüfen |
| `jobs@sikant.de` invited | Nicht durchgeführt | In GitHub unter `Settings → Collaborators` den bestätigten Account einladen |
| Delivery email sent | Nicht durchgeführt | Nach Freigabe Link, Teststatus und offene Punkte manuell versenden |

## Deployment-Status

* Produktions-URL: `https://sikant.vercel.app`
* Vercel-Projekt `sikant` im Scope `ilaydautkuel1`; die Bereitstellung erfolgt
  über die Git-Integration des Branches `main`.
* Der finale Commit wurde nach `main` gepusht; das daraus erzeugte
  Production-Deployment wurde mit `npx vercel inspect` als `Ready` bestätigt und
  trägt denselben Commit-SHA wie der lokale HEAD.
* Die URL antwortet mit HTTP 200 und liefert die Anwendung aus (Seitentitel
  `Narkoseprotokoll Demo`, Inhalt `Basisdaten des Narkosefalls`).
* Im Repository liegen weiterhin keine Deployment-Metadaten (kein `vercel.json`,
  kein `.vercel`, kein GitHub-Actions-Workflow); die Verknüpfung besteht auf
  Seiten des Vercel-Kontos.
* Es wurde kein manuelles Deployment ausgelöst.
