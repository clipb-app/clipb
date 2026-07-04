const SUPPRESSION_TTL_MS = 8_000;

const suppressedFilePathKeys = new Map<string, number>();
const suppressedImageHashes = new Map<string, number>();

function filePathKey(paths: string[]): string {
  return paths.join("\n");
}

function pruneExpired(map: Map<string, number>, now: number): void {
  for (const [key, expiresAt] of map) {
    if (expiresAt <= now) {
      map.delete(key);
    }
  }
}

function addSuppression(map: Map<string, number>, key: string, now: number) {
  if (!key) return;

  pruneExpired(map, now);
  map.set(key, now + SUPPRESSION_TTL_MS);
}

function consumeSuppression(
  map: Map<string, number>,
  key: string,
  now: number,
): boolean {
  if (!key) return false;

  pruneExpired(map, now);

  if (!map.has(key)) return false;

  map.delete(key);
  return true;
}

export function suppressClipboardCaptureForFilePaths(
  paths: string[],
  now = Date.now(),
): void {
  addSuppression(suppressedFilePathKeys, filePathKey(paths), now);
}

export function consumeSuppressedFilePaths(
  paths: string[],
  now = Date.now(),
): boolean {
  return consumeSuppression(suppressedFilePathKeys, filePathKey(paths), now);
}

export function suppressClipboardCaptureForImageHash(
  hash: string | null | undefined,
  now = Date.now(),
): void {
  addSuppression(suppressedImageHashes, hash ?? "", now);
}

export function consumeSuppressedImageHash(
  hash: string | null | undefined,
  now = Date.now(),
): boolean {
  return consumeSuppression(suppressedImageHashes, hash ?? "", now);
}

export function clearClipboardCaptureSuppressions(): void {
  suppressedFilePathKeys.clear();
  suppressedImageHashes.clear();
}
