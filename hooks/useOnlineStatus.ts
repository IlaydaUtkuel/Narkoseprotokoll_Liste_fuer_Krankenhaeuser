"use client";

import { useEffect, useState } from "react";

/**
 * Liefert true, wenn der Browser online ist. Startet optimistisch mit "online",
 * um Hydration-Unterschiede zu vermeiden, und aktualisiert sich per online/offline-Events.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
