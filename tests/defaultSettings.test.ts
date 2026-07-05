import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";

test("default settings define conservative local-first behavior", () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    historyRetentionDays: "never",
    protectPinnedClips: true,
    watchClipboard: true,
    themeMode: "system",
    themePalette: "clipb",
    launchOnStartup: false,
    checkForUpdatesAutomatically: true,
    updateChannel: "public",
    minClipLength: 2,
    maxClipLength: 50000,
    ignoreSensitiveClips: true,
    ignoreLikelyPasswords: true,
    ignoreLikelyApiKeys: true,
    privateMode: false,
    pauseUntil: null,
    ignoredApps: [],
    backupCopiedFiles: false,
    maxBackupFileSizeMb: 25,
  });
});
