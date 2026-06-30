import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getAllTextClips, importClipsFromBackup } from "./db";
import {
  createClipBExportFile,
  getExportFileName,
  validateExportFile,
} from "./backupFormat";

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
  const exportFile = createClipBExportFile(clips);

  await writeTextFile(filePath, JSON.stringify(exportFile, null, 2));

  return {
    cancelled: false,
    exported: exportFile.clips.length,
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
