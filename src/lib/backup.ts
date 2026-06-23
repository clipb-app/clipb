import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ClipBExportFile, ExportedClip } from "../types";
import { getAllTextClips, importClipsFromBackup } from "./db";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getExportFileName(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());

  return `clipb-export-${year}-${month}-${day}-${hour}-${minute}.json`;
}

function validateExportFile(value: unknown): ClipBExportFile {
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

export async function exportClipsToJsonFile(): Promise<{
  cancelled: boolean;
  exported: number;
  path?: string;
}> {
  const filePath = await save({
    defaultPath: getExportFileName(),
    filters: [
      {
        name: "ClipB JSON Export",
        extensions: ["json"],
      },
    ],
  });

  if (!filePath) {
    return {
      cancelled: true,
      exported: 0,
    };
  }

  const clips = await getAllTextClips();

  const exportedClips: ExportedClip[] = clips.map((clip) => ({
    type: "text/plain",
    content: clip.content,
    createdAt: clip.created_at,
    updatedAt: clip.updated_at,
    isPinned: Boolean(clip.is_pinned),
  }));

  const exportFile: ClipBExportFile = {
    app: "ClipB",
    formatVersion: 1,
    exportedAt: Date.now(),
    clips: exportedClips,
  };

  await writeTextFile(filePath, JSON.stringify(exportFile, null, 2));

  return {
    cancelled: false,
    exported: exportedClips.length,
    path: filePath,
  };
}

export async function importClipsFromJsonFile(): Promise<{
  cancelled: boolean;
  imported: number;
  skipped: number;
  path?: string;
}> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "ClipB JSON Export",
        extensions: ["json"],
      },
    ],
  });

  if (!selected || Array.isArray(selected)) {
    return {
      cancelled: true,
      imported: 0,
      skipped: 0,
    };
  }

  const contents = await readTextFile(selected);
  const parsed = JSON.parse(contents);
  const exportFile = validateExportFile(parsed);

  const result = await importClipsFromBackup(exportFile.clips);

  return {
    cancelled: false,
    imported: result.imported,
    skipped: result.skipped,
    path: selected,
  };
}
