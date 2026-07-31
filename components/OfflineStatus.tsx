"use client";

import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { TEXT } from "../lib/constants";

/**
 * Kleiner, unaufdringlicher Hinweis bei fehlender Internetverbindung.
 * Verschwindet automatisch, sobald die Verbindung wieder besteht.
 */
export function OfflineStatus() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status" data-testid="offline-banner">
      {TEXT.offline}
    </div>
  );
}
