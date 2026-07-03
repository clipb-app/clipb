import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";
import {
  isThemePalette,
  THEME_PALETTE_OPTIONS,
  THEME_PALETTE_VALUES,
} from "../src/lib/themes";

test("theme palettes include the default palette and unique values", () => {
  assert.equal(DEFAULT_SETTINGS.themePalette, "clipb");
  assert.equal(isThemePalette(DEFAULT_SETTINGS.themePalette), true);
  assert.equal(isThemePalette("sakura-pink"), true);

  const uniqueValues = new Set(THEME_PALETTE_VALUES);

  assert.equal(uniqueValues.size, THEME_PALETTE_VALUES.length);
  assert.ok(THEME_PALETTE_OPTIONS.length >= 7);
});

test("theme palette options provide light and dark swatches", () => {
  for (const option of THEME_PALETTE_OPTIONS) {
    assert.equal(option.swatches.light.length, 3);
    assert.equal(option.swatches.dark.length, 3);
  }
});
