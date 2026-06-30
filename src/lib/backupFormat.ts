import type {
  Clip,
  ClipBExportFile,
  ClipCategory,
  ExportedClip,
} from "../types";
import { detectClipCategory } from "./clipDetection";
import { hashText } from "./hash";

export interface NormalizedBackupClip {
  content: string;
  contentHash: string;
  category: ClipCategory;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function getExportFileName(now = new Date()): string {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());

  return `clipb-export-${year}-${month}-${day}-${hour}-${minute}.json`;
}

export function toExportedClip(clip: Clip): ExportedClip {
  return {
    type: "text/plain",
    content: clip.content,
    createdAt: clip.created_at,
    updatedAt: clip.updated_at,
    isPinned: Boolean(clip.is_pinned),
  };
}

export function createClipBExportFile(
  clips: Clip[],
  exportedAt = Date.now(),
): ClipBExportFile {
  return {
    app: "ClipB",
    formatVersion: 1,
    exportedAt,
    clips: clips.map(toExportedClip),
  };
}

export function validateExportFile(value: unknown): ClipBExportFile {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid ClipB export file.");
  }

  const data = value as Partial<ClipBExportFile>;

  if (data.app !== "ClipB") {
    throw new Error("This file does not look like a ClipB export.");
  }

  if (data.formatVersion !== 1) {
    throw new Error("Unsupported ClipB export version.");
  }

  if (!Array.isArray(data.clips)) {
    throw new Error("ClipB export file has no clips array.");
  }

  return data as ClipBExportFile;
}

export function normalizeExportedClipForImport(
  clip: ExportedClip,
  fallbackNow = Date.now(),
): NormalizedBackupClip | null {
  if (clip.type !== "text/plain") {
    return null;
  }

  const content = clip.content.trim();

  if (!content) {
    return null;
  }

  const createdAt =
    Number.isFinite(clip.createdAt) && clip.createdAt > 0
      ? clip.createdAt
      : fallbackNow;

  const updatedAt =
    Number.isFinite(clip.updatedAt) && clip.updatedAt > 0
      ? clip.updatedAt
      : createdAt;

  return {
    content,
    contentHash: hashText(content),
    category: detectClipCategory(content),
    createdAt,
    updatedAt,
    isPinned: Boolean(clip.isPinned),
  };
}
