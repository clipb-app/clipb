import { invoke } from "@tauri-apps/api/core";
import {
  type DownloadEvent,
  Update,
} from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { UpdateChannel } from "../types";

interface UpdateMetadata {
  rid: number;
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
}

export interface UpdateInstallProgress {
  downloaded: number;
  contentLength?: number;
  percent?: number;
}

export async function checkForClipBUpdate(
  channel: UpdateChannel,
): Promise<Update | null> {
  const metadata = await invoke<UpdateMetadata | null>("check_for_clipb_update", {
    channel,
    allow_downgrades: channel === "public",
  });

  return metadata ? new Update(metadata) : null;
}

export async function installClipBUpdate(
  update: Update,
  onProgress?: (progress: UpdateInstallProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | undefined;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloaded = 0;
      contentLength = event.data.contentLength;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
    }

    if (event.event === "Finished" && contentLength !== undefined) {
      downloaded = contentLength;
    }

    onProgress?.({
      downloaded,
      contentLength,
      percent:
        contentLength && contentLength > 0
          ? Math.round((downloaded / contentLength) * 100)
          : undefined,
    });
  });
}

export async function relaunchClipB(): Promise<void> {
  await relaunch();
}
