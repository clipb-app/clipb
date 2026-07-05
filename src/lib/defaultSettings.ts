import type { AppSettings } from "../types";

export const DEFAULT_SETTINGS: AppSettings = {
  historyRetentionDays: "never",
  protectPinnedClips: true,
  watchClipboard: true,
  themeMode: "system",
  themePalette: "clipb",
  launchOnStartup: true,
  /* c8 ignore next */
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
};
