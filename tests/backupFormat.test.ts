import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createClipBExportFile,
  getExportFileName,
  normalizeExportedClipForImport,
  validateExportFile,
} from "../src/lib/backupFormat";
import type { Clip, ExportedClip } from "../src/types";

function textClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 1,
    content: " https://clipb.app ",
    content_hash: "hash",
    content_type: "text/plain",
    category: "url",
    note: null,
    asset_path: null,
    asset_name: null,
    asset_size: null,
    asset_mime: null,
    created_at: 1000,
    updated_at: 2000,
    is_pinned: 1,
    is_favorite: 0,
    ...overrides,
  };
}

test("builds deterministic JSON export file names", () => {
  assert.equal(
    getExportFileName(new Date(2026, 5, 30, 7, 8)),
    "clipb-export-2026-06-30-07-08.json",
  );
});

test("creates JSON export payloads from text clips", () => {
  const exportFile = createClipBExportFile(
    [
      textClip({
        content: "hello",
        created_at: 123,
        updated_at: 456,
        is_pinned: 0,
      }),
    ],
    999,
  );

  assert.deepEqual(exportFile, {
    app: "ClipB",
    formatVersion: 1,
    exportedAt: 999,
    clips: [
      {
        type: "text/plain",
        content: "hello",
        createdAt: 123,
        updatedAt: 456,
        isPinned: false,
      },
    ],
  });
});

test("validates JSON import files before import", () => {
  const validFile = {
    app: "ClipB",
    formatVersion: 1,
    exportedAt: 999,
    clips: [],
  };

  assert.equal(validateExportFile(validFile), validFile);
  assert.throws(() => validateExportFile({ app: "Other" }), /ClipB export/);
  assert.throws(
    () => validateExportFile({ app: "ClipB", formatVersion: 2, clips: [] }),
    /Unsupported/,
  );
  assert.throws(
    () => validateExportFile({ app: "ClipB", formatVersion: 1 }),
    /clips array/,
  );
});

test("normalizes imported text clips and rejects unsupported backup clips", () => {
  const normalized = normalizeExportedClipForImport(
    {
      type: "text/plain",
      content: "  const answer = 42;  ",
      createdAt: 0,
      updatedAt: Number.NaN,
      isPinned: true,
    },
    12345,
  );

  assert.equal(normalized?.content, "const answer = 42;");
  assert.equal(normalized?.createdAt, 12345);
  assert.equal(normalized?.updatedAt, 12345);
  assert.equal(normalized?.isPinned, true);
  assert.equal(normalized?.category, "code");
  assert.equal(typeof normalized?.contentHash, "string");

  assert.equal(
    normalizeExportedClipForImport({
      type: "text/plain",
      content: "   ",
      createdAt: 1,
      updatedAt: 1,
      isPinned: false,
    }),
    null,
  );

  assert.equal(
    normalizeExportedClipForImport({
      type: "image/png",
      content: "image.png",
      createdAt: 1,
      updatedAt: 1,
      isPinned: false,
    } as ExportedClip),
    null,
  );
});
