"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App } from "antd";
import { BAND_ORDER, PREVIEW_CIRCLE_RADIUS_PX, PREVIEW_HIT_RADIUS_PX, VITAL_CONFIG } from "../../lib/timeline/config";
import { bandAtY, computeTimelineLayout } from "../../lib/timeline/geometry";
import { findNearestHit, type HitTarget } from "../../lib/timeline/hitTesting";
import { clientToSvgPoint } from "../../lib/timeline/svgCoords";
import { buildXScale, buildYScales, computeDomain, timeToX, xToTime } from "../../lib/timeline/scales";
import { relativeTimelineTicks } from "../../lib/timeline/timeTicks";
import { mapPointerToTimeline, type PointerMapResult } from "../../lib/timeline/pointerMapping";
import { clampValue, normalizeVitalPointerValue, roundToPrecision } from "../../lib/timeline/measurementUtils";
import { formatClock, formatVitalNumber } from "../../lib/timeline/format";
import { computeVitalScaleDomains } from "../../lib/timeline/dynamicYScale";
import { checkpointTooltip, deriveCheckpointWarnings } from "../../lib/timeline/checkpoints";
import { deriveCriticalWarnings } from "../../lib/timeline/criticalValues";
import { loadCriticalSettings, type CriticalSettings } from "../../lib/timeline/criticalSettingsStorage";
import { toggleEventSelection } from "../../lib/timeline/eventSelection";
import { maxDocumentableTime, type TimelineTimeError } from "../../lib/timeline/timeValidation";
import { isPreviewConfirmHit, usesTwoPhase, type TimelinePreview } from "../../lib/timeline/previewInteraction";
import { clampDiastolic, clampMean, clampSystolic } from "../../lib/timeline/nibpDrag";
import { placeTooltipAvoidingAll, type TooltipRect } from "../../lib/timeline/tooltipPlacement";
import { checkpointIconRect, occupiedSpot, placeCriticalIcon } from "../../lib/timeline/warningIcons";
import { eventDefinition } from "../../lib/timeline/events";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useElementSize } from "../../hooks/useElementSize";
import { useTimelinePreview } from "../../hooks/useTimelinePreview";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import { TimeGrid } from "./TimeGrid";
import { VitalBandBackground } from "./VitalBandBackground";
import { Spo2Band } from "./Spo2Band";
import { LineBand } from "./LineBand";
import { NibpBand, NibpHandleLayer } from "./NibpBand";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { CheckpointWarningLayer } from "./CheckpointWarningLayer";
import { CriticalValuesPanel } from "./CriticalValuesPanel";
import { CriticalWarningLayer } from "./CriticalWarningLayer";
import { VitalEntryDrawer } from "./VitalEntryDrawer";
import { TherapyEntryDrawer } from "./TherapyEntryDrawer";
import { EventLaneTools } from "./TherapyToolbar";
import {
  TherapyIntervalTooltip,
  TherapyDurationLayer,
  TherapyLaneBackgrounds,
  TherapyMarkerLayer,
  therapyIntervalsAtTime,
  therapyTooltipBounds,
  therapyTooltipSize,
  type ActiveTherapyInterval,
  type TherapyEndPlacement,
} from "./TherapyLayers";
import {
  TherapyLaneInteractionLayer,
  type LanePlacementPreview,
} from "./TherapyLaneInteractions";
import type { BandContext, DragPreview, EntryDraft, TherapyDraft } from "./timelineTypes";
import type { InfusionEntry, Measurement, MedicationEntry, NibpMeasurement, ScalarMeasurement, TimelineEventType, VitalKind } from "../../types/vitals";

const MIN_WIDTH = 320;
const NOW_INTERVAL_MS = 250;
const DRAG_THRESHOLD_PX = 9;

type CursorMap = Extract<PointerMapResult, { svgX: number }>;
type CrosshairState = CursorMap & { locked: boolean };

interface PlotPointerState {
  active: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  moved: boolean;
  dragging: boolean;
  targetId: string | null;
  // Bestätigt dieser Kontakt eine bereits abgelegte Vorschau? Wird beim pointerdown
  // entschieden, damit eine neue (nicht bestätigende) Geste die alte Vorschau sofort löscht.
  confirming: boolean;
}

interface IntervalTooltipState {
  items: ActiveTherapyInterval[];
  x: number;
  y: number;
  locked: boolean;
}

type NibpComponent = "systolic" | "mean" | "diastolic";

interface ActiveCheckpoint {
  time: number;
  nibpComponent: NibpComponent;
  // Zwischenspeicher für NIBP-Komponenten, solange noch kein Mittelwert vorliegt
  // (ohne Mittel kann keine echte Messung angelegt werden). Kein erfundener Wert.
  nibpDraft: { systolic: number | null; mean: number | null; diastolic: number | null } | null;
}

const EMPTY_POINTER: PlotPointerState = {
  active: false,
  pointerId: -1,
  pointerType: "mouse",
  startX: 0,
  startY: 0,
  moved: false,
  dragging: false,
  targetId: null,
  confirming: false,
};

