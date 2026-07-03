import type { AppSettings, ThemeMode, ThemePalette } from "../types";

export type ThemeSettings = Pick<AppSettings, "themeMode" | "themePalette">;

const THEME_STORAGE_KEY = "clipb.theme";
const THEME_MODE_VALUES: ThemeMode[] = ["system", "light", "dark"];

export const THEME_MODE_OPTIONS: Array<{
  label: string;
  value: ThemeMode;
  description: string;
}> = [
  {
    label: "System",
    value: "system",
    description: "Follow your computer appearance.",
  },
  {
    label: "Light",
    value: "light",
    description: "Use ClipB in light mode.",
  },
  {
    label: "Dark",
    value: "dark",
    description: "Use ClipB in dark mode.",
  },
];

export const THEME_PALETTE_OPTIONS: Array<{
  label: string;
  value: ThemePalette;
  description: string;
  swatches: {
    light: [string, string, string];
    dark: [string, string, string];
  };
}> = [
  {
    label: "ClipB Default",
    value: "clipb",
    description: "Slate, mint, blue, and orange.",
    swatches: {
      light: ["#e0fbfc", "#3d5a80", "#ee6c4d"],
      dark: ["#293241", "#98c1d9", "#ee6c4d"],
    },
  },
  {
    label: "Paper Mono",
    value: "paper-mono",
    description: "Plain white, plain black, crisp gray.",
    swatches: {
      light: ["#ffffff", "#000000", "#737373"],
      dark: ["#000000", "#ffffff", "#737373"],
    },
  },
  {
    label: "Ocean Mint",
    value: "ocean-mint",
    description: "Deep teal, bright cyan, warm coral.",
    swatches: {
      light: ["#f0fdfa", "#0f766e", "#ea580c"],
      dark: ["#102027", "#5eead4", "#fb923c"],
    },
  },
  {
    label: "Ember Slate",
    value: "ember-slate",
    description: "Charcoal, copper, and rose heat.",
    swatches: {
      light: ["#fff7ed", "#c2410c", "#e11d48"],
      dark: ["#221b1a", "#fb923c", "#fb7185"],
    },
  },
  {
    label: "Forest Dawn",
    value: "forest-dawn",
    description: "Moss, fresh green, and gold.",
    swatches: {
      light: ["#f7fee7", "#166534", "#ca8a04"],
      dark: ["#132019", "#a7f3d0", "#facc15"],
    },
  },
  {
    label: "Orchid Ink",
    value: "orchid-ink",
    description: "Ink purple, violet, and magenta.",
    swatches: {
      light: ["#fdf4ff", "#7e22ce", "#db2777"],
      dark: ["#21172d", "#d8b4fe", "#f0abfc"],
    },
  },
  {
    label: "Sakura Pink",
    value: "sakura-pink",
    description: "Blossom pink, plum, and leaf green.",
    swatches: {
      light: ["#fff1f7", "#be185d", "#4d7c0f"],
      dark: ["#281722", "#f9a8d4", "#86efac"],
    },
  },
];

export const THEME_PALETTE_VALUES: ThemePalette[] =
  THEME_PALETTE_OPTIONS.map((option) => option.value);

export function isThemePalette(
  value: string | null | undefined,
): value is ThemePalette {
  return THEME_PALETTE_VALUES.includes(value as ThemePalette);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODE_VALUES.includes(value as ThemeMode);
}

function parseStoredTheme(value: string | null): ThemeSettings | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ThemeSettings>;

    if (
      isThemeMode(parsed.themeMode) &&
      isThemePalette(parsed.themePalette)
    ) {
      return {
        themeMode: parsed.themeMode,
        themePalette: parsed.themePalette,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function persistTheme(settings: ThemeSettings) {
  if (typeof window === "undefined") return;

  try {
    const serialized = JSON.stringify(settings);

    if (window.localStorage.getItem(THEME_STORAGE_KEY) !== serialized) {
      window.localStorage.setItem(THEME_STORAGE_KEY, serialized);
    }
  } catch {
    // Theme persistence is best-effort; DB settings remain the source of truth.
  }
}

export function readStoredTheme(): ThemeSettings | null {
  if (typeof window === "undefined") return null;

  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function subscribeToThemeChanges(
  onThemeChange: (settings: ThemeSettings) => void,
) {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;

    const settings = parseStoredTheme(event.newValue);
    if (settings) {
      onThemeChange(settings);
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export function applyDocumentTheme(settings: ThemeSettings) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = settings.themeMode;
  document.documentElement.dataset.themePalette = settings.themePalette;

  persistTheme(settings);
}
