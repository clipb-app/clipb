import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";
import {
  getRetentionCleanupPlan,
  shouldDeleteClipForRetention,
} from "../src/lib/retention";
import type { AppSettings, Clip } from "../src/types";

const now = Date.UTC(2026, 5, 30);
const oneDay = 24 * 60 * 60 * 1000;

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

function clip(overrides: Partial<Pick<Clip, "created_at" | "is_pinned">>) {
  return {
    created_at: now - 10 * oneDay,
    is_pinned: 0,
    ...overrides,
  };
}

test("retention cleanup is disabled when retention is never", () => {
  assert.equal(getRetentionCleanupPlan(settings({ historyRetentionDays: "never" }), now), null);
  assert.equal(
    shouldDeleteClipForRetention(
      clip({ created_at: now - 365 * oneDay }),
      settings({ historyRetentionDays: "never" }),
      now,
    ),
    false,
  );
});

test("retention cleanup calculates cutoff from selected retention window", () => {
  assert.deepEqual(
    getRetentionCleanupPlan(
      settings({
        historyRetentionDays: "7",
        protectPinnedClips: true,
      }),
      now,
    ),
    {
      cutoff: now - 7 * oneDay,
      protectPinnedClips: true,
    },
  );
});

test("retention cleanup deletes only old clips and protects pinned clips when enabled", () => {
  const activeSettings = settings({
    historyRetentionDays: "7",
    protectPinnedClips: true,
  });

  assert.equal(
    shouldDeleteClipForRetention(clip({ created_at: now - 8 * oneDay }), activeSettings, now),
    true,
  );
  assert.equal(
    shouldDeleteClipForRetention(clip({ created_at: now - 6 * oneDay }), activeSettings, now),
    false,
  );
  assert.equal(
    shouldDeleteClipForRetention(
      clip({
        created_at: now - 8 * oneDay,
        is_pinned: 1,
      }),
      activeSettings,
      now,
    ),
    false,
  );
});

test("retention cleanup can delete pinned clips when protection is disabled", () => {
  assert.equal(
    shouldDeleteClipForRetention(
      clip({
        created_at: now - 8 * oneDay,
        is_pinned: 1,
      }),
      settings({
        historyRetentionDays: "7",
        protectPinnedClips: false,
      }),
      now,
    ),
    true,
  );
});