export function VitalTimeline({ patientBirthDate = "" }: { patientBirthDate?: string }) {
  const { message } = App.useApp();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointerRef = useRef<PlotPointerState>({ ...EMPTY_POINTER });
  const therapyEndPlacementRef = useRef<TherapyEndPlacement | null>(null);
  // Merkt sich, ob der aktuelle Lane-Kontakt eine bestehende Vorschau bestätigt
  // (Entscheidung beim pointerdown, ausgewertet beim pointerup).
  const laneConfirmRef = useRef(false);

  const startedAt = useCaseStore((state) => state.startedAt);
  const caseId = useCaseStore((state) => state.caseId);
  const endedAt = useCaseStore((state) => state.endedAt);
  const measurements = useCaseStore((state) => state.measurements);
  const medications = useCaseStore((state) => state.medications);
  const infusions = useCaseStore((state) => state.infusions);
  const events = useCaseStore((state) => state.events);
  const addMeasurement = useCaseStore((state) => state.addMeasurement);
  const updateScalar = useCaseStore((state) => state.updateScalar);
  const updateNibp = useCaseStore((state) => state.updateNibp);
  const updateEventTime = useCaseStore((state) => state.updateEventTime);
  const upsertEvent = useCaseStore((state) => state.upsertEvent);
  const updateTherapyEnd = useCaseStore((state) => state.updateTherapyEnd);

  const now = useCurrentTime(NOW_INTERVAL_MS, endedAt);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [therapyDraft, setTherapyDraft] = useState<TherapyDraft | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<TimelineEventType | null>(null);
  const [lanePreview, setLanePreview] = useState<LanePlacementPreview | null>(null);
  const [intervalTooltip, setIntervalTooltip] = useState<IntervalTooltipState | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(null);
  // Ausgewählter (schwarz umrandeter) Messpunkt: nur er folgt dem Stift. Ohne
  // Auswahl bleiben bestehende Punkte beim Darüberfahren unverändert.
  const [armedMeasurementId, setArmedMeasurementId] = useState<string | null>(null);
  // Checkpoint-Eingabemodus (§11/§12): X ist auf die Kontrollzeit fixiert, der Stift
  // legt nur den Y-Wert fest. Ein aktiver Modus schließt den Normalmodus aus.
  const [activeCheckpoint, setActiveCheckpoint] = useState<ActiveCheckpoint | null>(null);
  const checkpointDrag = useRef<{ active: boolean; pointerId: number; kind: VitalKind | null }>({ active: false, pointerId: -1, kind: null });
  const [therapyEndPlacement, setTherapyEndPlacement] = useState<TherapyEndPlacement | null>(null);
  const [criticalSettings, setCriticalSettings] = useState<CriticalSettings | null>(null);
  // Genau eine fluechtige Vorschau (Stift/Finger, iPad-Zwei-Schritt). Nie persistiert.
  const { preview, setPreview, clearPreview } = useTimelinePreview();
  // Aktive Stift-/Finger-Interaktion auf der Grafik: sperrt vorübergehend den
  // Seiten-Scroll (Maus bleibt unberührt, damit Desktop-Scrollen erhalten bleibt).
  const [interactionActive, setInteractionActive] = useState(false);
  useBodyScrollLock(interactionActive);

  useEffect(() => {
    // Separater, nicht-klinischer UI-Support-State; nie Teil des Fallexports.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCriticalSettings(loadCriticalSettings(caseId, patientBirthDate));
  }, [caseId, patientBirthDate]);

  useEffect(() => {
    const clearEventSelection = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedEventType(null);
      setLanePreview(null);
      clearPreview();
      setActiveCheckpoint(null);
      setSelectedCheckpoint(null);
      therapyEndPlacementRef.current = null;
      setTherapyEndPlacement(null);
    };
    window.addEventListener("keydown", clearEventSelection);
    return () => window.removeEventListener("keydown", clearEventSelection);
  }, [clearPreview]);

  const width = Math.max(MIN_WIDTH, Math.round(size.width) || MIN_WIDTH);
  const layout = useMemo(() => computeTimelineLayout(width), [width]);
  // Direkt nach dem Start kann der Intervall-Tick von useCurrentTime noch wenige
  // Millisekunden vor startedAt liegen. Die sichtbare Jetzt-Linie darf dadurch
  // nicht in den gesperrten Bereich vor dem Fallstart geraten.
  const nowValue = endedAt ?? Math.max(now ?? 0, startedAt ?? 0);
  const domain = computeDomain(startedAt, nowValue, undefined, endedAt);
  const scaleDomains = useMemo(
    () => computeVitalScaleDomains(measurements, domain.start, domain.end),
    [measurements, domain.start, domain.end],
  );
  const yScales = useMemo(() => buildYScales(layout, scaleDomains), [layout, scaleDomains]);
  const xScale = useMemo(
    () => buildXScale({ start: domain.start, end: domain.end }, layout),
    [domain.start, domain.end, layout],
  );
  const ticks = useMemo(
    () => relativeTimelineTicks(domain.start, domain.end, layout.plotWidth),
    [domain.start, domain.end, layout.plotWidth],
  );
  const checkpointWarnings = useMemo(
    () => deriveCheckpointWarnings(startedAt, endedAt, nowValue, measurements),
    [startedAt, endedAt, nowValue, measurements],
  );
  const criticalWarnings = useMemo(
    () => criticalSettings ? deriveCriticalWarnings(measurements, criticalSettings.thresholds) : [],
    [criticalSettings, measurements],
  );

  // Position jedes kritischen Warnsymbols. Es weicht allen bedienbaren Messpunkten
  // und NiBP-Griffen aus, damit es niemals einen Wert unklickbar macht.
  const criticalIconRects = useMemo<Record<string, TooltipRect>>(() => {
    const placed: Record<string, TooltipRect> = {};
    // Alle bedienbaren Stellen je Band einsammeln (Punkte und NiBP-Griffe).
    const spotsByBand = new Map<VitalKind, TooltipRect[]>();
    for (const measurement of measurements) {
      const x = timeToX(xScale, measurement.time);
      if (x < layout.plotLeft || x > layout.plotRight) continue;
      const spots = spotsByBand.get(measurement.kind) ?? [];
      if (measurement.kind === "nibp") {
        const meanY = yScales.nibp(measurement.mean);
        spots.push(occupiedSpot(x, meanY));
        spots.push(occupiedSpot(x, measurement.systolic === null ? meanY - 16 : yScales.nibp(measurement.systolic)));
        spots.push(occupiedSpot(x, measurement.diastolic === null ? meanY + 16 : yScales.nibp(measurement.diastolic)));
      } else {
        spots.push(occupiedSpot(x, yScales[measurement.kind](measurement.value)));
      }
      spotsByBand.set(measurement.kind, spots);
    }
    for (const warning of criticalWarnings) {
      const measurement = measurements.find((item) => item.id === warning.measurementId);
      if (!measurement) continue;
      const value = measurement.kind === "nibp" ? measurement.mean : measurement.value;
      const markerX = timeToX(xScale, measurement.time);
      if (markerX < layout.plotLeft || markerX > layout.plotRight) continue;
      const markerY = yScales[measurement.kind](value);
      const band = layout.bandByKind[measurement.kind];
      placed[warning.measurementId] = placeCriticalIcon(
        { x: markerX, y: markerY },
        spotsByBand.get(measurement.kind) ?? [],
        { left: layout.plotLeft, top: band.top + 2, right: layout.plotRight, bottom: band.bottom - 2 },
      );
    }
    return placed;
  }, [criticalWarnings, measurements, xScale, yScales, layout]);

  // Reale Bounding-Boxen aller sichtbaren Warn-Ausrufezeichen (kritisch + Checkpoint).
  // Dieselbe Geometrie wie in den Warn-Ebenen; dient der Tooltip-Kollisionsvermeidung.
  const warningIconRects = useMemo<TooltipRect[]>(() => {
    const rects: TooltipRect[] = Object.values(criticalIconRects);
    for (const warning of checkpointWarnings) {
      const x = timeToX(xScale, warning.time);
      if (x < layout.plotLeft || x > layout.plotRight) continue;
      rects.push(checkpointIconRect(x, layout.plotBottom));
    }
    return rects;
  }, [criticalIconRects, checkpointWarnings, xScale, layout]);

  // §11.F.10: Ist der aktive Checkpoint vollständig dokumentiert (kein Warnhinweis
  // mehr), schließt der Checkpoint-Modus sicher von selbst.
  useEffect(() => {
    if (activeCheckpoint && !checkpointWarnings.some((warning) => warning.time === activeCheckpoint.time)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setActiveCheckpoint(null);
      setSelectedCheckpoint((current) => (current === activeCheckpoint.time ? null : current));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [activeCheckpoint, checkpointWarnings]);

  const scalarsOf = (kind: VitalKind) =>
    measurements.filter((measurement): measurement is ScalarMeasurement => measurement.kind === kind);
  const nibps = measurements.filter((measurement): measurement is NibpMeasurement => measurement.kind === "nibp");

  const lastByKind = useMemo(() => {
    const map: Record<VitalKind, string | null> = { spo2: null, heartRate: null, nibp: null, temperature: null };
    for (const kind of BAND_ORDER) {
      const list = measurements.filter((measurement) => measurement.kind === kind).sort((a, b) => a.time - b.time);
      const last = list[list.length - 1];
      if (!last) continue;
      map[kind] = last.kind === "nibp"
        ? `${last.systolic ?? "–"}/${last.diastolic ?? "–"} (M ${last.mean})`
        : `${formatVitalNumber(kind, last.value)} ${VITAL_CONFIG[kind].unit}`;
    }
    return map;
  }, [measurements]);

  const hitTargets = useMemo<HitTarget[]>(
    () => measurements.map((measurement) => {
      const x = timeToX(xScale, measurement.time);
      if (measurement.kind === "nibp") {
        const scale = yScales.nibp;
        const meanY = scale(measurement.mean);
        return {
          id: measurement.id,
          shape: "nibp" as const,
          x,
          y1: measurement.systolic === null ? meanY - 16 : scale(measurement.systolic),
          y2: measurement.diastolic === null ? meanY + 16 : scale(measurement.diastolic),
          meanY,
        };
      }
      return { id: measurement.id, shape: "point" as const, x, y: yScales[measurement.kind](measurement.value) };
    }),
    [measurements, xScale, yScales],
  );

  const openEdit = (measurement: Measurement, nibpFocus?: "systolic" | "diastolic") => {
    clearPreview();
    setSelectedId(measurement.id);
    setCrosshair(crosshairForMeasurement(measurement, xScale, yScales));
    if (measurement.kind === "nibp") {
      setDraft({
        mode: "edit-nibp",
        id: measurement.id,
        time: measurement.time,
        systolic: measurement.systolic,
        mean: measurement.mean,
        diastolic: measurement.diastolic,
        ...(nibpFocus ? { focusPart: nibpFocus } : {}),
      });
    } else {
      setDraft({
        mode: "edit-scalar",
        id: measurement.id,
        kind: measurement.kind,
        time: measurement.time,
        value: measurement.value,
      });
    }
  };

  const mapPointer = (clientX: number, clientY: number): PointerMapResult => {
    if (startedAt === null || !svgRef.current) return { ok: false, reason: "outside" };
    return mapPointerToTimeline({
      clientX,
      clientY,
      rect: svgRef.current.getBoundingClientRect(),
      layout,
      xScale,
      yScales,
      startedAt,
      now: nowValue,
      endedAt,
    });
  };

  const showTimeError = (error: TimelineTimeError) => {
    if (error === "future") message.warning("Zukünftige Werte können nicht dokumentiert werden.");
    if (error === "beforeStart") message.warning("Werte vor dem Start können nicht dokumentiert werden.");
    if (error === "afterEnd") {
      message.error("Nach dem Ende des Eingriffs können keine neuen Einträge dokumentiert werden.");
    }
  };

  const intervalAtPointer = (clientX: number, clientY: number, locked: boolean): IntervalTooltipState | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clampValue(clientX - rect.left, layout.plotLeft, layout.plotRight);
    const y = clampValue(clientY - rect.top, layout.plotTop, layout.plotBottom);
    const time = xToTime(xScale, x);
    const items = therapyIntervalsAtTime(time, medications, infusions, nowValue, endedAt);
    return items.length > 0 ? { items, x, y, locked } : null;
  };

  const openCreate = (mapped: CursorMap) => {
    if (!mapped.ok) {
      showTimeError(mapped.reason);
      setCrosshair({ ...mapped, locked: false });
      return;
    }
    clearPreview();
    setSelectedId(null);
    setCrosshair({ ...mapped, locked: true });
    if (mapped.kind === "nibp") {
      setDraft({ mode: "create-nibp", time: mapped.time, mean: mapped.pointerValue });
    } else {
      setDraft({ mode: "create-scalar", kind: mapped.kind, time: mapped.time, value: mapped.pointerValue });
    }
  };

  const openCheckpointBand = (kind: VitalKind, time: number, clientY?: number) => {
    const band = layout.bandByKind[kind];
    const rect = svgRef.current?.getBoundingClientRect();
    const svgY = clientY !== undefined && rect
      ? clampValue(clientY - rect.top, band.innerTop, band.innerBottom)
      : (band.innerTop + band.innerBottom) / 2;
    const pointerValue = normalizeVitalPointerValue(kind, yScales[kind].invert(svgY));
    clearPreview();
    setSelectedCheckpoint(time);
    setCrosshair({
      ok: true,
      kind,
      time,
      value: kind === "nibp" ? null : pointerValue,
      pointerValue,
      svgX: timeToX(xScale, time),
      svgY,
      locked: true,
    });
    if (kind === "nibp") setDraft({ mode: "create-nibp", time, mean: pointerValue });
    else setDraft({ mode: "create-scalar", kind, time, value: pointerValue });
  };

  // ---- Checkpoint-Eingabemodus (§11) ----
  // Ausrufezeichen tippen schaltet den Modus um. X ist dann auf die Kontrollzeit
  // fixiert; der Stift legt nur den Y-Wert fest, ohne Drawer.
  const toggleCheckpointMode = (time: number) => {
    if (activeCheckpoint && activeCheckpoint.time === time) {
      const draft = activeCheckpoint.nibpDraft;
      const hasRecord = nibps.some((measurement) => measurement.time === time);
      if (draft && !hasRecord && (draft.systolic !== null || draft.mean !== null || draft.diastolic !== null)) {
        message.info("Der Blutdruck dieser Kontrollzeit ist noch unvollständig und wurde nicht gespeichert.");
      }
      setActiveCheckpoint(null);
      setSelectedCheckpoint(null);
      setCrosshair(null);
      return;
    }
    clearPreview();
    setCrosshair(null);
    setDraft(null);
    setActiveCheckpoint({ time, nibpComponent: "mean", nibpDraft: null });
    setSelectedCheckpoint(time);
  };

  // Y-Wert aus der Stiftposition; X bleibt auf der Kontrollzeit. Gibt den
  // normalisierten Wert zurück (für das Speichern beim Loslassen).
  const checkpointCrosshairAt = (kind: VitalKind, clientX: number, clientY: number, time: number): number => {
    const band = layout.bandByKind[kind];
    const point = clientToSvgPoint(svgRef.current, clientX, clientY);
    const svgY = clampValue(point.y, band.innerTop, band.innerBottom);
    const [min, max] = yScales[kind].domain();
    const value = normalizeVitalPointerValue(kind, clampValue(yScales[kind].invert(svgY), min, max));
    setCrosshair({
      ok: true,
      kind,
      time,
      value: kind === "nibp" ? null : value,
      pointerValue: value,
      svgX: timeToX(xScale, time),
      svgY: yScales[kind](value),
      locked: true,
    });
    return value;
  };

  const saveCheckpointScalar = (kind: VitalKind, value: number) => {
    if (!activeCheckpoint || kind === "nibp") return;
    try {
      addMeasurement({ kind, time: activeCheckpoint.time, value });
    } catch {
      message.warning("Der SpO₂-Wert muss zwischen 0 und 100 % liegen.");
    }
  };

  // Setzt genau eine NIBP-Komponente an der Kontrollzeit. Kein Wert wird erfunden:
  // solange kein Mittel vorliegt, bleiben die Werte ein Entwurf (Ghost). Sobald ein
  // Mittel gesetzt ist, entsteht eine echte Messung; fehlende Endpunkte bleiben null.
  const saveCheckpointNibpComponent = (rawValue: number) => {
    if (!activeCheckpoint) return;
    const time = activeCheckpoint.time;
    const component = activeCheckpoint.nibpComponent;
    const existing = nibps.find((measurement) => measurement.time === time);
    const base = activeCheckpoint.nibpDraft ?? {
      systolic: existing?.systolic ?? null,
      mean: existing?.mean ?? null,
      diastolic: existing?.diastolic ?? null,
    };
    const [min, max] = yScales.nibp.domain();
    const draft = { ...base };
    if (component === "mean") {
      draft.mean = clampMean(rawValue, base.systolic, base.diastolic, min, max);
    } else if (typeof base.mean === "number") {
      draft[component] = component === "systolic"
        ? clampSystolic(rawValue, base.mean, min, max)
        : clampDiastolic(rawValue, base.mean, min, max);
    } else {
      // Ohne Mittel noch keine Reihenfolge erzwingbar – Rohwert als Entwurf halten.
      draft[component] = Math.round(rawValue);
    }
    if (typeof draft.mean === "number") {
      addMeasurement({ kind: "nibp", time, systolic: draft.systolic, mean: draft.mean, diastolic: draft.diastolic });
      setActiveCheckpoint({ ...activeCheckpoint, nibpDraft: null });
    } else {
      setActiveCheckpoint({ ...activeCheckpoint, nibpDraft: draft });
    }
  };

  // "Anwendung beenden": beendet die laufende Therapie SOFORT zur aktuellen Zeit.
  // Der Endmarker steht damit fest; spätere Berührungen an anderer Stelle in den
  // Lanes verschieben ihn nicht mehr (§5). Nur ein gezielter Drag am Endgriff ändert ihn.
  const finishTherapyNow = (
    kind: "medication" | "infusion",
    entry: MedicationEntry | InfusionEntry,
  ) => {
    const time = maxDocumentableTime(nowValue, endedAt);
    if (updateTherapyEnd(kind, entry.id, time)) message.success("Anwendung beendet.");
    else message.error("Das Ende muss nach dem Beginn liegen.");
  };

  // Beginnt einen gezielten Drag am Endgriff. Diese Vorschau ist rein lokal für den
  // Marker und wird niemals durch Berührungen in den Lanes oder im Plot übernommen.
  const beginEndDrag = (
    kind: "medication" | "infusion",
    entry: MedicationEntry | InfusionEntry,
  ) => {
    const placement = {
      kind,
      id: entry.id,
      previewTime: entry.endedAt ?? maxDocumentableTime(nowValue, endedAt),
    };
    therapyEndPlacementRef.current = placement;
    setTherapyEndPlacement(placement);
  };

  const previewTherapyEnd = (time: number) => {
    const current = therapyEndPlacementRef.current;
    if (!current) return;
    const next = { ...current, previewTime: time };
    therapyEndPlacementRef.current = next;
    setTherapyEndPlacement(next);
  };

  const commitTherapyEnd = (time: number) => {
    const current = therapyEndPlacementRef.current;
    if (!current) return;
    const saved = updateTherapyEnd(current.kind, current.id, time);
    if (saved) {
      message.success("Endzeit gespeichert.");
      therapyEndPlacementRef.current = null;
      setTherapyEndPlacement(null);
    } else {
      message.error("Das Ende muss nach dem Beginn liegen.");
    }
  };

  const onScalarDragMove = (measurement: ScalarMeasurement, clientX: number, clientY: number) => {
    if (!svgRef.current || startedAt === null) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = clampValue(clientX - rect.left, layout.plotLeft, layout.plotRight);
    const svgY = clientY - rect.top;
    const upperTime = maxDocumentableTime(nowValue, endedAt);
    const time = clampValue(xToTime(xScale, svgX), startedAt, upperTime);
    const config = VITAL_CONFIG[measurement.kind];
    const [domainMin, domainMax] = yScales[measurement.kind].domain();
    const value = roundToPrecision(
      clampValue(yScales[measurement.kind].invert(svgY), domainMin, domainMax),
      config.precision,
    );
    setDragPreview({ id: measurement.id, kind: measurement.kind, time, value });
    setCrosshair({
      ok: true,
      kind: measurement.kind,
      time,
      value,
      pointerValue: value,
      svgX,
      svgY: yScales[measurement.kind](value),
      locked: true,
    });
  };

  const finishScalarDrag = (measurement: ScalarMeasurement) => {
    if (dragPreview?.id === measurement.id) {
      updateScalar(measurement.id, dragPreview.time, dragPreview.value);
    }
    setDragPreview(null);
  };

  const resetPointer = () => {
    pointerRef.current = { ...EMPTY_POINTER };
  };

  // Legt eine fluechtige Vital-Vorschau ab (Stift/Finger, erster Kontakt). Kein
  // Formular, keine Persistenz – nur ein gestrichelter Marker mit Koordinate.
  const pinVitalPreview = (mapped: CursorMap, pointerType: string) => {
    const config = VITAL_CONFIG[mapped.kind];
    setPreview({
      kind: "vital",
      pointerType,
      band: mapped.kind,
      lane: null,
      eventType: null,
      time: mapped.time,
      value: mapped.pointerValue,
      unit: config.unit,
      svgX: mapped.svgX,
      svgY: mapped.svgY,
    });
  };

  // Zweiter Kontakt auf einer abgelegten Vital-Vorschau: oeffnet das Formular mit
  // der exakten Zeit und dem Wert der Vorschau (nicht der zweiten Klickposition).
  const openCreateFromVitalPreview = () => {
    if (!preview || preview.kind !== "vital" || !preview.band) return;
    const band = preview.band;
    const value = preview.value ?? 0;
    openCreate({
      ok: true,
      kind: band,
      time: preview.time,
      value: band === "nibp" ? null : value,
      pointerValue: value,
      svgX: timeToX(xScale, preview.time),
      svgY: yScales[band](value),
    });
  };

  const onPlotPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (startedAt === null) {
      message.info("Bitte starten Sie zuerst den Fall.");
      return;
    }
    // Checkpoint-Modus: der Kontakt legt direkt den Y-Wert des getroffenen Bandes fest.
    if (activeCheckpoint) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const band = bandAtY(layout, event.clientY - rect.top);
      if (!band) return;
      checkpointDrag.current = { active: true, pointerId: event.pointerId, kind: band.kind };
      if (usesTwoPhase(event.pointerType)) {
        setInteractionActive(true);
        if (typeof window !== "undefined") window.getSelection?.()?.removeAllRanges?.();
      }
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      checkpointCrosshairAt(band.kind, event.clientX, event.clientY, activeCheckpoint.time);
      return;
    }
    const twoPhase = usesTwoPhase(event.pointerType);
    if (twoPhase) {
      setInteractionActive(true);
      // Kein Textauswahl-/Kopieren-Effekt beim Zeichnen mit Stift/Finger.
      if (typeof window !== "undefined") window.getSelection?.()?.removeAllRanges?.();
    }
    setSelectedCheckpoint(null);
    const mapped = mapPointer(event.clientX, event.clientY);
    const rect = svgRef.current?.getBoundingClientRect();
    const hit = rect
      ? findNearestHit(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          hitTargets,
          event.pointerType,
        )
      : null;
    const target = hit ? measurements.find((measurement) => measurement.id === hit.id) : null;
    // Bestätigt dieser Kontakt die bestehende Vorschau? Nur wenn Stift/Finger, kein
    // Treffer auf einen echten Messwert und der Kontakt im Trefferkreis der Vorschau.
    const confirming = twoPhase && !target && "svgX" in mapped
      ? isPreviewConfirmHit(
          preview,
          { kind: "vital", band: mapped.kind, lane: null, svgX: mapped.svgX, svgY: mapped.svgY },
          PREVIEW_HIT_RADIUS_PX,
          Date.now(),
        )
      : false;
    // Neue (nicht bestätigende) Stift-/Finger-Geste: alte Vorschau SOFORT entfernen,
    // damit nie zwei Vorschauen gleichzeitig sichtbar sind.
    if (twoPhase && !confirming) clearPreview();
    // Auf dem iPad folgt die Koordinate erst dem Kontakt (locked: false); die Maus
    // behaelt ihre sofort fixierte Vorschau.
    if ("svgX" in mapped) setCrosshair({ ...mapped, locked: !twoPhase });
    pointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      dragging: false,
      targetId: hit?.id ?? null,
      confirming,
    };
    // Skalar-Drag (alle Zeiger) oder eine Stift-/Finger-Vorschaugeste benoetigen
    // Pointer-Capture, damit Move/Up zuverlaessig auf der Grafik ankommen.
    if ((target && target.kind !== "nibp") || twoPhase) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no capture */ }
    }
  };

  const onPlotPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const state = pointerRef.current;
    if (checkpointDrag.current.active && checkpointDrag.current.pointerId === event.pointerId && activeCheckpoint) {
      if (checkpointDrag.current.kind) checkpointCrosshairAt(checkpointDrag.current.kind, event.clientX, event.clientY, activeCheckpoint.time);
      return;
    }
    // Ein laufender Endgriff-Drag wird ausschließlich vom Marker selbst gesteuert.
    if (therapyEndPlacement) return;
    if (!state.active || state.pointerId !== event.pointerId) {
      if ((event.pointerType === "mouse" || event.pointerType === "pen") && !draft && !therapyDraft && !preview) {
        const mapped = mapPointer(event.clientX, event.clientY);
        setCrosshair("svgX" in mapped ? { ...mapped, locked: false } : null);
        setIntervalTooltip(intervalAtPointer(event.clientX, event.clientY, false));
      }
      return;
    }
    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (distance > DRAG_THRESHOLD_PX) state.moved = true;
    const target = state.targetId
      ? measurements.find((measurement): measurement is ScalarMeasurement =>
          measurement.id === state.targetId && measurement.kind !== "nibp",
        )
      : null;
    // Ein ausgewählter (schwarz umrandeter) Punkt folgt dem Stift überall im Plot.
    const armed = armedMeasurementId
      ? measurements.find((measurement): measurement is ScalarMeasurement =>
          measurement.id === armedMeasurementId && measurement.kind !== "nibp",
        )
      : null;
    if (armed && usesTwoPhase(event.pointerType)) {
      state.dragging = true;
      onScalarDragMove(armed, event.clientX, event.clientY);
      return;
    }
    // Stift/Finger verschieben einen Punkt nur, wenn er zuvor ausgewählt wurde.
    if (target && state.moved && !usesTwoPhase(event.pointerType)) {
      state.dragging = true;
      onScalarDragMove(target, event.clientX, event.clientY);
      return;
    }
    // Stift/Finger auf freier Flaeche: die Koordinate folgt dem Kontakt live.
    // Während einer Bestätigungsgeste bleibt die abgelegte Vorschau maßgeblich.
    if (!state.targetId && !state.confirming && usesTwoPhase(event.pointerType)) {
      const mapped = mapPointer(event.clientX, event.clientY);
      setCrosshair("svgX" in mapped ? { ...mapped, locked: false } : null);
      // §3: Beim Ziehen mit dem Stift über die Grafik bleiben aktive Medikamente
      // und Infusionen dieser Zeit sichtbar – nicht nur beim Maus-Hover.
      setIntervalTooltip(intervalAtPointer(event.clientX, event.clientY, false));
    }
  };

  const onSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (pointerRef.current.active || checkpointDrag.current.active || activeCheckpoint || draft || therapyDraft || therapyEndPlacementRef.current || preview) return;
    const mapped = mapPointer(event.clientX, event.clientY);
    setCrosshair("svgX" in mapped ? { ...mapped, locked: false } : null);
    setIntervalTooltip(intervalAtPointer(event.clientX, event.clientY, false));
  };

  const onPlotPointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    if (checkpointDrag.current.active && checkpointDrag.current.pointerId === event.pointerId) {
      const kind = checkpointDrag.current.kind;
      const value = kind && activeCheckpoint ? checkpointCrosshairAt(kind, event.clientX, event.clientY, activeCheckpoint.time) : null;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      checkpointDrag.current = { active: false, pointerId: -1, kind: null };
      setInteractionActive(false);
      if (kind && value !== null) {
        if (kind === "nibp") saveCheckpointNibpComponent(value);
        else saveCheckpointScalar(kind, value);
      }
      setCrosshair(null);
      return;
    }
    const state = pointerRef.current;
    const twoPhase = usesTwoPhase(event.pointerType);
    const finish = () => {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      resetPointer();
      if (twoPhase) setInteractionActive(false);
    };
    if (!state.active || state.pointerId !== event.pointerId) {
      if (twoPhase) setInteractionActive(false);
      return;
    }
    const target = state.targetId ? measurements.find((measurement) => measurement.id === state.targetId) : null;
    // Finger-Tap auf ein bestehendes Therapie-Intervall: Tooltip statt Vorschau.
    if (!state.moved && !target && event.pointerType === "touch") {
      const touchedInterval = intervalAtPointer(event.clientX, event.clientY, true);
      if (touchedInterval && !intervalTooltip?.locked) {
        setIntervalTooltip(touchedInterval);
        finish();
        return;
      }
      if (!touchedInterval) setIntervalTooltip(null);
    }
    // Stift/Finger: der ausgewählte Punkt wurde verschoben -> jetzt speichern.
    const armedTarget = armedMeasurementId
      ? measurements.find((measurement): measurement is ScalarMeasurement =>
          measurement.id === armedMeasurementId && measurement.kind !== "nibp",
        )
      : null;
    if (twoPhase && armedTarget) {
      // Erneuter Tipp auf den ausgewählten Punkt hebt die Auswahl auf: der Wert
      // bleibt danach fest, auch wenn der Stift darüber hinwegzieht.
      if (!state.moved && target && target.id === armedTarget.id) {
        setDragPreview(null);
        setArmedMeasurementId(null);
        finish();
        return;
      }
      if (state.dragging || state.moved) finishScalarDrag(armedTarget);
      finish();
      return;
    }
    if (state.dragging && target && target.kind !== "nibp") {
      finishScalarDrag(target);
      finish();
      return;
    }
    if (target && !state.moved) {
      // iPad: erst auswählen (schwarzer Ring), dann folgt der Punkt dem Stift.
      // Maus/Desktop: unverändert direkt bearbeiten.
      if (twoPhase && target.kind !== "nibp") setArmedMeasurementId(target.id);
      else openEdit(target);
      finish();
      return;
    }
    if (!target) {
      const mapped = mapPointer(event.clientX, event.clientY);
      if (!("svgX" in mapped)) { finish(); return; }
      if (!twoPhase) {
        // Maus/Desktop: ein Tap ohne Bewegung legt sofort an (unveraendertes Verhalten).
        if (!state.moved) openCreate(mapped);
        finish();
        return;
      }
      // Stift/Finger: bestätigt dieser Kontakt die (beim pointerdown erkannte)
      // Vorschau, öffnet er das Formular; sonst legt er eine neue Vorschau ab.
      if (state.confirming && preview) {
        openCreateFromVitalPreview();
        finish();
        return;
      }
      if (!mapped.ok) {
        showTimeError(mapped.reason);
        clearPreview();
        setCrosshair({ ...mapped, locked: false });
        finish();
        return;
      }
      pinVitalPreview(mapped, event.pointerType);
      setCrosshair(null);
      finish();
      return;
    }
    finish();
  };

  const onPlotPointerCancel = () => {
    setDragPreview(null);
    setIntervalTooltip(null);
    if (checkpointDrag.current.active) {
      checkpointDrag.current = { active: false, pointerId: -1, kind: null };
      setCrosshair(null);
    }
    if (therapyEndPlacement) {
      therapyEndPlacementRef.current = null;
      setTherapyEndPlacement(null);
    }
    resetPointer();
    setInteractionActive(false);
  };

  // Safari kann die Capture mitten im Vorgang verlieren. Ein laufender Skalar-Drag
  // wird sicher abgeschlossen; danach werden Vorgang und Scroll-Sperre freigegeben,
  // damit die Seite nie in gesperrtem Zustand hängen bleibt.
  const onPlotLostPointerCapture = () => {
    if (checkpointDrag.current.active) {
      checkpointDrag.current = { active: false, pointerId: -1, kind: null };
      setCrosshair(null);
      setInteractionActive(false);
      return;
    }
    const state = pointerRef.current;
    if (state.active && state.dragging && state.targetId) {
      const target = measurements.find(
        (measurement): measurement is ScalarMeasurement => measurement.id === state.targetId && measurement.kind !== "nibp",
      );
      if (target) finishScalarDrag(target);
    }
    setDragPreview(null);
    resetPointer();
    setInteractionActive(false);
  };

  const closeVitalDraft = () => {
    setDraft(null);
    setSelectedId(null);
    setCrosshair(null);
    setIntervalTooltip(null);
  };
  const openTherapyDraft = (next: TherapyDraft) => {
    clearPreview();
    setCrosshair(null);
    setIntervalTooltip(null);
    setLanePreview(null);
    setTherapyDraft(next);
  };

  // Platziert ein Ereignis. Pflichtereignisse (nicht "extra") duerfen nicht
  // dupliziert werden – existiert bereits eines, wird stattdessen bearbeitet.
  const placeEvent = (eventType: TimelineEventType, time: number) => {
    if (eventType === "extra") {
      openTherapyDraft({ mode: "create-event", eventType, time });
      return;
    }
    const existing = events.find((item) => item.eventType === eventType);
    if (existing) {
      setLanePreview(null);
      message.info("Dieses Ereignis existiert bereits und wird bearbeitet.");
      openTherapyDraft({ mode: "edit-event", entry: existing });
      return;
    }
    upsertEvent(eventType, time);
    setLanePreview(null);
    message.success("Ereignis platziert.");
  };

  // Lane-Kontakt beginnt: bestätigt er die bestehende Vorschau (Kreis-Treffer),
  // bleibt sie erhalten; sonst wird die alte Vorschau SOFORT entfernt.
  const handleLaneTwoPhaseDown = (info: {
    kind: "medication" | "infusion" | "event";
    svgX: number;
    svgY: number;
  }) => {
    const confirm = isPreviewConfirmHit(
      preview,
      { kind: info.kind, band: null, lane: info.kind, svgX: info.svgX, svgY: info.svgY },
      PREVIEW_HIT_RADIUS_PX,
      Date.now(),
    );
    laneConfirmRef.current = confirm;
    if (!confirm) clearPreview();
  };

  // Lane-Kontakt endet: bestätigt er die Vorschau, öffnet er das passende Formular
  // mit dem in der Vorschau gespeicherten Zeitstempel (nie aus der zweiten Position).
  const handleLaneTwoPhaseTap = (info: {
    kind: "medication" | "infusion" | "event";
    time: number;
    svgX: number;
    svgY: number;
    pointerType: string;
    eventType?: TimelineEventType;
  }) => {
    if (laneConfirmRef.current && preview) {
      const time = preview.time;
      const eventType = preview.eventType;
      laneConfirmRef.current = false;
      clearPreview();
      if (info.kind === "medication") openTherapyDraft({ mode: "create-medication", startedAt: time });
      else if (info.kind === "infusion") openTherapyDraft({ mode: "create-infusion", startedAt: time });
      else if (eventType) placeEvent(eventType, time);
      return;
    }
    laneConfirmRef.current = false;
    setPreview({
      kind: info.kind,
      pointerType: info.pointerType,
      band: null,
      lane: info.kind,
      eventType: info.eventType ?? null,
      time: info.time,
      value: null,
      unit: null,
      svgX: info.svgX,
      svgY: info.svgY,
    });
  };

  const ctx: BandContext = {
    layout,
    xScale,
    yScales,
    startedAt: startedAt ?? nowValue,
    now: nowValue,
    selectedId,
    dragPreview,
    pointerTime: crosshair?.time ?? null,
    armedId: armedMeasurementId,
    onPointTap: openEdit,
    onScalarDragMove,
    onScalarDragEnd: finishScalarDrag,
    onScalarDragCancel: () => setDragPreview(null),
  };

  const showData = startedAt !== null;
  // §4: Koordinate, Warnhinweis und Therapie-Info werden gemeinsam kollisionsfrei
  // platziert – in dieser Reihenfolge, damit die Koordinate immer am Zeiger bleibt.
  const crosshairTip = crosshair ? crosshairTooltipRect(crosshair, layout, warningIconRects) : null;
  // Warnhinweis der Zeit unter dem Zeiger (Kontrollzeit und/oder kritischer Wert).
  const warningInfo = crosshair ? warningInfoAt(crosshair, checkpointWarnings, criticalWarnings, measurements, xScale, yScales, criticalIconRects) : null;
  const warningTip = warningInfo
    ? placeTooltipAvoidingAll(
        { x: crosshair!.svgX, y: crosshair!.svgY },
        { width: 250, height: 16 + warningInfo.lines.length * 13 },
        { left: layout.plotLeft, top: layout.plotTop, right: layout.plotRight, bottom: layout.plotBottom },
        [...warningIconRects, ...(crosshairTip ? [crosshairTip] : [])],
      )
    : null;
  const therapyTip = intervalTooltip
    ? placeTooltipAvoidingAll(
        { x: intervalTooltip.x, y: intervalTooltip.y },
        therapyTooltipSize(intervalTooltip.items.length),
        therapyTooltipBounds(layout),
        [...warningIconRects, ...(crosshairTip ? [crosshairTip] : []), ...(warningTip ? [warningTip] : [])],
      )
    : null;

  return (
    <>
      {criticalSettings ? (
        <CriticalValuesPanel
          settings={criticalSettings}
          birthDate={patientBirthDate}
          onChange={setCriticalSettings}
        />
      ) : null}
      <div ref={containerRef} className="timeline-surface" data-testid="vital-timeline">
        {now === null ? <div style={{ height: layout.height }} /> : (
          <svg
            ref={svgRef}
            width={width}
            height={layout.height}
            viewBox={`0 0 ${width} ${layout.height}`}
            role="group"
            aria-label="Gemeinsame Zeitgrafik für Therapien, Ereignisse und Vitalparameter"
            data-testid="vital-timeline-svg"
            style={{ touchAction: "pan-y", display: "block" }}
            onPointerMove={onSvgPointerMove}
            // Kein Kontextmenü / kein Drag-Ghost / keine blaue Auswahl auf der Grafik.
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onPointerDownCapture={(event) => {
              if (event.pointerType !== "mouse" && typeof window !== "undefined") {
                window.getSelection?.()?.removeAllRanges?.();
              }
            }}
            onPointerLeave={() => {
              if (!crosshair?.locked && !draft) setCrosshair(null);
              if (!intervalTooltip?.locked) setIntervalTooltip(null);
            }}
          >
            <TherapyLaneBackgrounds layout={layout} />
            {layout.bands.map((band) => (
              <VitalBandBackground key={band.kind} band={band} layout={layout} yScale={yScales[band.kind]} scaleDomain={scaleDomains[band.kind]} lastValueText={lastByKind[band.kind]} />
            ))}
            <TimeGrid layout={layout} xScale={xScale} majorTicks={ticks.major} minorTicks={ticks.minor} />
            <TherapyDurationLayer layout={layout} xScale={xScale} now={nowValue} endedAt={endedAt} medications={medications} infusions={infusions} />
            {startedAt !== null ? (
              <TherapyLaneInteractionLayer
                layout={layout}
                xScale={xScale}
                startedAt={startedAt}
                endedAt={endedAt}
                now={nowValue}
                selectedEvent={selectedEventType}
                preview={lanePreview}
                onPreview={setLanePreview}
                onCreateMedication={(time) => openTherapyDraft({ mode: "create-medication", startedAt: time })}
                onCreateInfusion={(time) => openTherapyDraft({ mode: "create-infusion", startedAt: time })}
                onPlaceEvent={placeEvent}
                onTwoPhaseTap={handleLaneTwoPhaseTap}
                onTwoPhaseDown={handleLaneTwoPhaseDown}
                onInteractionActive={setInteractionActive}
                onInvalid={showTimeError}
                onMissingEvent={() => message.warning("Bitte zuerst links ein Ereignissymbol auswählen.")}
              />
            ) : null}
            <EventLaneTools
              layout={layout}
              // Auch nach "Eingriff beenden" lassen sich Phasen und Ereignisse
              // nachtragen – sie werden häufig erst im Nachhinein dokumentiert.
              disabled={startedAt === null}
              selected={selectedEventType}
              onSelect={(eventType) => {
                setSelectedEventType((current) => toggleEventSelection(current, eventType));
                setLanePreview(null);
              }}
            />

            {showData ? (
              <>
                <Spo2Band measurements={scalarsOf("spo2")} ctx={ctx} />
                <LineBand kind="heartRate" measurements={scalarsOf("heartRate")} ctx={ctx} testId="series-heartRate" />
                <NibpBand measurements={nibps} ctx={ctx} />
                <LineBand kind="temperature" measurements={scalarsOf("temperature")} ctx={ctx} testId="series-temperature" />
              </>
            ) : null}

            <rect
              x={layout.plotLeft}
              y={layout.plotTop}
              width={layout.plotWidth}
              height={layout.plotBottom - layout.plotTop}
              fill="transparent"
              data-testid="timeline-create-area"
              // touch-action: none -> eine Stift-/Finger-Geste, die auf der Grafik
              // beginnt, scrollt die Seite nicht. Gescrollt wird ueber die Ränder
              // links (Gutter) und die Bereiche ausserhalb der Grafik.
              style={{ touchAction: "none", cursor: startedAt === null ? "not-allowed" : "crosshair" }}
              onPointerDown={onPlotPointerDown}
              onPointerMove={onPlotPointerMove}
              onPointerUp={onPlotPointerUp}
              onPointerCancel={onPlotPointerCancel}
              onLostPointerCapture={onPlotLostPointerCapture}
              onPointerLeave={() => {
                if (!crosshair?.locked && !draft) setCrosshair(null);
                if (!intervalTooltip?.locked) setIntervalTooltip(null);
              }}
            />

            {showData ? (
              <>
                <CheckpointWarningLayer
                  warnings={checkpointWarnings}
                  layout={layout}
                  xScale={xScale}
                  selectedTime={selectedCheckpoint}
                  interactionDisabled={therapyEndPlacement !== null}
                  checkpointModeTime={activeCheckpoint?.time ?? null}
                  onToggleMode={toggleCheckpointMode}
                  onOpenBand={openCheckpointBand}
                />
                {activeCheckpoint ? (
                  <NibpComponentPicker
                    layout={layout}
                    selected={activeCheckpoint.nibpComponent}
                    filled={nibpFilledComponents(nibps, activeCheckpoint)}
                    onSelect={(component) => setActiveCheckpoint((current) => (current ? { ...current, nibpComponent: component } : current))}
                  />
                ) : null}
                {/* Warnsymbole liegen UNTER den Griffen/Punkten: sie duerfen das
                    Antippen eines Messwerts (z. B. Systolisch) nie blockieren. */}
                <CriticalWarningLayer
                  warnings={criticalWarnings}
                  measurements={measurements}
                  layout={layout}
                  xScale={xScale}
                  yScales={yScales}
                  iconRects={criticalIconRects}
                />
                <NibpHandleLayer
                  measurements={nibps}
                  ctx={ctx}
                  onUpdate={updateNibp}
                  onEdit={(measurement, part) => openEdit(measurement, part)}
                />
                <TherapyMarkerLayer
                  layout={layout}
                  xScale={xScale}
                  now={nowValue}
                  endedAt={endedAt}
                  medications={medications}
                  infusions={infusions}
                  events={events}
                  minTime={startedAt}
                  maxTime={maxDocumentableTime(nowValue, endedAt)}
                  getSvgRect={() => svgRef.current?.getBoundingClientRect() ?? null}
                  onEditMedication={(entry) => openTherapyDraft({ mode: "edit-medication", entry })}
                  onEditInfusion={(entry) => openTherapyDraft({ mode: "edit-infusion", entry })}
                  onEditEvent={(entry) => openTherapyDraft({ mode: "edit-event", entry })}
                  onCommitEventTime={updateEventTime}
                  selectedEnd={therapyEndPlacement}
                  onFinishNow={finishTherapyNow}
                  onBeginEndDrag={beginEndDrag}
                  onPreviewEnd={previewTherapyEnd}
                  onCommitEnd={commitTherapyEnd}
                  onCancelEnd={() => {
                    therapyEndPlacementRef.current = null;
                    setTherapyEndPlacement(null);
                  }}
                />
                <CurrentTimeIndicator layout={layout} xScale={xScale} startedAt={startedAt} now={nowValue} />
              </>
            ) : null}
            {intervalTooltip ? (
              <TherapyIntervalTooltip
                items={intervalTooltip.items}
                x={intervalTooltip.x}
                y={intervalTooltip.y}
                layout={layout}
                placedRect={therapyTip}
              />
            ) : null}
            <CrosshairLayer crosshair={crosshair} layout={layout} tooltipRect={crosshairTip} />
            {warningInfo && warningTip ? (
              <g pointerEvents="none" data-testid="warning-info">
                <rect x={warningTip.x} y={warningTip.y} width={warningTip.width} height={warningTip.height} rx={6} className="warning-info-box" />
                {warningInfo.lines.map((line, index) => (
                  <text key={line} x={warningTip.x + 8} y={warningTip.y + 13 + index * 13} className="warning-info-text">{line}</text>
                ))}
              </g>
            ) : null}
            {/* §2: Solange eine Lane eine Live-Vorschau zeichnet, wird die abgelegte
                Vorschau nicht gerendert. Zusammen mit dem synchronen Löschen beim
                pointerdown ist damit nie mehr als eine Vorschau gleichzeitig sichtbar. */}
            <TimelinePreviewLayer preview={interactionActive && lanePreview ? null : preview} layout={layout} xScale={xScale} yScales={yScales} />
            {renderDraftPreview(draft, xScale, yScales)}
          </svg>
        )}
      </div>
      <VitalEntryDrawer draft={draft} onClose={closeVitalDraft} />
      <TherapyEntryDrawer draft={therapyDraft} onClose={() => setTherapyDraft(null)} />
    </>
  );
}

