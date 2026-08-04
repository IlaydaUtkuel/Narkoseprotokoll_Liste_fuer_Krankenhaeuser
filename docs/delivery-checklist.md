# Liefer- und Bereitstellungscheckliste

Stand: 05.08.2026. Ein Haken bedeutet ausschließlich, dass der Punkt in dieser lokalen Arbeitsumgebung tatsächlich ausgeführt und beobachtet wurde. Externe oder physische Schritte bleiben bewusst offen.

Geprüfter Anwendungsstand: Commit `4b3b57e` (`test: finalen Playwright-Demoablauf und Lieferartefakte vorbereiten`). Alle unten genannten Läufe wurden auf diesem Stand ausgeführt.

## Ausgeführte Verifikation

| Prüfung | Befehl | Ergebnis |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Bestanden, keine Fehlerausgabe (`tsc --noEmit`, Exit-Code 0) |
| Lint | `npm run lint` | Bestanden, keine Meldungen (Exit-Code 0) |
| Unit- und Integrationstests | `npm run test` | Bestanden: 53 Testdateien, 297/297 Tests, Dauer 31 s |
| Production-Build | `npm run build` | Bestanden: Next.js 16.2.12 mit webpack, TypeScript erfolgreich, vier statische Routen (`/`, `/_not-found`, `/abschluss`, `/dokumentation`) |
| Playwright gesamt | `npm run test:e2e` | 164 bestanden, 2 fehlgeschlagen – beide Fehlschläge betreffen denselben bekannten flakigen Test (siehe unten) |
| Playwright Desktop | `npx playwright test --project=chromium` | Bestanden: 83/83, Dauer 3,0 min |
| Playwright iPad-nah | `npx playwright test --project=ipad-viewport` | 82 bestanden, 1 fehlgeschlagen (derselbe flakige Test), Dauer 3,4 min |
| Playwright-Demo-Video | `npm run test:e2e:demo-video` | Bestanden: 1/1, Dauer 2,4 min, Video erzeugt |

Gesamtumfang laut `npx playwright test --list`: 166 Tests in 9 Dateien, verteilt auf die Projekte `chromium` (83) und `ipad-viewport` (83). Die Demo-Konfiguration meldet über `npx playwright test --config=playwright.demo.config.ts --list` genau 1 Test in 1 Datei.

### Bekannter flakiger Test

`e2e/ipad-interactions.spec.ts` → `iPad R5 Story 10: erste Einheit (mL) laesst sich antippen und wird uebernommen`

* Fehlerbild: `expect(optionBox!.height).toBeGreaterThanOrEqual(24)` erhält `0`, weil die Bounding-Box des ersten Dropdown-Eintrags während der Ant-Design-Öffnungsanimation gemessen wird.
* Der Test besteht zuverlässig, wenn er allein (`-g "iPad R5 Story 10"`), als ganze Datei in einem Projekt (35/35) oder als ganze Datei in beiden Projekten (70/70) läuft. Er schlägt nur im vollständigen Suite-Lauf fehl.
* Der Fehlschlag ist nicht durch die Änderungen dieses Commits verursacht: Mit auf den Vorstand zurückgesetzter `VitalDocumentation.tsx` und `globals.css` trat er im vollständigen Lauf ebenfalls auf.
* Der Test wurde bewusst nicht umgeschrieben. Eine minimale Stabilisierung wäre, die Höhe über `expect.poll` zu messen statt einmalig direkt nach `toBeVisible()`.

## Demo-Video

Es existiert genau **ein** Demo-Video. Frühere Aussagen über drei Aufnahmen treffen nicht zu.

| Merkmal | Wert |
| --- | --- |
| Pfad | `docs/videos/narkoseprotokoll-demo-4b3b57e.webm` |
| Erzeugungsbefehl | `npm run test:e2e:demo-video` |
| Test | `e2e-demo/narkoseprotokoll-demo.spec.ts` |
| Konfiguration | `playwright.demo.config.ts` (Projekt `demo`, Chromium, Viewport 1440×900, `workers: 1`, `retries: 0`, `video: "on"`, `trace: "retain-on-failure"`, `slowMo: 250`) |
| Anwendungsstand | Commit `4b3b57e` |
| Dauer | 139,72 s |
| Dateigröße | 10 579 818 Byte (rund 10,1 MiB) |
| Container und Codec | WebM (EBML-Signatur `1A45DFA3` geprüft), Video-Codec VP8 |
| Auflösung | 800 × 500 |

Die Container-Werte wurden ausgelesen, indem der EBML-Header der Datei direkt geparst wurde. `ffprobe` war in dieser Umgebung nicht installiert und wurde absichtlich nicht nachinstalliert. Das Video wurde **nicht** visuell abgespielt und gesichtet; belegt sind der erfolgreiche Testlauf, die gültige Containerstruktur und die ausgelesenen Metadaten.

Der aufgezeichnete Ablauf entspricht den Schritten des Tests: Basisdaten erfassen, `Okay und Weiter`, `Start` um 10:00:00, `Beginn der Anästhesie`, Vitalwerte ausschließlich per Mausklick in der Grafik, Messfahrt über das Temperaturband mit sichtbarer Zeit- und Wertanzeige, Ziehen der systolischen und diastolischen NIBP-Griffe, Kontrollzeit-Modus ein- und ausschalten, Medikament mit Wirkdauer samt Schraffur-Tooltip in den übrigen Bändern, kritischer SpO₂-Wert mit Warnsymbol und Hinweistext, Korrektur des kritischen Werts durch Ziehen, Löschen eines Messwerts, restliche Phasen, `Eingriff beenden`, Reload-Persistenzprüfung, `Speichern und Schließen` und langsames Durchscrollen der Kontrollseite.

