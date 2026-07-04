import { test } from "node:test";
import assert from "node:assert/strict";
import type { Clip, ClipContentType, ClipCategory } from "../src/types";
import {
  copyClipToClipboard,
  copyClipToClipboardWithAdapters,
  getCopyLabel,
  getCopyTitle,
} from "../src/lib/clipCopy";

function clip(overrides: Partial<Clip>): Clip {
  return {
    id: 1,
    content: "Copied content",
    content_hash: "hash",
    content_type: "text/plain",
    category: "text",
    note: null,
    asset_path: null,
    asset_name: null,
    asset_size: null,
    asset_mime: null,
    created_at: 1,
    updated_at: 1,
    is_pinned: 0,
    is_favorite: 0,
    ...overrides,
  };
}

function adapters(calls: string[]) {
  return {
    writeText: async (text: string) => {
      calls.push(`text:${text}`);
    },
    writeImageClip: async (clip: Clip) => {
      calls.push(`image:${clip.asset_path ?? ""}`);
    },
    writeFilePaths: async (paths: string[]) => {
      calls.push(`files:${paths.join("|")}`);
    },
  };
}

test("copies text clips as text", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({ content: "hello" }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["text:hello"]);
});

test("copies image clips with the image writer", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "image",
      content_type: "image/png",
      asset_path: "/tmp/image.png",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["image:/tmp/image.png"]);
});

test("copies path-only file clips as file references", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "file",
      content_type: "file/path",
      content: "/Users/me/Desktop/report.pdf",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, ["files:/Users/me/Desktop/report.pdf"]);
});

test("copies backed-up file clips from the local asset path", async () => {
  const calls: string[] = [];

  await copyClipToClipboardWithAdapters(
    clip({
      category: "file",
      content_type: "file/backup",
      content: "/missing/original.pdf",
      asset_path: "/Users/me/Library/Application Support/com.clipb.app/assets/report.pdf",
    }),
    adapters(calls),
  );

  assert.deepEqual(calls, [
    "files:/Users/me/Library/Application Support/com.clipb.app/assets/report.pdf",
  ]);
});

test("rejects malformed file clips before touching the OS clipboard", async () => {
  await assert.rejects(
    () =>
      copyClipToClipboardWithAdapters(
        clip({
          category: "file" as ClipCategory,
          content_type: "file/path" as ClipContentType,
          content: "",
        }),
        adapters([]),
      ),
    /No file path available/,
  );
});

test("rejects image clips that no longer have a local asset", async () => {
  await assert.rejects(
    () =>
      copyClipToClipboard(
        clip({
          category: "image",
          content_type: "image/png",
          asset_path: null,
        }),
      ),
    /No image asset path available/,
  );
});

test("returns copy labels for rich clips", () => {
  assert.equal(getCopyLabel(clip({}), false), "Copy");
  assert.equal(getCopyLabel(clip({ category: "image" }), false), "Copy image");
  assert.equal(getCopyLabel(clip({ category: "file" }), false), "Copy file");
  assert.equal(getCopyLabel(clip({}), true), "Copied");
});

test("returns copy titles for rich clips", () => {
  assert.equal(getCopyTitle(clip({}), false), "Copy clip");
  assert.equal(
    getCopyTitle(clip({ category: "image" }), false),
    "Copy image to clipboard",
  );
  assert.equal(
    getCopyTitle(clip({ category: "file" }), false),
    "Copy file to clipboard",
  );
  assert.equal(getCopyTitle(clip({}), true), "Copied");
});
