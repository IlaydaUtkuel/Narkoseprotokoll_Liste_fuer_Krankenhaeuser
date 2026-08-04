import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TherapyMarkerLayer } from "@/components/vitals/TherapyLayers";
import { computeTimelineLayout } from "@/lib/timeline/geometry";
import { buildXScale } from "@/lib/timeline/scales";
import type { MedicationEntry } from "@/types/vitals";

const START = 1_000_000;
const END = START + 30 * 60_000;

function medication(overrides: Partial<MedicationEntry> = {}): MedicationEntry {
  return {
    id: "med-1",
    kind: "medication",
    administrationType: "continuous",
    name: "Perfusor",
    startedAt: START + 60_000,
    dose: 5,
    unit: { label: "mg", code: "mg", system: "UCUM", isCustom: false },
    concentration: null,
    endedAt: null,
    ongoing: true,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function setup(entry: MedicationEntry) {
  const layout = computeTimelineLayout(1000);
  const xScale = buildXScale({ start: START, end: END }, layout);
  const handlers = {
    onFinishNow: vi.fn(),
    onBeginEndDrag: vi.fn(),
    onPreviewEnd: vi.fn(),
    onCommitEnd: vi.fn(),
    onCancelEnd: vi.fn(),
  };
  const result = render(
    <svg width="1000" height={layout.height}>
      <TherapyMarkerLayer
        layout={layout}
        xScale={xScale}
        now={END}
        endedAt={null}
        medications={[entry]}
        infusions={[]}
        events={[]}
        minTime={START}
        maxTime={END}
        getSvgRect={() => ({ left: 0, top: 0, width: 1000, height: layout.height, right: 1000, bottom: layout.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect}
        onEditMedication={vi.fn()}
        onEditInfusion={vi.fn()}
        onEditEvent={vi.fn()}
        onCommitEventTime={vi.fn()}
        selectedEnd={null}
        {...handlers}
      />
    </svg>,
  );
  return { layout, xScale, result, ...handlers };
}

describe("Therapie-Endmarker", () => {
  it("beendet bei 'Anwendung beenden' sofort – ohne Platzierungsmodus", () => {
    const { onFinishNow, onBeginEndDrag } = setup(medication());
    fireEvent.click(screen.getByTestId("medication-med-1-stop-action"));
    expect(onFinishNow).toHaveBeenCalledTimes(1);
    // Kein Modus, in dem eine spätere Berührung den Marker verschieben könnte.
    expect(onBeginEndDrag).not.toHaveBeenCalled();
  });

  it("verschiebt den gesetzten Endmarker bei einem reinen Tap NICHT", () => {
    const entry = medication({ endedAt: START + 10 * 60_000, ongoing: false });
    const { onBeginEndDrag, onCommitEnd, onPreviewEnd } = setup(entry);
    const hit = screen.getByTestId("medication-med-1-end-hit");
    // Tap ohne Bewegung: nichts wird ausgelöst.
    fireEvent.pointerDown(hit, { pointerId: 1, pointerType: "pen", clientX: 500, clientY: 40 });
    fireEvent.pointerUp(hit, { pointerId: 1, pointerType: "pen", clientX: 500, clientY: 40 });
    expect(onBeginEndDrag).not.toHaveBeenCalled();
    expect(onPreviewEnd).not.toHaveBeenCalled();
    expect(onCommitEnd).not.toHaveBeenCalled();
  });

  it("ändert die Endzeit nur bei einem gezielten Drag am Endgriff", () => {
    const entry = medication({ endedAt: START + 10 * 60_000, ongoing: false });
    const { onBeginEndDrag, onCommitEnd } = setup(entry);
    const hit = screen.getByTestId("medication-med-1-end-hit");
    fireEvent.pointerDown(hit, { pointerId: 2, pointerType: "pen", clientX: 500, clientY: 40 });
    fireEvent.pointerMove(hit, { pointerId: 2, pointerType: "pen", clientX: 440, clientY: 40 });
    fireEvent.pointerUp(hit, { pointerId: 2, pointerType: "pen", clientX: 440, clientY: 40 });
    expect(onBeginEndDrag).toHaveBeenCalledTimes(1);
    expect(onCommitEnd).toHaveBeenCalledTimes(1);
    expect(typeof onCommitEnd.mock.calls[0][0]).toBe("number");
  });
});
