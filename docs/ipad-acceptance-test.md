# Manuelle Abnahme auf iPad und mit Apple Pencil

**Status: Kernabläufe von der Auftraggeberin auf einem physischen iPad geprüft; die
unten einzeln aufgeführten Restpunkte sind weiterhin offen.**

Die zweistufige Stift-/Finger-Interaktion (Vorschau → Bestätigung), der unabhängige
NIBP-Griff-Drag, die Scroll-Trennung und die Drawer-Platzierung sind durch
automatisierte Playwright-Szenarien mit **echten Pointer-Events**
(`pointerType: "pen"` bzw. `"touch"`) abgedeckt (`e2e/ipad-interactions.spec.ts`,
Projekt `ipad-viewport`). Diese laufen jedoch in einem **iPad-nahen
Chromium-Viewport** und ersetzen **weder Mobile Safari noch ein physisches iPad
oder einen Apple Pencil**. Hover-Verhalten des Apple Pencil, die echte
Safari-Adressleiste, die Bildschirmtastatur und das Rubber-Band-Scrolling lassen
sich nur auf echter Hardware final verifizieren.

## Auf physischer Hardware geprüft (Auftraggeberin)

Die folgenden Abläufe wurden von der Auftraggeberin manuell auf einem physischen
iPad geprüft und als funktionierend zurückgemeldet:

| Ablauf | Status |
| --- | --- |
| Vitalwerte hinzufügen | Bestanden |
| Vitalwerte verschieben | Bestanden |
| Systolischen und diastolischen NIBP-Wert ziehen | Bestanden |
| Medikamente hinzufügen | Bestanden |
| Infusionen hinzufügen | Bestanden |
| Drawer-Verhalten ohne unerwünschtes Seitenscrollen | Bestanden |
| Scrollverhalten bei Finger- und Pencil-Interaktionen | Bestanden |
| Ereignisse hinzufügen | Bestanden |
| Ereignisse korrigieren | Bestanden |
| Persistence nach einem Reload | Bestanden |
| Export- beziehungsweise Files-Ablauf | Bestanden |