function crosshairForMeasurement(
  measurement: Measurement,
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
): CrosshairState {
  const pointerValue = measurement.kind === "nibp" ? measurement.mean : measurement.value;
  return {
    ok: true,
    kind: measurement.kind,
    time: measurement.time,
    value: measurement.kind === "nibp" ? null : measurement.value,
    pointerValue,
    svgX: timeToX(xScale, measurement.time),
    svgY: yScales[measurement.kind](pointerValue),
    locked: true,
  };
}

const WARNING_INFO_MAX_DISTANCE_PX = 22;
// Kritischer Hinweis nur exakt am Messwert (bzw. auf dem Warnsymbol).
const CRITICAL_HINT_HIT_PX = 10;

/**
 * §4: Bedeutung der Warnung an der Zeigerposition – Kontrollzeit-Hinweis und/oder
 * kritischer Messwert. Wird zusammen mit Koordinate und Therapie-Info angezeigt,
 * damit alle drei Informationen gleichzeitig lesbar sind.
 */
function warningInfoAt(
  crosshair: CrosshairState,
  checkpointWarnings: ReturnType<typeof deriveCheckpointWarnings>,
  criticalWarnings: ReturnType<typeof deriveCriticalWarnings>,
  measurements: Measurement[],
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
  iconRects: Record<string, TooltipRect>,
): { lines: string[] } | null {
  const lines: string[] = [];
  const nearCheckpoint = checkpointWarnings.find(
    (warning) => Math.abs(timeToX(xScale, warning.time) - crosshair.svgX) <= WARNING_INFO_MAX_DISTANCE_PX,
  );
  if (nearCheckpoint) {
    lines.push(`Kontrollzeit ${formatClock(nearCheckpoint.time)}`);
    for (const part of checkpointTooltip(nearCheckpoint).split("\n")) lines.push(part);
  }
  // Kritischer Hinweis erscheint NUR direkt auf dem auslösenden Messwert bzw. auf
  // dessen Warnsymbol – nicht schon, wenn der Stift in der Nähe vorbeizieht.
  for (const warning of criticalWarnings) {
    const measurement = measurements.find((item) => item.id === warning.measurementId);
    if (!measurement || measurement.kind !== crosshair.kind) continue;
    const markerX = timeToX(xScale, measurement.time);
    const markerY = yScales[measurement.kind](measurement.kind === "nibp" ? measurement.mean : measurement.value);
    const onMarker = Math.hypot(markerX - crosshair.svgX, markerY - crosshair.svgY) <= CRITICAL_HINT_HIT_PX;
    const icon = iconRects[warning.measurementId];
    const onIcon = icon !== undefined
      && crosshair.svgX >= icon.x && crosshair.svgX <= icon.x + icon.width
      && crosshair.svgY >= icon.y && crosshair.svgY <= icon.y + icon.height;
    if (!onMarker && !onIcon) continue;
    lines.push("Kritischer Hinweis:");
    for (const reason of warning.reasons) lines.push(`• ${reason}`);
  }
  if (lines.length === 0) return null;
  // Kompakt halten: höchstens vier Zeilen, sonst wird die Box zu groß.
  return { lines: lines.slice(0, 4).map((line) => (line.length > 46 ? `${line.slice(0, 45)}…` : line)) };
}

