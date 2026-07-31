"use client";

import { useMemo, useRef, useState } from "react";
import { App } from "antd";
import { BAND_ORDER, VITAL_CONFIG } from "../../lib/timeline/config";
import { computeTimelineLayout } from "../../lib/timeline/geometry";
import { buildXScale, buildYScales, computeDomain, timeToX, xToTime } from "../../lib/timeline/scales";
import { relativeFiveMinuteTicks } from "../../lib/timeline/timeTicks";
import { mapPointerToTimeline } from "../../lib/timeline/pointerMapping";
import { clampValue, findNearestSameKind, roundToPrecision } from "../../lib/timeline/measurementUtils";
import { formatVitalNumber } from "../../lib/timeline/format";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useElementSize } from "../../hooks/useElementSize";
import { usePointerGesture } from "../../hooks/useTimelinePointer";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import { TimeGrid } from "./TimeGrid";
import { VitalBandBackground } from "./VitalBandBackground";
import { Spo2Band } from "./Spo2Band";
import { LineBand } from "./LineBand";
import { NibpBand } from "./NibpBand";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { VitalEntryDrawer } from "./VitalEntryDrawer";
import type { BandContext, DragPreview, EntryDraft } from "./timelineTypes";
import type { Measurement, NibpMeasurement, ScalarMeasurement, VitalKind } from "../../types/vitals";

const MIN_WIDTH = 320;
const NOW_INTERVAL_MS = 250;