Die Rohausgabe des Laufs liegt unter `demo-artifacts/` und ist über `.gitignore` von der Versionierung ausgenommen; ausgeliefert wird ausschließlich die Datei unter `docs/videos/`.

## Weitere Lieferpunkte

| Punkt | Status | Nachweis oder nächster Schritt |
| --- | --- | --- |
| Quellcode vollständig | Implementiert | Produkt-, Test- und Dokumentationsbausteine vorhanden |
| Leerer Fall | Implementiert | Hinweis `Noch keine Dokumentation vorhanden.` unterhalb der Zeitachse; geprüft in `e2e/vital-timeline.spec.ts` in beiden Projekten |
| Touch Targets | Bestanden | Event-, Warning-, Therapie- und Eventmarker-Ziele automatisiert mit mindestens 44×44 CSS-Pixel geprüft |
| Vollständigkeitsprüfung | Bestanden | Reine Auswertung, UI und bestätigter Exportpfad unit- und browsergetestet |
| Fiktiver Demofall | Bestanden | Ein-Klick-Laden, Warnbanner, Reload und Export browsergetestet |
| Agentic Workflow | Bestanden | `docs/agentic-workflow.md`, fünf Schleifen mit jeweils eigenem Abschnitt `Verworfen` |
| Public Deployment | Vorhanden | Produktions-URL `https://sikant.vercel.app`, Vercel-Projekt `sikant` im Scope `ilaydautkuel1`; Details siehe unten |
| Physical iPad Test | Nicht durchgeführt | Prüfliste in `docs/ipad-acceptance-test.md` auf realem iPad ausführen |
| Apple Pencil Test | Nicht durchgeführt | Physisches Pencil-Modell dokumentieren und Prüfliste ausführen |
| Screenreader- und Kontrastprüfung | Nicht durchgeführt | Axe deckt nur automatisierbare WCAG-Verstöße ab |
| Mobile Safari / WebKit | Nicht durchgeführt | WebKit lässt sich auf diesem Windows-Host nicht starten; das iPad-Projekt nutzt Chromium |
| Repository private | Nicht verifiziert | GitHub CLI nicht verfügbar; in GitHub unter `Settings → General → Visibility` prüfen |
| `jobs@sikant.de` invited | Nicht durchgeführt | Repository in GitHub öffnen, `Settings → Collaborators → Add people` verwenden; Identität vorher bestätigen |
| Delivery email sent | Nicht durchgeführt | Nach Freigabe Link, Teststatus und offene Hardwareprüfung manuell versenden |
| Clean clone verification | Nicht durchgeführt | Nach dem Push separat aus einem frischen Clone prüfen |
| Push | Nicht durchgeführt | Vom Auftrag ausdrücklich ausgeschlossen; die Commits liegen ausschließlich lokal |

## Manuelle GitHub-Schritte

1. Repository-Seite in GitHub öffnen.
2. Unter `Settings → General` die Sichtbarkeit prüfen und dokumentieren.
3. Unter `Settings → Collaborators` den zu `jobs@sikant.de` gehörenden bestätigten GitHub-Account einladen. GitHub lädt Accounts ein, nicht beliebige E-Mail-Adressen.
4. Annahme der Einladung kontrollieren.
5. Erst danach eine Liefer-E-Mail mit Repository-/Deployment-Link, Teststand und dem offenen iPad-/Pencil-Test versenden.

## Deployment-Status

Anders als in früheren Fassungen dieser Checkliste behauptet, existiert eine öffentliche Bereitstellung.

* Produktions-URL: `https://sikant.vercel.app` – über `curl` mit HTTP 200 erreichbar; die ausgelieferte Seite trägt den Titel `Narkoseprotokoll Demo` und enthält `Basisdaten des Narkosefalls` sowie `Sikant Med`, ist also dieses Projekt.
* Vercel-Projekt: `sikant` im Scope `ilaydautkuel1`, ermittelt mit `npx vercel project ls` bei angemeldetem Benutzer `ilaydautkuel`.
* Die jüngste Production-Deployment-ID lautet `dpl_JB39JCcZcJkh5BtBmtdMX2G1NMQ7`, erstellt am 05.08.2026 um 00:11 Uhr MESZ, Status `Ready`.
* Weitere Aliase: `https://sikant-ilaydautkuel1.vercel.app` und `https://sikant-git-main-ilaydautkuel1.vercel.app`. Der letztgenannte Alias weist auf eine Git-Anbindung des Branches `main` hin.
* Im Repository selbst liegen weiterhin **keine** Deployment-Metadaten: kein `vercel.json`, kein `.vercel`-Verzeichnis, kein `.github`-Workflow. Die Verknüpfung besteht auf Seiten des Vercel-Kontos, nicht im Quellcode.
* Wichtig: Der zuletzt veröffentlichte Stand entspricht nicht den beiden hier beschriebenen lokalen Commits, da nicht gepusht wurde. Das Deployment zeigt den Stand des zuletzt nach `main` gepushten Commits.
* Es wurde weder ein Deployment ausgelöst noch ein Projekt oder eine Einstellung verändert; alle Vercel-Aufrufe waren lesend.
