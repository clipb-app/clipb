import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInstallProgress {
  downloaded: number;
  contentLength?: number;
  percent?: number;
}

export async function checkForClipBUpdate(): Promise<Update | null> {
  return check({ timeout: 15_000 });
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
