# Liefer- und Bereitstellungscheckliste

Stand: 02.08.2026. Ein Haken bedeutet ausschließlich, dass der Punkt in dieser lokalen Arbeitsumgebung tatsächlich verifiziert wurde. Externe oder physische Schritte bleiben bewusst offen.

| Punkt | Status | Nachweis oder nächster Schritt |
| --- | --- | --- |
| Quellcode vollständig | Implementiert | Geforderte Produkt-, Test- und Dokumentationsbausteine sind vorhanden; die unten beschriebene letzte Browser-Nachprüfung bleibt offen |
| Unit-Tests | Bestanden | `npm run test`: 39 Testdateien, 222/222 Tests bestanden |
| Playwright-Tests | Teilweise bestanden | Zwei aufeinanderfolgende vollständige Läufe mit jeweils 94/94; der dritte Lauf endete bei 93/94 an einer flakigen Test-Koordinate. Der anschließend auf Tastaturaktivierung umgestellte Test konnte wegen des externen Ausführungskontingents nicht erneut gestartet werden. Zuvor bestanden die benannten Flaky-Szenarien und der Abschluss-Popup jeweils 20/20 Wiederholungen. |
| Build | Bestanden | Finaler Lauf `npm run build`: Next.js-Produktion und TypeScript erfolgreich; nur nicht-blockierende Webpack-Cache-Snapshot-Warnungen |
| Lint | Bestanden | Finaler Lauf `npm run lint` erfolgreich |
| Touch Targets | Bestanden | Event-, Warning-, Therapie- und Eventmarker-Ziele automatisiert mit mindestens 44×44 CSS-Pixel geprüft |
| Vollständigkeitsprüfung | Bestanden | Reine Auswertung, UI und bestätigter Exportpfad unit-/browsergetestet |
| Fiktiver Demofall | Bestanden | Ein-Klick-Laden, Warnbanner, Reload und Export browsergetestet |
| README | Bestanden | Gegen Implementierung neu erstellt; Testumfang 222 Vitest-Tests und 94 Playwright-Läufe dokumentiert |
| Agentic Workflow | Bestanden | `docs/agentic-workflow.md` |
| Demo-Videos | Bestanden | Drei erfolgreiche Playwright-Aufnahmen in `docs/videos/` |
| Physical iPad Test | Nicht durchgeführt | Prüfliste in `docs/ipad-acceptance-test.md` auf realem iPad ausführen |
| Apple Pencil Test | Nicht durchgeführt | Physisches Pencil-Modell dokumentieren und Prüfliste ausführen |
| Public Deployment | Nicht durchgeführt | Keine URL oder Vercel-Verknüpfung gefunden; nur nach ausdrücklicher Freigabe bereitstellen |
| Repository private | Nicht verifiziert | GitHub CLI nicht verfügbar; in GitHub unter `Settings → General → Visibility` prüfen |
| `jobs@sikant.de` invited | Nicht durchgeführt | Repository in GitHub öffnen, `Settings → Collaborators → Add people` verwenden; Identität/Account vorher bestätigen |
| Delivery email sent | Nicht durchgeführt | Nach Freigabe Link, Teststatus und offene Hardwareprüfung manuell versenden |
| Clean clone verification | Nicht durchgeführt | Uncommittete Endfassung ist ohne verbotenen Commit nicht als identischer Clone verfügbar; nach freigegebenem Commit separat prüfen |
| Final Git status | Bestanden | `git diff --check` fehlerfrei; Branch `main`, ausschließlich nicht committete Arbeitsbaumänderungen |
| Commit and push | Nicht durchgeführt | Vom Auftrag ausdrücklich ausgeschlossen |

## Manuelle GitHub-Schritte

1. Repository-Seite in GitHub öffnen.
2. Unter `Settings → General` die Sichtbarkeit prüfen und dokumentieren.
3. Unter `Settings → Collaborators` den zu `jobs@sikant.de` gehörenden bestätigten GitHub-Account einladen. GitHub lädt Accounts, nicht beliebige E-Mail-Adressen, wenn keine passende Kontoauflösung angeboten wird.
4. Annahme der Einladung kontrollieren.
5. Erst danach eine Liefer-E-Mail mit Repository-/Deployment-Link, Teststand und dem offenen iPad-/Pencil-Test versenden.

## Deployment-Status

Im Repository wurden keine Vercel-Metadaten, keine verifizierbare öffentliche URL, keine GitHub-Actions-Bereitstellung und keine erforderlichen Runtime-Umgebungsvariablen gefunden. `vercel` und `gh` waren in der lokalen Umgebung nicht verfügbar. Es wurde weder ein Projekt erstellt noch eine externe Einstellung verändert.
