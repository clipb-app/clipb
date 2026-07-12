import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppSettings, Clip } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";
import {
  saveCurrentClipboardTextWithAdapters,
  type ClipboardTextCaptureAdapters,
} from "../src/lib/clipboardTextCapture";

const sampleClip = {
  id: 1,
  content: "saved text",
  content_hash: "hash",
  content_type: "text/plain",
  category: "text",
  note: null,
  asset_path: null,
  asset_name: null,
  asset_size: null,
  asset_mime: null,
  created_at: 1,
  updated_at: 1,
  is_pinned: 0,
  is_favorite: 0,
} satisfies Clip;

function makeSettings(overrides?: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

function makeAdapters(
  overrides?: Partial<ClipboardTextCaptureAdapters>,
): ClipboardTextCaptureAdapters {
  return {
    readText: async () => " saved text ",
    getActiveApp: async () => null,
    isIgnoredApp: () => false,
    getImagePathFromClipboardText: () => null,
    saveClip: async () => sampleClip,
    scanClipPrivacy: () => ({
      shouldSave: true,
      sensitivity: "safe",
      matches: [],
    }),
    ...overrides,
  };
}

test("clipboard text capture saves trimmed text", async () => {
  const savedValues: string[] = [];

  const result = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      saveClip: async (content) => {
        savedValues.push(content);
        return sampleClip;
      },
    }),
  );

  assert.deepEqual(savedValues, ["saved text"]);
  assert.deepEqual(result, {
    clip: sampleClip,
    skippedReason: null,
  });
});

test("clipboard text capture skips inactive and ignored states", async () => {
  const inactive = await saveCurrentClipboardTextWithAdapters(
    makeSettings({ watchClipboard: false }),
    makeAdapters(),
  );

  assert.deepEqual(inactive, {
    clip: null,
    skippedReason: "inactive",
  });

  const ignored = await saveCurrentClipboardTextWithAdapters(
    makeSettings({ ignoredApps: ["Secrets"] }),
    makeAdapters({
      getActiveApp: async () => ({
        app_name: "Secrets",
        title: "Secrets",
        process_path: "/Applications/Secrets.app",
        process_id: 22,
      }),
      isIgnoredApp: () => true,
    }),
  );

  assert.deepEqual(ignored, {
    clip: null,
    skippedReason: "ignored_app",
  });
});

test("clipboard text capture skips non-text, empty text, and image paths", async () => {
  const nonText = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      readText: async () => {
        throw new Error("no text");
      },
    }),
  );

  assert.deepEqual(nonText, {
    clip: null,
    skippedReason: "non_text",
  });

  const empty = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      readText: async () => "   ",
    }),
  );

  assert.deepEqual(empty, {
    clip: null,
    skippedReason: "empty",
  });

  const imagePath = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      readText: async () => "/Users/farukumar/Desktop/image.png",
      getImagePathFromClipboardText: () => "/Users/farukumar/Desktop/image.png",
    }),
  );

  assert.deepEqual(imagePath, {
    clip: null,
    skippedReason: "image_path",
  });
});

test("clipboard text capture respects privacy filters and duplicates", async () => {
  const privateText = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      scanClipPrivacy: () => ({
        shouldSave: false,
        reason: "api_key",
        sensitivity: "sensitive",
        matches: [],
      }),
    }),
  );

  assert.deepEqual(privateText, {
    clip: null,
    skippedReason: "privacy_filter",
  });

  const duplicate = await saveCurrentClipboardTextWithAdapters(
    makeSettings(),
    makeAdapters({
      saveClip: async () => null,
    }),
  );

  assert.deepEqual(duplicate, {
    clip: null,
    skippedReason: "duplicate",
  });
});
