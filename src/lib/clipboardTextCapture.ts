import type { AppSettings, Clip } from "../types";
import type { ActiveAppInfo } from "./activeApp";
import { isClipboardCaptureActive, scanClipPrivacy } from "./privacy";

export type ClipboardTextCaptureSkipReason =
  | "inactive"
  | "ignored_app"
  | "empty"
  | "non_text"
  | "image_path"
  | "duplicate"
  | "privacy_filter";

export interface ClipboardTextCaptureResult {
  clip: Clip | null;
  skippedReason: ClipboardTextCaptureSkipReason | null;
}

export interface ClipboardTextCaptureAdapters {
  readText: () => Promise<string | null>;
  getActiveApp: () => Promise<ActiveAppInfo | null>;
  isIgnoredApp: (
    activeApp: ActiveAppInfo | null,
    ignoredApps: string[],
  ) => boolean;
  getImagePathFromClipboardText: (text: string) => string | null;
  saveClip: (content: string) => Promise<Clip | null>;
  scanClipPrivacy: typeof scanClipPrivacy;
}

export async function saveCurrentClipboardTextWithAdapters(
  settings: AppSettings,
  adapters: ClipboardTextCaptureAdapters,
): Promise<ClipboardTextCaptureResult> {
  if (!isClipboardCaptureActive(settings)) {
    return {
      clip: null,
      skippedReason: "inactive",
    };
  }

  const activeApp = await adapters.getActiveApp();

  if (adapters.isIgnoredApp(activeApp, settings.ignoredApps)) {
    return {
      clip: null,
      skippedReason: "ignored_app",
    };
  }

  let text: string | null = null;

  try {
    text = await adapters.readText();
  } catch {
    return {
      clip: null,
      skippedReason: "non_text",
    };
  }

  const cleanText = text?.trim();

  if (!cleanText) {
    return {
      clip: null,
      skippedReason: "empty",
    };
  }

  if (adapters.getImagePathFromClipboardText(cleanText)) {
    return {
      clip: null,
      skippedReason: "image_path",
    };
  }

  const privacyScan = adapters.scanClipPrivacy(cleanText, settings);

  if (!privacyScan.shouldSave) {
    return {
      clip: null,
      skippedReason: "privacy_filter",
    };
  }

  const clip = await adapters.saveClip(cleanText);

  return {
    clip,
    skippedReason: clip ? null : "duplicate",
  };
}
