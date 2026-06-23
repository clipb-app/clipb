import { useEffect, useRef, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import type { AppSettings } from "../types";
import { saveClip } from "../lib/db";
import { scanClipPrivacy } from "../lib/privacy";

interface UseClipboardWatcherOptions {
  settings: AppSettings;
  intervalMs?: number;
  onSaved?: () => void;
  onSkipped?: (reason: string) => void;
}

export function useClipboardWatcher({
  settings,
  intervalMs = 1000,
  onSaved,
  onSkipped,
}: UseClipboardWatcherOptions) {
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSeenRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    async function checkClipboard() {
      try {
        if (!settings.watchClipboard) return;
        if (settings.privateMode) return;

        if (settings.pauseUntil && settings.pauseUntil > Date.now()) {
          return;
        }

        const text = await readText();

        if (cancelled) return;

        const cleanText = text?.trim();

        if (!cleanText) return;

        if (cleanText === lastSeenRef.current) return;

        lastSeenRef.current = cleanText;

        const privacyScan = scanClipPrivacy(cleanText, settings);

        if (!privacyScan.shouldSave) {
          onSkipped?.(privacyScan.reason ?? "privacy_filter");
          return;
        }

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
  }, [settings, intervalMs, onSaved, onSkipped]);

  return {
    error,
    lastSavedAt,
  };
}