// Kollisionsbewusste Position des Koordinaten-Tooltips: bleibt im Band, meidet die
// übergebenen Warn-Icon-Boxen (rechts→links kippen, dann vertikaler Versatz).
function crosshairTooltipRect(crosshair: CrosshairState, layout: BandContext["layout"], avoid: TooltipRect[]): TooltipRect {
  const width = 214;
  const height = crosshair.ok ? 28 : 43;
  // Bevorzugt nahe am Zeiger im eigenen Band; bei Kollision mit einem Warn-Icon
  // darf der Tooltip innerhalb des gesamten Plots ausweichen (nie das Icon verdecken).
  return placeTooltipAvoidingAll(
    { x: crosshair.svgX, y: crosshair.svgY },
    { width, height },
    { left: layout.plotLeft, top: layout.plotTop, right: layout.plotRight, bottom: layout.plotBottom },
    avoid,
  );
}

function CrosshairLayer({ crosshair, layout, tooltipRect }: { crosshair: CrosshairState | null; layout: BandContext["layout"]; tooltipRect: TooltipRect | null }) {
  if (!crosshair || !tooltipRect) return null;
  const config = VITAL_CONFIG[crosshair.kind];
  const labelX = tooltipRect.x;
  const labelY = tooltipRect.y;
  const valueLabel = crosshair.kind === "nibp"
    ? `Zeigerwert ${formatVitalNumber("nibp", crosshair.pointerValue)} ${config.unit}`
    : `${config.label} ${formatVitalNumber(crosshair.kind, crosshair.pointerValue)} ${config.unit}`;
  const invalidLabel = !crosshair.ok
    ? crosshair.reason === "afterEnd"
      ? "Nicht dokumentierbar · Eingriff beendet"
      : crosshair.reason === "future"
        ? "Nicht dokumentierbar · Zukunft"
        : "Nicht dokumentierbar · vor Beginn"
    : null;
  return (
    <g pointerEvents="none" data-testid="timeline-crosshair">
      <line x1={crosshair.svgX} y1={layout.contentTop} x2={crosshair.svgX} y2={layout.plotBottom} className="crosshair-vertical" />
      <line x1={layout.plotLeft} y1={crosshair.svgY} x2={layout.plotRight} y2={crosshair.svgY} className="crosshair-horizontal" />
      <line x1={crosshair.svgX - 6} y1={crosshair.svgY} x2={crosshair.svgX + 6} y2={crosshair.svgY} className="crosshair-center" />
      <line x1={crosshair.svgX} y1={crosshair.svgY - 6} x2={crosshair.svgX} y2={crosshair.svgY + 6} className="crosshair-center" />
      <rect x={labelX} y={labelY} width={tooltipRect.width} height={tooltipRect.height} rx={6} className="crosshair-tooltip" />
      <text x={labelX + 8} y={labelY + 18} className="crosshair-tooltip-text" data-testid="crosshair-coordinate">
        {formatClock(crosshair.time)} · {valueLabel}
      </text>
      {invalidLabel ? <text x={labelX + 8} y={labelY + 35} className="crosshair-tooltip-warning">{invalidLabel}</text> : null}
    </g>
  );
}

