import { invoke } from "@tauri-apps/api/core";
import { Image as TauriImage } from "@tauri-apps/api/image";
import { readFile } from "@tauri-apps/plugin-fs";
import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Clip } from "../types";
import {
  suppressClipboardCaptureForFilePaths,
  suppressClipboardCaptureForImageHash,
} from "./clipboardSuppression";
import { hashBytes } from "./hash";

export interface DecodedImageData {
  rgba: Uint8Array;
  width: number;
  height: number;
}

export interface ImageClipCopyAdapters {
  writeNativeImageFile: (path: string) => Promise<void>;
  readImageFile: (path: string) => Promise<Uint8Array>;
  decodeImage: (bytes: Uint8Array, mime: string) => Promise<DecodedImageData>;
  hashImageBytes: (bytes: Uint8Array) => Promise<string>;
  suppressFilePaths: (paths: string[]) => void;
  suppressImageHash: (hash: string) => void;
  writeDecodedImage: (image: DecodedImageData) => Promise<void>;
  logDebug: (message: string, error: unknown) => void;
}

export function getImageMime(clip: Clip): string {
  if (clip.asset_mime?.startsWith("image/")) {
    return clip.asset_mime;
  }

  if (clip.content_type.startsWith("image/")) {
    return clip.content_type;
  }

  return "image/png";
}

export function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const safeBytes = new Uint8Array(bytes);

  const arrayBuffer = safeBytes.buffer.slice(
    safeBytes.byteOffset,
    safeBytes.byteOffset + safeBytes.byteLength,
  );

  return new Blob([arrayBuffer], {
    type: mime,
  });
}

export async function decodeImageToRgbaBytes(
  blob: Blob,
): Promise<DecodedImageData> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new window.Image();
    image.decoding = "async";
    image.src = objectUrl;

    await image.decode();

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw new Error("Image has invalid dimensions");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create image canvas context");
    }

    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, width, height);

    // Important:
    // imageData.data is Uint8ClampedArray.
    // Tauri Image.new expects Uint8Array, ArrayBuffer, or number[].
    const rgba = new Uint8Array(imageData.data.buffer.slice(0));

    return {
      rgba,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function decodeImageFileBytesToRgba(
  bytes: Uint8Array,
  mime: string,
): Promise<DecodedImageData> {
  return decodeImageToRgbaBytes(bytesToBlob(bytes, mime));
}

/* c8 ignore start */
async function writeNativeImageFileToClipboard(path: string): Promise<void> {
  await invoke<void>("write_image_file_to_clipboard", {
    path,
  });
}

async function writeDecodedImageToClipboard(
  decoded: DecodedImageData,
): Promise<void> {
  const tauriImage = await TauriImage.new(
    decoded.rgba,
    decoded.width,
    decoded.height,
  );

  try {
    await writeImage(tauriImage);
  } finally {
    await tauriImage.close();
  }
}

const defaultImageClipCopyAdapters: ImageClipCopyAdapters = {
  writeNativeImageFile: writeNativeImageFileToClipboard,
  readImageFile: readFile,
  decodeImage: decodeImageFileBytesToRgba,
  hashImageBytes: hashBytes,
  suppressFilePaths: suppressClipboardCaptureForFilePaths,
  suppressImageHash: suppressClipboardCaptureForImageHash,
  writeDecodedImage: writeDecodedImageToClipboard,
  logDebug: console.debug,
};
/* c8 ignore stop */

export async function copyImageClipWithAdapters(
  clip: Clip,
  adapters: ImageClipCopyAdapters,
): Promise<void> {
  if (!clip.asset_path) {
    throw new Error("No image asset path available for this clip");
  }

  adapters.suppressFilePaths([clip.asset_path]);

  try {
    await adapters.writeNativeImageFile(clip.asset_path);
    return;
  } catch (error) {
    adapters.logDebug("Native image file clipboard copy failed:", error);
  }

  const bytes = await adapters.readImageFile(clip.asset_path);
  const decoded = await adapters.decodeImage(bytes, getImageMime(clip));
  const imageHash = await adapters.hashImageBytes(decoded.rgba);

  adapters.suppressImageHash(imageHash);

  await adapters.writeDecodedImage(decoded);
}

async function copyImageClip(clip: Clip): Promise<void> {
  await copyImageClipWithAdapters(clip, defaultImageClipCopyAdapters);
}

function getFileClipPath(clip: Clip): string {
  const filePath =
    clip.content_type === "file/backup" && clip.asset_path
      ? clip.asset_path
      : clip.content;

  if (!filePath) {
    throw new Error("No file path available for this clip");
  }

  return filePath;
}

async function writeFilePathsToClipboard(paths: string[]): Promise<void> {
  await invoke<void>("write_file_paths_to_clipboard", {
    paths,
  });
}

interface CopyClipAdapters {
  writeText: (text: string) => Promise<void>;
  writeImageClip: (clip: Clip) => Promise<void>;
  writeFilePaths: (paths: string[]) => Promise<void>;
}

const defaultCopyAdapters: CopyClipAdapters = {
  writeText,
  writeImageClip: copyImageClip,
  writeFilePaths: writeFilePathsToClipboard,
};

export async function copyClipToClipboardWithAdapters(
  clip: Clip,
  adapters: CopyClipAdapters,
): Promise<void> {
  if (clip.category === "image") {
    await adapters.writeImageClip(clip);
    return;
  }

  if (clip.category === "file") {
    await adapters.writeFilePaths([getFileClipPath(clip)]);
    return;
  }

  await adapters.writeText(clip.content);
}

export async function copyClipToClipboard(clip: Clip): Promise<void> {
  await copyClipToClipboardWithAdapters(clip, defaultCopyAdapters);
}

export function getCopyLabel(clip: Clip, copied: boolean): string {
  if (copied) return "Copied";

  if (clip.category === "image") return "Copy image";
  if (clip.category === "file") return "Copy file";

  return "Copy";
}

export function getCopyTitle(clip: Clip, copied: boolean): string {
  if (copied) return "Copied";

  if (clip.category === "image") return "Copy image to clipboard";
  if (clip.category === "file") return "Copy file to clipboard";

  return "Copy clip";
}
