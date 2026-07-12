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
  assert.equal(DEFAULT_SETTINGS.themePalette, "system-neutral");
  assert.equal(isThemePalette(DEFAULT_SETTINGS.themePalette), true);
  assert.equal(isThemePalette("clipb"), true);
  assert.equal(isThemePalette("sakura-pink"), true);
  assert.equal(isThemePalette("unknown-theme"), false);
  assert.equal(isThemePalette(null), false);
  assert.equal(isThemePalette(undefined), false);

  const uniqueValues = new Set(THEME_PALETTE_VALUES);

  assert.equal(uniqueValues.size, THEME_PALETTE_VALUES.length);
  assert.ok(THEME_PALETTE_OPTIONS.length >= 8);
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

test("theme settings skip repeated storage writes", () => {
  const settings = {
    themeMode: "dark" as const,
    themePalette: "sakura-pink" as const,
  };
  const browser = installBrowserThemeTestEnvironment({
    initialStoredTheme: JSON.stringify(settings),
  });

  try {
    applyDocumentTheme(settings);

    assert.deepEqual(browser.setCalls, []);
  } finally {
    browser.restore();
  }
});

test("theme storage handles invalid and unavailable state", () => {
  const noBrowser = installNoBrowserThemeTestEnvironment();

  try {
    assert.equal(readStoredTheme(), null);
    assert.doesNotThrow(() =>
      applyDocumentTheme({
        themeMode: "light",
        themePalette: "clipb",
      }),
    );
    assert.doesNotThrow(() => subscribeToThemeChanges(() => {})());
  } finally {
    noBrowser.restore();
  }

  const browser = installBrowserThemeTestEnvironment({
    initialStoredTheme: "not json",
  });

  try {
    assert.equal(readStoredTheme(), null);

    browser.storage.set(
      "clipb.theme",
      JSON.stringify({
        themeMode: "sepia",
        themePalette: "clipb",
      }),
    );
    assert.equal(readStoredTheme(), null);

    browser.storage.set(
      "clipb.theme",
      JSON.stringify({
        themeMode: "dark",
        themePalette: "unknown",
      }),
    );
    assert.equal(readStoredTheme(), null);
  } finally {
    browser.restore();
  }
});

test("theme storage failures are best effort", () => {
  const readFailure = installBrowserThemeTestEnvironment({
    throwOnGet: true,
  });

  try {
    assert.equal(readStoredTheme(), null);
    assert.doesNotThrow(() =>
      applyDocumentTheme({
        themeMode: "dark",
        themePalette: "clipb",
      }),
    );
  } finally {
    readFailure.restore();
  }

  const writeFailure = installBrowserThemeTestEnvironment({
    throwOnSet: true,
  });

  try {
    assert.doesNotThrow(() =>
      applyDocumentTheme({
        themeMode: "light",
        themePalette: "paper-mono",
      }),
    );
  } finally {
    writeFailure.restore();
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

function installBrowserThemeTestEnvironment(options?: {
  initialStoredTheme?: string;
  throwOnGet?: boolean;
  throwOnSet?: boolean;
}) {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
  };
  const originalWindow = globalObject.window;
  const originalDocument = globalObject.document;

  const storage = new Map<string, string>();
  const setCalls: string[] = [];
  const listeners = new Set<(event: StorageEvent) => void>();
  const dataset: Record<string, string> = {};

  if (options?.initialStoredTheme !== undefined) {
    storage.set("clipb.theme", options.initialStoredTheme);
  }

  Object.defineProperty(globalObject, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => {
          if (options?.throwOnGet) {
            throw new Error("storage read failed");
          }

          return storage.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (options?.throwOnSet) {
            throw new Error("storage write failed");
          }

          setCalls.push(`${key}:${value}`);
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
    setCalls,
    storage,
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

function installNoBrowserThemeTestEnvironment() {
  const globalObject = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
  };
  const originalWindow = globalObject.window;
  const originalDocument = globalObject.document;

  Object.defineProperty(globalObject, "window", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalObject, "document", {
    configurable: true,
    value: undefined,
  });

  return {
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