const PREVIEW_SHORT_LABEL: Record<VitalKind, string> = {
  spo2: "SpO₂",
  heartRate: "HF",
  nibp: "NIBP",
  temperature: "Temp",
};

// Zeichnet die eine aktive, fluechtige Vorschau. Bewusst gestrichelt (Kreis bzw.
// Punkt), damit sie nie wie ein gespeicherter Messwert aussieht. Kein "+"-Zeichen.
function TimelinePreviewLayer({
  preview,
  layout,
  xScale,
  yScales,
}: {
  preview: TimelinePreview | null;
  layout: BandContext["layout"];
  xScale: BandContext["xScale"];
  yScales: BandContext["yScales"];
}) {
  if (!preview) return null;
  const x = timeToX(xScale, preview.time);
  const nearRight = x > layout.plotRight - 210;
  const tipX = nearRight ? x - 190 : x + 10;

  if (preview.kind === "vital" && preview.band) {
    const band = preview.band;
    const value = preview.value ?? 0;
    const y = yScales[band](value);
    const label = `${formatClock(preview.time)} · ${PREVIEW_SHORT_LABEL[band]} ${formatVitalNumber(band, value)} ${VITAL_CONFIG[band].unit}`;
    const tipY = clampValue(y - 34, layout.bandByKind[band].top + 4, layout.bandByKind[band].bottom - 26);
    return (
      <g pointerEvents="none" data-testid="timeline-preview" data-preview-kind="vital">
        <line x1={x} y1={layout.contentTop} x2={x} y2={layout.plotBottom} className="timeline-preview-line" />
        <circle cx={x} cy={y} r={7} className="timeline-preview-dot" />
        <rect x={tipX} y={tipY} width={182} height={20} rx={5} className="timeline-preview-tooltip" />
        <text x={tipX + 7} y={tipY + 14} className="timeline-preview-tooltip-text" data-testid="preview-coordinate">{label}</text>
      </g>
    );
  }

  const lane = preview.lane === "medication"
    ? layout.therapyLanes[0]
    : preview.lane === "infusion"
      ? layout.therapyLanes[1]
      : layout.therapyLanes[2];
  const isEvent = preview.kind === "event";
  const definition = preview.eventType ? eventDefinition(preview.eventType) : null;
  // Kreis mittig auf der Zeitlinie; großzügige Zielfläche für den zweiten Kontakt.
  const circleY = (lane.top + lane.bottom) / 2;
  const tipY = lane.bottom - 24;
  return (
    <g pointerEvents="none" data-testid="timeline-preview" data-preview-kind={preview.kind}>
      <line x1={x} y1={lane.top} x2={x} y2={layout.plotBottom} className={`timeline-preview-line ${isEvent ? "timeline-preview-line--event" : ""}`} />
      <circle cx={x} cy={circleY} r={PREVIEW_CIRCLE_RADIUS_PX} className={`timeline-preview-circle ${isEvent ? "timeline-preview-circle--event" : ""}`} data-testid="preview-circle" />
      {definition ? <text x={x} y={lane.top + 18} textAnchor="middle" className="timeline-preview-symbol">{definition.symbol}</text> : null}
      <rect x={tipX} y={tipY} width={110} height={20} rx={5} className="timeline-preview-tooltip" />
      <text x={tipX + 7} y={tipY + 14} className="timeline-preview-tooltip-text" data-testid="preview-coordinate">{formatClock(preview.time)}</text>
    </g>
  );
}