Nicht dokumentiert sind das verwendete Gerätemodell, die iPadOS- und
Browserversion sowie das Apple-Pencil-Modell. Diese Angaben und die unten noch
mit `Nicht getestet` markierten Zeilen bleiben offen. Aussagen über eine
bestimmte Browser-Engine werden hier bewusst nicht getroffen.

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
| Medikament/Infusion-Vorschau als gestrichelter Kreis, kein „+“, versetzter Kontakt nutzt den fixierten Zeitstempel | iPad R2 Story 1/2 |
| Neue Berührung entfernt die alte Vorschau sofort (nie zwei gleichzeitig) | iPad R2 Story 3 |
| NIBP: Systolisch nahe ans Mittel gezogen lässt die anderen Werte unverändert | iPad R2 Story 6 |
| Keine blaue Textauswahl auf der Grafik; Drawer-Eingaben bleiben auswählbar | iPad R2 Story 7 |
| Checkpoint-Ausrufezeichen schaltet den Modus um (aria-pressed, schwarzer Rahmen) | iPad R2 Story 8 |
| Checkpoint-Modus füllt vier Bänder per Stift an derselben Zeit, NIBP inline (kein Drawer) | iPad R2 Story 9 |
| Checkpoint-Modus fixiert die Zeit unabhängig von der X-Position | iPad R2 Story 10 |
| Koordinate + Medikament-Info + Warn-Ausrufezeichen gleichzeitig sichtbar, keine Überlappung (links/mitte/rechts) | iPad R2 Story 11 + placeTooltipAvoidingAll/warningIcons (Unit) |
| Drawer öffnet oben (scrollTop = 0) – obere Formularfelder sichtbar | resetDrawerScrollTop (Unit) + iPad Story 5 |

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
| 11 | SpO₂, Herzfrequenz, NIBP und Temperatur je einmal per Zwei-Schritt anlegen | Bestanden | Auftraggeberin, physisches iPad |
| 12 | NIBP: Systolisch-Griff ziehen – Mittel und Diastolisch bleiben unverändert | Bestanden | Auftraggeberin, physisches iPad |
| 13 | NIBP: Diastolisch-Griff ziehen – Systolisch und Mittel bleiben unverändert | Bestanden | Auftraggeberin, physisches iPad |
| 14 | NIBP: Mittel-Griff ziehen (vertikal Wert, horizontal Zeit) | Nicht getestet |  |
| 15 | NIBP: Griffe liegen dicht beieinander – der beabsichtigte Griff wird getroffen | Nicht getestet |  |
| 16 | Während NIBP-Drag scrollt die Seite nicht; kein Formular öffnet sich | Bestanden | Auftraggeberin, physisches iPad |
| 17 | Medikamenten-Lane: erster Kontakt = kesik Linie, zweiter Kontakt = Formular | Bestanden | Auftraggeberin, physisches iPad |
| 18 | Infusions-Lane: erster Kontakt = kesik Linie, zweiter Kontakt = Infusions-Formular | Bestanden | Auftraggeberin, physisches iPad |
| 19 | Ereignis-Symbol wählen, Lane antippen = Geist, zweiter Kontakt = Platzierung | Bestanden | Auftraggeberin, physisches iPad |
| 20 | Ereignis-Linie schneidet alle Vitalgrafiken an derselben X-Position | Nicht getestet |  |
| 21 | Auf der Grafik bewegen: Seite scrollt nicht; am linken Rand/ausserhalb scrollt sie | Bestanden | Auftraggeberin, physisches iPad |
| 22 | Formular öffnet als unterer Drawer, vollständig sichtbar, Seite springt nicht | Bestanden | Auftraggeberin, physisches iPad |
| 23 | Bildschirmtastatur öffnet: aktives Feld sichtbar, Speichern/Abbrechen erreichbar | Nicht getestet |  |
| 24 | Formular schließen: Seite kehrt an die vorherige Scroll-Position zurück | Nicht getestet |  |
| 25 | Safari-Adressleiste ein-/ausblenden: Drawer bleibt korrekt positioniert | Nicht getestet |  |
| 26 | Orientierungswechsel (Portrait ↔ Landscape) während einer Interaktion | Nicht getestet |  |
| 27 | Langes Drücken erzeugt kein Kontextmenü / keine Textauswahl auf der Grafik | Nicht getestet |  |
| 28 | Reload: echte Werte bleiben erhalten; keine Vorschau-Marker im Export | Bestanden | Auftraggeberin, physisches iPad |
| 29 | Keine sichtbare UI-Fehlermeldung und kein Fehler im Safari Web Inspector | Nicht getestet |  |
| 30 | Medikament/Infusion: gestrichelter Vorschaukreis, kein „+“; Kontakt irgendwo im Kreis wählt die Zeit | Nicht getestet |  |
| 31 | Neue Berührung lässt die alte Vorschau sofort verschwinden (nie zwei gleichzeitig) | Nicht getestet |  |
| 32 | Koordinate, aktives Medikament und Warnsymbol gleichzeitig sichtbar, ohne Überlappung | Nicht getestet |  |
| 33 | Drawer öffnet oben – obere Formularfelder sofort sichtbar, nicht nur „Speichern“ | Nicht getestet |  |
| 34 | NIBP: Systolisch/Diastolisch dicht ans Mittel ziehen – Mittel bleibt, kein Springen | Nicht getestet |  |
| 35 | Beim Zeichnen auf 5-Minuten-Linien entsteht keine blaue Vollbild-Textauswahl | Nicht getestet |  |
| 36 | Checkpoint-Ausrufezeichen tippen: schwarzer Rahmen, kein blaues Safari-Highlight | Nicht getestet |  |
| 37 | Checkpoint-Modus: vier Bänder per Pencil an derselben Kontrollzeit füllen, kein Drawer | Nicht getestet |  |
| 38 | Checkpoint-NIBP: Systolisch/Mittel/Diastolisch einzeln inline, keine automatische Schätzung | Nicht getestet |  |
| 39 | Checkpoint-Modus: X-Position der Berührung ändert die gespeicherte Zeit nicht | Nicht getestet |  |
| 40 | Checkpoint erneut tippen beendet den Modus; nach Vollständigkeit schließt er selbst | Nicht getestet |  |
| 41 | Bestehende Vitalwerte auf der Zeitachse verschieben | Bestanden | Auftraggeberin, physisches iPad |
| 42 | Bestehende Ereignisse korrigieren | Bestanden | Auftraggeberin, physisches iPad |
| 43 | Export- beziehungsweise Files-Ablauf auf dem Gerät | Bestanden | Auftraggeberin, physisches iPad |

## Abschluss

Gesamtergebnis: **Teilweise geprüft** – die oben aufgeführten Kernabläufe sind auf
einem physischen iPad bestanden; die verbleibenden Zeilen sind offen.

Verwendetes Gerät / Apple-Pencil-Modell (nicht dokumentiert):

```text

```

Offene Fehler mit genauer Reproduktion:

```text

```
