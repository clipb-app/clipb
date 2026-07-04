import { test } from "node:test";
import assert from "node:assert/strict";
import { hashBytes, hashText } from "../src/lib/hash";

test("hashes text deterministically", () => {
  assert.equal(hashText(""), "811c9dc5");
  assert.equal(hashText("ClipB"), hashText("ClipB"));
  assert.notEqual(hashText("ClipB"), hashText("clipb"));
});

test("hashes bytes with SHA-256", async () => {
  assert.equal(
    await hashBytes(new Uint8Array([1, 2, 3])),
    "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
  );
  assert.equal(
    await hashBytes(new Uint8Array([255])),
    "a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89",
  );
});
