import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";
import {
  isClipboardCaptureActive,
  scanClipPrivacy,
} from "../src/lib/privacy";
import type { AppSettings } from "../src/types";

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

test("privacy scan skips empty and out-of-range clips", () => {
  assert.equal(scanClipPrivacy("   ", settings()).reason, "empty_clip");

  assert.deepEqual(scanClipPrivacy("a", settings({ minClipLength: 2 })), {
    shouldSave: false,
    sensitivity: "safe",
    reason: "below_minimum_length",
    matches: ["min_clip_length"],
  });

  assert.deepEqual(scanClipPrivacy("abcd", settings({ maxClipLength: 3 })), {
    shouldSave: false,
    sensitivity: "safe",
    reason: "above_maximum_length",
    matches: ["max_clip_length"],
  });
});

test("privacy scan blocks known token patterns before saving", () => {
  const result = scanClipPrivacy(
    "sk-abcdefghijklmnopqrstuvwxyz123456",
    settings(),
  );

  assert.equal(result.shouldSave, false);
  assert.equal(result.sensitivity, "sensitive");
  assert.equal(result.reason, "likely_api_key_or_token");
  assert.deepEqual(result.matches, ["openai_style_key"]);
});

test("privacy scan can allow token-looking content when token filters are off", () => {
  const result = scanClipPrivacy(
    "sk-abcdefghijklmnopqrstuvwxyz123456",
    settings({
      ignoreLikelyApiKeys: false,
      ignoreLikelyPasswords: false,
      ignoreSensitiveClips: false,
    }),
  );

  assert.equal(result.shouldSave, true);
  assert.equal(result.sensitivity, "safe");
});

test("privacy scan blocks likely passwords but not ordinary URLs", () => {
  const passwordResult = scanClipPrivacy("Tr0ub4dor&9xQ", settings());

  assert.equal(passwordResult.shouldSave, false);
  assert.equal(passwordResult.reason, "likely_password");
  assert.deepEqual(passwordResult.matches, ["password_heuristic"]);

  const urlResult = scanClipPrivacy("https://example.com/path", settings());

  assert.equal(urlResult.shouldSave, true);
});

test("clipboard capture active state honors watch, private mode, and pause timer", () => {
  assert.equal(isClipboardCaptureActive(settings()), true);
  assert.equal(isClipboardCaptureActive(settings({ watchClipboard: false })), false);
  assert.equal(isClipboardCaptureActive(settings({ privateMode: true })), false);
  assert.equal(
    isClipboardCaptureActive(settings({ pauseUntil: Date.now() + 60_000 })),
    false,
  );
});