// Welche NIBP-Komponenten sind an der Kontrollzeit bereits gesetzt (Datensatz oder Entwurf)?
function nibpFilledComponents(nibps: NibpMeasurement[], active: ActiveCheckpoint): Record<NibpComponent, boolean> {
  const record = nibps.find((measurement) => measurement.time === active.time);
  const draft = active.nibpDraft;
  const effective = (component: NibpComponent): number | null => {
    if (draft) return draft[component];
    if (!record) return null;
    return component === "mean" ? record.mean : record[component];
  };
  return {
    systolic: Number.isFinite(effective("systolic") ?? Number.NaN),
    mean: Number.isFinite(effective("mean") ?? Number.NaN),
    diastolic: Number.isFinite(effective("diastolic") ?? Number.NaN),
  };
}

// Inline-Auswahl der NIBP-Komponente im Checkpoint-Modus – bewusst kein Drawer.
// Erst die gewählte Komponente wird beim nächsten Stiftkontakt gesetzt; die anderen
// beiden bleiben unverändert. Kein Wert wird aus einer einzelnen Y-Position erraten.
function NibpComponentPicker({
  layout,
  selected,
  filled,
  onSelect,
}: {
  layout: BandContext["layout"];
  selected: NibpComponent;
  filled: Record<NibpComponent, boolean>;
  onSelect: (component: NibpComponent) => void;
}) {
  const band = layout.bandByKind.nibp;
  const items: Array<[NibpComponent, string]> = [["systolic", "Sys"], ["mean", "Mittel"], ["diastolic", "Dia"]];
  return (
    <foreignObject x={6} y={band.top + 52} width={166} height={34} data-testid="nibp-component-picker" aria-label="Blutdruck-Komponente für die Kontrollzeit wählen">
      <div className="nibp-component-picker">
        {items.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            data-testid={`nibp-component-${key}`}
            className={`nibp-component-button ${selected === key ? "nibp-component-button--selected" : ""} ${filled[key] ? "nibp-component-button--filled" : ""}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onSelect(key); }}
          >
            {label}{filled[key] ? " ✓" : ""}
          </button>
        ))}
      </div>
    </foreignObject>
  );
}

function renderDraftPreview(
  draft: EntryDraft | null,
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
) {
  if (!draft) return null;
  if (draft.mode === "create-scalar") {
    return <circle cx={timeToX(xScale, draft.time)} cy={yScales[draft.kind](draft.value)} r={7} fill="none" stroke="#173029" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" data-testid="draft-preview" />;
  }
  if (draft.mode === "create-nibp") {
    return <circle cx={timeToX(xScale, draft.time)} cy={yScales.nibp(draft.mean)} r={7} fill="none" stroke="#173029" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" data-testid="draft-preview" />;
  }
  return null;
}
