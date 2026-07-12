import { readText } from "@tauri-apps/plugin-clipboard-manager";
import type { AppSettings } from "../types";
import { getActiveApp, isIgnoredApp } from "./activeApp";
import { getImagePathFromClipboardText } from "./imageFileImport";
import { saveClip } from "./db";
import { scanClipPrivacy } from "./privacy";
import {
  saveCurrentClipboardTextWithAdapters,
  type ClipboardTextCaptureAdapters,
  type ClipboardTextCaptureResult,
} from "./clipboardTextCapture";

const defaultClipboardTextCaptureAdapters: ClipboardTextCaptureAdapters = {
  readText,
  getActiveApp,
  isIgnoredApp,
  getImagePathFromClipboardText,
  saveClip,
  scanClipPrivacy,
};

export function saveCurrentClipboardText(
  settings: AppSettings,
): Promise<ClipboardTextCaptureResult> {
  return saveCurrentClipboardTextWithAdapters(
    settings,
    defaultClipboardTextCaptureAdapters,
  );
}
