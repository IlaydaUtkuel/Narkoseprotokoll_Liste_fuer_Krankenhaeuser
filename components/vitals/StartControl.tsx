"use client";

import { Button } from "antd";
import { formatClock } from "../../lib/timeline/format";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useCaseStore } from "../../store/anesthesiaCaseStore";

// Vor dem Start: grosser Start-Button mit laufender HH:mm:ss-Uhr.
// Nach dem Start: "Gestartet um HH:mm:ss" (aendert sich nicht mehr).
export function StartControl() {
  const startedAt = useCaseStore((s) => s.startedAt);
  const startCase = useCaseStore((s) => s.startCase);
  const now = useCurrentTime(1000);

  if (startedAt !== null) {
    return (
      <div className="case-started" data-testid="case-started">
        Gestartet um {formatClock(startedAt)}
      </div>
    );
  }

  return (
    <Button type="primary" size="large" onClick={startCase} data-testid="start-button">
      Starten{now !== null ? ` · ${formatClock(now)}` : ""}
    </Button>
  );
}
