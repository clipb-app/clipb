import { test } from "node:test";
import assert from "node:assert/strict";
import { detectClipCategory } from "../src/lib/clipDetection";

test("detects direct URLs and URLs inside copied text", () => {
  assert.equal(detectClipCategory("https://clipb.app"), "url");
  assert.equal(detectClipCategory("www.clipb.app/download"), "url");
  assert.equal(
    detectClipCategory("Useful reference: www.example.com/docs"),
    "url",
  );
  assert.equal(
    detectClipCategory("Read https://example.com/docs before shipping."),
    "url",
  );
});

test("detects common code snippets", () => {
  assert.equal(
    detectClipCategory("export function copyClip(value: string) { return value; }"),
    "code",
  );

  assert.equal(
    detectClipCategory("SELECT id, content FROM clips WHERE is_pinned = 1"),
    "code",
  );

  assert.equal(detectClipCategory("git status --short"), "code");
  assert.equal(
    detectClipCategory(`first line
second line {
third line => value`),
    "code",
  );
  assert.equal(detectClipCategory("let x"), "text");
});

test("keeps ordinary prose as text", () => {
  assert.equal(
    detectClipCategory("Remember to follow up about the release notes."),
    "text",
  );
});
