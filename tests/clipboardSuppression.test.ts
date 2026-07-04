import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearClipboardCaptureSuppressions,
  consumeSuppressedFilePaths,
  consumeSuppressedImageHash,
  suppressClipboardCaptureForFilePaths,
  suppressClipboardCaptureForImageHash,
} from "../src/lib/clipboardSuppression";

test("suppresses copied file paths once", () => {
  clearClipboardCaptureSuppressions();

  const paths = ["/Users/me/Pictures/image.png"];

  suppressClipboardCaptureForFilePaths(paths, 1_000);

  assert.equal(consumeSuppressedFilePaths(paths, 1_100), true);
  assert.equal(consumeSuppressedFilePaths(paths, 1_200), false);
});

test("suppresses copied image hashes once", () => {
  clearClipboardCaptureSuppressions();

  suppressClipboardCaptureForImageHash("hash", 1_000);

  assert.equal(consumeSuppressedImageHash("hash", 1_100), true);
  assert.equal(consumeSuppressedImageHash("hash", 1_200), false);
});

test("expires old clipboard suppressions", () => {
  clearClipboardCaptureSuppressions();

  suppressClipboardCaptureForFilePaths(["/tmp/old.png"], 1_000);
  suppressClipboardCaptureForImageHash("old-hash", 1_000);

  assert.equal(consumeSuppressedFilePaths(["/tmp/old.png"], 10_000), false);
  assert.equal(consumeSuppressedImageHash("old-hash", 10_000), false);
});

test("ignores empty clipboard suppression keys", () => {
  clearClipboardCaptureSuppressions();

  suppressClipboardCaptureForFilePaths([], 1_000);
  suppressClipboardCaptureForImageHash(null, 1_000);
  suppressClipboardCaptureForImageHash(undefined, 1_000);

  assert.equal(consumeSuppressedFilePaths([], 1_100), false);
  assert.equal(consumeSuppressedImageHash(null, 1_100), false);
  assert.equal(consumeSuppressedImageHash(undefined, 1_100), false);
});
