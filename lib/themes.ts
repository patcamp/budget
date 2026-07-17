// Theme ids match the `data-theme` values defined in app/globals.css and
// the `profiles.theme` column. Swatch colors here are just for the Admin
// picker preview — the actual palette lives entirely in globals.css.
export interface ThemeOption {
  id: string;
  label: string;
  bg: string;
  panel: string;
  accent: string;
}

// Values mirror the :root[data-theme] blocks in app/globals.css, which
// are generated from @radix-ui/colors — see scripts/generate-theme-css.py.
export const THEMES: ThemeOption[] = [
  { id: "dark", label: "Dark", bg: "#111113", panel: "#18191b", accent: "#0090ff" },
  { id: "light", label: "Light", bg: "#fcfcfd", panel: "#f9f9fb", accent: "#0090ff" },
  { id: "yellow", label: "Yellow", bg: "#fdfdfc", panel: "#f9f9f8", accent: "#ffc53d" },
  { id: "mint", label: "Mint Green", bg: "#fbfdfc", panel: "#f7f9f8", accent: "#86ead4" },
  { id: "ocean", label: "Ocean", bg: "#0b161a", panel: "#101b20", accent: "#00a2c7" },
  { id: "rose", label: "Rose", bg: "#fdfcfd", panel: "#faf9fb", accent: "#e93d82" },
  { id: "lavender", label: "Lavender", bg: "#fdfcfd", panel: "#faf9fb", accent: "#6e56cf" },
  { id: "forest", label: "Forest", bg: "#0e1512", panel: "#121b17", accent: "#30a46c" },
  { id: "sunset", label: "Sunset", bg: "#fdfdfc", panel: "#f9f9f8", accent: "#f76b15" },
  { id: "graphite", label: "Graphite", bg: "#111111", panel: "#191919", accent: "#6e6e6e" },
];

export const DEFAULT_THEME = "dark";

export function isValidTheme(theme: string | null | undefined): boolean {
  return !!theme && THEMES.some((t) => t.id === theme);
}
