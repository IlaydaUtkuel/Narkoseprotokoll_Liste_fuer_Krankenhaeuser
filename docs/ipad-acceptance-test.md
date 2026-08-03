# Manuelle Abnahme auf iPad und mit Apple Pencil

**Status: Noch nicht auf physischer Hardware durchgeführt**

Die zweistufige Stift-/Finger-Interaktion (Vorschau → Bestätigung), der unabhängige
NIBP-Griff-Drag, die Scroll-Trennung und die Drawer-Platzierung sind durch
automatisierte Playwright-Szenarien mit **echten Pointer-Events**
(`pointerType: "pen"` bzw. `"touch"`) abgedeckt (`e2e/ipad-interactions.spec.ts`,
Projekt `ipad-viewport`). Diese laufen jedoch in einem **iPad-nahen
Chromium-Viewport** und ersetzen **weder Mobile Safari noch ein physisches iPad
oder einen Apple Pencil**. Hover-Verhalten des Apple Pencil, die echte
Safari-Adressleiste, die Bildschirmtastatur und das Rubber-Band-Scrolling lassen
sich nur auf echter Hardware final verifizieren.

## Testdaten

| Angabe | Wert |
| --- | --- |
| Testdatum |  |
| Gerätemodell |  |
| iPadOS-Version |  |
| Safari-Version |  |
| Apple-Pencil-Modell |  |
| Tester/in |  |

Es dürfen ausschließlich klar fiktive Angaben verwendet werden.

## Was ist automatisiert abgedeckt (nur Emulation)

| Prüfung | Automatischer Test (Emulation) |
| --- | --- |
| NIBP: Systolisch/Mittel/Diastolisch unabhängig ziehen, Reihenfolge, Reload | iPad Story 1 |
| Erster Stift-/Finger-Kontakt öffnet kein Formular, zeigt Koordinate | iPad Story 2 |
| Zweiter Kontakt auf die Vorschau öffnet das Formular (vorbelegt) | iPad Story 2 |
| Vorschau verschwindet nach 3 Sekunden | iPad Story 3 |
| Grafik-Interaktion scrollt die Seite nicht; ausserhalb schon | iPad Story 4 |
| Eingabe-Drawer vollständig im Viewport (Portrait + Landscape), kein Sprung | iPad Story 5 |
| Ereignis per Zwei-Schritt platzieren, schneidet Vitalgrafiken, Reload | iPad Story 6 |
| Medikamenten-Vorschau (kesik Zeitlinie), Formular erst beim zweiten Kontakt | iPad Story 7 |
| Infusions-Vorschau öffnet nur das Infusions-Formular | iPad Story 8 |
| `pointercancel` verwirft Drag/Vorschau ohne Datenänderung | iPad Story 9 |

## Prüfliste (physisches Gerät)

Für jede Zeile ist genau einer der Werte einzutragen: `Nicht getestet`,
`Bestanden` oder `Fehlgeschlagen`. Abweichungen, Gerätedetails und
Reproduktionsschritte gehören in `Bemerkung`.

| Nr. | Prüfung | Status | Bemerkung |
| ---: | --- | --- | --- |
| 1 | Anwendung in Safari online öffnen | Nicht getestet |  |
| 2 | Portrait-Darstellung, kein horizontaler Overflow | Nicht getestet |  |
| 3 | Landscape-Darstellung, kein horizontaler Overflow | Nicht getestet |  |
| 4 | Fiktive Basisdaten eingeben, OP starten | Nicht getestet |  |
| 5 | Apple Pencil über die Grafik bewegen: Koordinate folgt, kein Formular | Nicht getestet |  |
| 6 | Erster Pencil-Kontakt auf freie Fläche: nur Marker (`HH:mm:ss · Parameter Wert`) | Nicht getestet |  |
| 7 | Zweiter Kontakt auf denselben Marker: Formular öffnet, Zeit/Wert vorbelegt | Nicht getestet |  |
| 8 | Kontakt weit entfernt: alter Marker verschwindet, neuer entsteht, kein Formular | Nicht getestet |  |
| 9 | Ohne zweiten Kontakt: Marker verschwindet nach ca. 3 Sekunden | Nicht getestet |  |
| 10 | Dasselbe mit dem Finger (Touch) statt Pencil | Nicht getestet |  |
| 11 | SpO₂, Herzfrequenz, NIBP und Temperatur je einmal per Zwei-Schritt anlegen | Nicht getestet |  |
| 12 | NIBP: Systolisch-Griff ziehen – Mittel und Diastolisch bleiben unverändert | Nicht getestet |  |
| 13 | NIBP: Diastolisch-Griff ziehen – Systolisch und Mittel bleiben unverändert | Nicht getestet |  |
| 14 | NIBP: Mittel-Griff ziehen (vertikal Wert, horizontal Zeit) | Nicht getestet |  |
| 15 | NIBP: Griffe liegen dicht beieinander – der beabsichtigte Griff wird getroffen | Nicht getestet |  |
| 16 | Während NIBP-Drag scrollt die Seite nicht; kein Formular öffnet sich | Nicht getestet |  |
| 17 | Medikamenten-Lane: erster Kontakt = kesik Linie, zweiter Kontakt = Formular | Nicht getestet |  |
| 18 | Infusions-Lane: erster Kontakt = kesik Linie, zweiter Kontakt = Infusions-Formular | Nicht getestet |  |
| 19 | Ereignis-Symbol wählen, Lane antippen = Geist, zweiter Kontakt = Platzierung | Nicht getestet |  |
| 20 | Ereignis-Linie schneidet alle Vitalgrafiken an derselben X-Position | Nicht getestet |  |
| 21 | Auf der Grafik bewegen: Seite scrollt nicht; am linken Rand/ausserhalb scrollt sie | Nicht getestet |  |
| 22 | Formular öffnet als unterer Drawer, vollständig sichtbar, Seite springt nicht | Nicht getestet |  |
| 23 | Bildschirmtastatur öffnet: aktives Feld sichtbar, Speichern/Abbrechen erreichbar | Nicht getestet |  |
| 24 | Formular schließen: Seite kehrt an die vorherige Scroll-Position zurück | Nicht getestet |  |
| 25 | Safari-Adressleiste ein-/ausblenden: Drawer bleibt korrekt positioniert | Nicht getestet |  |
| 26 | Orientierungswechsel (Portrait ↔ Landscape) während einer Interaktion | Nicht getestet |  |
| 27 | Langes Drücken erzeugt kein Kontextmenü / keine Textauswahl auf der Grafik | Nicht getestet |  |
| 28 | Reload: echte Werte bleiben erhalten; keine Vorschau-Marker im Export | Nicht getestet |  |
| 29 | Keine sichtbare UI-Fehlermeldung und kein Fehler im Safari Web Inspector | Nicht getestet |  |

## Abschluss

Gesamtergebnis: **Nicht getestet**

Verwendetes Gerät / Apple-Pencil-Modell:

```text

```

Offene Fehler mit genauer Reproduktion:

```text

```
