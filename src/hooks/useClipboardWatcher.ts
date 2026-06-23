import { useEffect, useRef, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { saveClip } from "../lib/db";

interface UseClipboardWatcherOptions {
  enabled: boolean;
  intervalMs?: number;
  onSaved?: () => void;
}

export function useClipboardWatcher({
  enabled,
  intervalMs = 1000,
  onSaved,
}: UseClipboardWatcherOptions) {
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSeenRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function checkClipboard() {
      try {
        const text = await readText();

        if (cancelled) return;

        const cleanText = text?.trim();

        if (!cleanText) return;

        if (cleanText === lastSeenRef.current) return;

        lastSeenRef.current = cleanText;

        const saved = await saveClip(cleanText);

        if (saved) {
          setLastSavedAt(Date.now());
          onSaved?.();
        }

        setError(null);
      } catch (err) {
        console.error(err);
        setError(
          "Could not read clipboard. Check Tauri clipboard permissions.",
        );
      }
    }

    checkClipboard();

    const timer = window.setInterval(checkClipboard, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, onSaved]);

  return {
    error,
    lastSavedAt,
  };
}
