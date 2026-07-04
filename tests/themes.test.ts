import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/lib/defaultSettings";
import {
  applyDocumentTheme,
  isThemePalette,
  readStoredTheme,
  subscribeToThemeChanges,
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

test("theme settings persist to document and local storage", () => {
  const browser = installBrowserThemeTestEnvironment();

  try {
    applyDocumentTheme({
      themeMode: "dark",
      themePalette: "sakura-pink",
    });

    assert.equal(browser.dataset.theme, "dark");
    assert.equal(browser.dataset.themePalette, "sakura-pink");
    assert.deepEqual(readStoredTheme(), {
      themeMode: "dark",
      themePalette: "sakura-pink",
    });
  } finally {
    browser.restore();
  }
});

test("theme storage subscriptions notify for valid theme changes", () => {
  const browser = installBrowserThemeTestEnvironment();
  const received: unknown[] = [];

  try {
    const unsubscribe = subscribeToThemeChanges((settings) => {
      received.push(settings);
    });

    browser.dispatchStorageEvent("unrelated", "{}");
    browser.dispatchStorageEvent(
      "clipb.theme",
      JSON.stringify({
        themeMode: "light",
        themePalette: "ocean-mint",
      }),
    );
    browser.dispatchStorageEvent(
      "clipb.theme",
      JSON.stringify({
        themeMode: "sepia",
        themePalette: "ocean-mint",
      }),
    );

    unsubscribe();
    browser.dispatchStorageEvent(
      "clipb.theme",
      JSON.stringify({
        themeMode: "dark",
        themePalette: "clipb",
      }),
    );

    assert.deepEqual(received, [
      {
        themeMode: "light",
        themePalette: "ocean-mint",
      },
    ]);
  } finally {
    browser.restore();
  }
});

function installBrowserThemeTestEnvironment() {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
  };
  const originalWindow = globalObject.window;
  const originalDocument = globalObject.document;

  const storage = new Map<string, string>();
  const listeners = new Set<(event: StorageEvent) => void>();
  const dataset: Record<string, string> = {};

  Object.defineProperty(globalObject, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
      addEventListener: (
        type: string,
        listener: (event: StorageEvent) => void,
      ) => {
        if (type === "storage") {
          listeners.add(listener);
        }
      },
      removeEventListener: (
        type: string,
        listener: (event: StorageEvent) => void,
      ) => {
        if (type === "storage") {
          listeners.delete(listener);
        }
      },
    },
  });

  Object.defineProperty(globalObject, "document", {
    configurable: true,
    value: {
      documentElement: {
        dataset,
      },
    },
  });

  return {
    dataset,
    dispatchStorageEvent(key: string, newValue: string | null) {
      for (const listener of listeners) {
        listener({
          key,
          newValue,
        } as StorageEvent);
      }
    },
    restore() {
      Object.defineProperty(globalObject, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalObject, "document", {
        configurable: true,
        value: originalDocument,
      });
    },
  };
}
