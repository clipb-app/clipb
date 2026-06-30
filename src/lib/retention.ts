import type { AppSettings, Clip } from "../types";

export interface RetentionCleanupPlan {
  cutoff: number;
  protectPinnedClips: boolean;
}

export function getRetentionCleanupPlan(
  settings: AppSettings,
  now = Date.now(),
): RetentionCleanupPlan | null {
  if (settings.historyRetentionDays === "never") {
    return null;
  }

  const days = Number(settings.historyRetentionDays);

  return {
    cutoff: now - days * 24 * 60 * 60 * 1000,
    protectPinnedClips: settings.protectPinnedClips,
  };
}

export function shouldDeleteClipForRetention(
  clip: Pick<Clip, "created_at" | "is_pinned">,
  settings: AppSettings,
  now = Date.now(),
): boolean {
  const plan = getRetentionCleanupPlan(settings, now);

  if (!plan) return false;
  if (clip.created_at >= plan.cutoff) return false;
  if (plan.protectPinnedClips && clip.is_pinned) return false;

  return true;
}
