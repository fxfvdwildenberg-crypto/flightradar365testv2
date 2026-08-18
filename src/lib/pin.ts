import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Pin" a flight so its callsign and progress stay visible outside the app —
 * a live notification in the phone's notification shade, refreshed while the
 * flight is airborne. Falls back to the tab title when notifications are
 * unavailable or denied.
 */
export type PinnedInfo = {
  id: string;
  callsign: string;
  route: string;
  progress: number;
  eta: string;
};

const KEY = "atc365-pinned-flight";

export function usePinnedFlightId() {
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(KEY));
    } catch {
      /* storage blocked */
    }
  }, []);

  const update = useCallback((id: string | null) => {
    setPinned(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  }, []);

  return [pinned, update] as const;
}

function bar(progress: number) {
  const filled = Math.round(Math.min(Math.max(progress, 0), 1) * 12);
  return `${"█".repeat(filled)}${"░".repeat(12 - filled)} ${Math.round(progress * 100)}%`;
}

/** Keeps a single sticky notification in sync with the pinned flight. */
export function useFlightPinNotification(info: PinnedInfo | null, active: boolean) {
  const ref = useRef<Notification | null>(null);

  useEffect(() => {
    if (!active || !info) {
      ref.current?.close();
      ref.current = null;
      if (typeof document !== "undefined") document.title = "ATC365";
      return;
    }

    document.title = `${info.callsign} · ${Math.round(info.progress * 100)}%`;

    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    ref.current?.close();
    try {
      ref.current = new Notification(`${info.callsign} · ${info.route}`, {
        body: `${bar(info.progress)}\n${info.eta}`,
        tag: "atc365-pinned-flight",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        silent: true,
        requireInteraction: true,
      });
    } catch {
      /* notifications unsupported in this context */
    }

    return () => {
      ref.current?.close();
    };
  }, [active, info?.callsign, info?.route, info?.eta, Math.round((info?.progress ?? 0) * 100)]);
}

export async function requestPinPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}