export function VitalTimeline() {
  const { message } = App.useApp();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const now = useCurrentTime(NOW_INTERVAL_MS);

  const startedAt = useCaseStore((s) => s.startedAt);
  const measurements = useCaseStore((s) => s.measurements);
  const updateScalar = useCaseStore((s) => s.updateScalar);

  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const width = Math.max(MIN_WIDTH, Math.round(size.width) || MIN_WIDTH);
  const layout = useMemo(() => computeTimelineLayout(width), [width]);
  const yScales = useMemo(() => buildYScales(layout), [layout]);

  // Reiner Fallback vor dem Mount (dann wird ohnehin nur das Skelett gerendert).
  const nowValue = now ?? 0;
  const domain = computeDomain(startedAt, nowValue);
  const xScale = useMemo(
    () => buildXScale({ start: domain.start, end: domain.end }, layout),
    [domain.start, domain.end, layout],
  );
  const ticks = useMemo(
    () => relativeFiveMinuteTicks(domain.start, domain.end),
    [domain.start, domain.end],
  );

  const scalarsOf = (kind: VitalKind) =>
    measurements.filter((m): m is ScalarMeasurement => m.kind === kind);
  const nibps = measurements.filter((m): m is NibpMeasurement => m.kind === "nibp");

  const lastByKind = useMemo(() => {
    const map: Record<VitalKind, string | null> = {
      spo2: null,
      heartRate: null,
      nibp: null,
      temperature: null,
    };
    for (const kind of BAND_ORDER) {
      const list = [...measurements].filter((m) => m.kind === kind).sort((a, b) => a.time - b.time);
      const last = list[list.length - 1];
      if (!last) continue;
      if (last.kind === "nibp") map.nibp = `${last.systolic}/${last.diastolic} (MAD ${last.mean})`;
      else map[kind] = `${formatVitalNumber(kind, last.value)} ${VITAL_CONFIG[kind].unit}`;
    }
    return map;
  }, [measurements]);

  const openEdit = (m: Measurement) => {
    setSelectedId(m.id);
    if (m.kind === "nibp") {
      setDraft({
        mode: "edit-nibp",
        id: m.id,
        time: m.time,
        systolic: m.systolic,
        mean: m.mean,
        diastolic: m.diastolic,
      });
    } else {
      setDraft({ mode: "edit-scalar", id: m.id, kind: m.kind, time: m.time, value: m.value });
    }
  };

  const handleCreateTap = (clientX: number, clientY: number) => {
    if (startedAt === null) {
      message.info("Bitte starten Sie zuerst den Fall.");
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const result = mapPointerToTimeline({
      clientX,
      clientY,
      rect,
      layout,
      xScale,
      yScales,
      startedAt,
      now: nowValue,
    });
    if (!result.ok) {
      if (result.reason === "future") {
        message.warning("Zukünftige Werte können nicht dokumentiert werden.");
      } else if (result.reason === "beforeStart") {
        message.warning("Werte vor dem Start können nicht dokumentiert werden.");
      }
      return;
    }

    const nearest = findNearestSameKind(measurements, result.kind, result.time);
    if (nearest) {
      openEdit(nearest);
      return;
    }

    setSelectedId(null);
    if (result.kind === "nibp") {
      setDraft({ mode: "create-nibp", time: result.time });
    } else {
      const fallback = VITAL_CONFIG[result.kind].min;
      setDraft({
        mode: "create-scalar",
        kind: result.kind,
        time: result.time,
        value: result.value ?? fallback,
      });
    }
  };

  const onScalarDragMove = (m: ScalarMeasurement, clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg || startedAt === null) return;
    const rect = svg.getBoundingClientRect();
    const svgX = clampValue(clientX - rect.left, layout.plotLeft, layout.plotRight);
    const svgY = clientY - rect.top;
    let t = xToTime(xScale, svgX);
    t = clampValue(t, startedAt, nowValue);
    const c = VITAL_CONFIG[m.kind];
    const v = roundToPrecision(clampValue(yScales[m.kind].invert(svgY), c.min, c.max), c.precision);
    setDragPreview({ id: m.id, kind: m.kind, time: t, value: v });
  };

  const onScalarDragEnd = (m: ScalarMeasurement) => {
    if (dragPreview && dragPreview.id === m.id) {
      updateScalar(m.id, dragPreview.time, dragPreview.value);
    }
    setDragPreview(null);
  };

  const plotGesture = usePointerGesture({
    capture: false,
    threshold: 10,
    onTap: (e) => handleCreateTap(e.clientX, e.clientY),
  });

  const ctx: BandContext = {
    layout,
    xScale,
    yScales,
    startedAt: startedAt ?? nowValue,
    now: nowValue,
    selectedId,
    dragPreview,
    onPointTap: openEdit,
    onScalarDragMove,
    onScalarDragEnd,
    onScalarDragCancel: () => setDragPreview(null),
  };

  const showData = startedAt !== null;
  const draftPreviewMarker = renderDraftPreview(draft, xScale, yScales, layout);

  return (
    <div ref={containerRef} className="timeline-surface" data-testid="vital-timeline">
      {now === null ? (
        <div style={{ height: layout.height }} />
      ) : (
        <svg
          ref={svgRef}
          width={width}
          height={layout.height}
          viewBox={`0 0 ${width} ${layout.height}`}
          role="img"
          aria-label="Vitalparameter-Zeitgrafik"
          data-testid="vital-timeline-svg"
          style={{ touchAction: "pan-y", display: "block" }}
        >
          {layout.bands.map((band) => (
            <VitalBandBackground
              key={band.kind}
              band={band}
              layout={layout}
              yScale={yScales[band.kind]}
              lastValueText={lastByKind[band.kind]}
            />
          ))}

          <TimeGrid layout={layout} xScale={xScale} ticks={ticks} />

          {/* Erstell-Hit-Area (pan-y, damit die Seite gescrollt werden kann). */}
          <rect
            x={layout.plotLeft}
            y={layout.plotTop}
            width={layout.plotWidth}
            height={layout.plotBottom - layout.plotTop}
            fill="transparent"
            data-testid="timeline-create-area"
            style={{ touchAction: "pan-y", cursor: startedAt === null ? "not-allowed" : "crosshair" }}
            {...plotGesture}
          />

          {showData ? (
            <>
              <Spo2Band measurements={scalarsOf("spo2")} ctx={ctx} />
              <LineBand kind="heartRate" measurements={scalarsOf("heartRate")} ctx={ctx} testId="series-heartRate" />
              <NibpBand measurements={nibps} ctx={ctx} />
              <LineBand kind="temperature" measurements={scalarsOf("temperature")} ctx={ctx} testId="series-temperature" />
              <CurrentTimeIndicator layout={layout} xScale={xScale} startedAt={startedAt} now={nowValue} />
            </>
          ) : null}

          {draftPreviewMarker}
        </svg>
      )}

      <VitalEntryDrawer
        draft={draft}
        onClose={() => {
          setDraft(null);
          setSelectedId(null);
        }}
      />
    </div>
  );
}

// Sofortige visuelle Vorschau, sobald ein neuer Wert getippt wurde (vor dem Speichern).
function renderDraftPreview(
  draft: EntryDraft | null,
  xScale: BandContext["xScale"],
  yScales: BandContext["yScales"],
  layout: BandContext["layout"],
) {
  if (!draft) return null;
  if (draft.mode === "create-scalar") {
    const cx = timeToX(xScale, draft.time);
    const cy = yScales[draft.kind](draft.value);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill="none"
        stroke="#173029"
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
        data-testid="draft-preview"
      />
    );
  }
  if (draft.mode === "create-nibp") {
    const cx = timeToX(xScale, draft.time);
    const band = layout.bandByKind.nibp;
    return (
      <line
        x1={cx}
        y1={band.innerTop}
        x2={cx}
        y2={band.innerBottom}
        stroke="#173029"
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
        data-testid="draft-preview"
      />
    );
  }
  return null;
}
