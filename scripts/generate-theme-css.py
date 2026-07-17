#!/usr/bin/env python3
"""Regenerates the :root[data-theme="..."] blocks in app/globals.css from
@radix-ui/colors. Run after bumping the package if you want the theme
palette refreshed to whatever that version ships. Requires
`npm install @radix-ui/colors` to have populated node_modules first.

This does NOT edit globals.css automatically — it prints the CSS blocks
to stdout so you can review/diff before pasting them in (contrast
choices below are a judgment call, not something to blindly re-apply).
"""
import re

def read_scale(name):
    path = f"node_modules/@radix-ui/colors/{name}.css"
    with open(path) as f:
        content = f.read()
    first_block = content.split("@supports")[0]  # skip the P3 wide-gamut block
    steps = {}
    for m in re.finditer(r'--([a-zA-Z]+-\d+):\s*(#[0-9a-fA-F]{6});', first_block):
        varname, hexval = m.groups()
        step = int(varname.rsplit("-", 1)[1])
        steps[step] = hexval
    return steps

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rel_lum(rgb):
    def chan(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)

def contrast(hex1, hex2):
    l1, l2 = rel_lum(hex_to_rgb(hex1)), rel_lum(hex_to_rgb(hex2))
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

# theme id -> (neutral scale, accent scale, "white" | "dark" text preference)
# "dark" text preference means neutral[12] is tried first (usually because
# accent[9] is pale/desaturated); it still falls back to whichever of the
# two options has higher contrast against accent[9].
THEMES = [
    ("dark",     "slate-dark", "blue-dark",  "white"),
    ("light",    "slate",      "blue",       "dark"),
    ("yellow",   "sand",       "amber",      "dark"),
    ("mint",     "sage",       "mint",       "dark"),
    ("ocean",    "cyan-dark",  "cyan-dark",  "white"),
    ("rose",     "mauve",      "crimson",    "dark"),
    ("lavender", "mauve",      "violet",     "white"),
    ("forest",   "green-dark", "green-dark", "white"),
    ("sunset",   "sand",       "orange",     "dark"),
    ("graphite", "gray-dark",  "gray-dark",  "white"),
]

def main():
    for theme, neutral_name, accent_name, preference in THEMES:
        neutral = read_scale(neutral_name)
        accent = read_scale(accent_name)
        white_c = contrast("#ffffff", accent[9])
        dark_c = contrast(neutral[12], accent[9])
        if preference == "white":
            accent_text = "#ffffff" if white_c >= dark_c or white_c >= 4.5 else neutral[12]
        else:
            accent_text = neutral[12] if dark_c >= white_c or dark_c >= 4.5 else "#ffffff"

        print(f':root[data-theme="{theme}"] {{')
        print(f"  --bg-page: {neutral[1]};")
        print(f"  --bg-panel: {neutral[2]};")
        print(f"  --bg-panel-alt: {neutral[3]};")
        print(f"  --border: {neutral[7]};")
        print(f"  --border-soft: {neutral[6]};")
        print(f"  --border-strong: {neutral[8]};")
        print(f"  --text: {neutral[12]};")
        print(f"  --text-body: {neutral[12]};")
        print(f"  --text-secondary: {neutral[11]};")
        print(f"  --text-muted: {neutral[11]};")
        print(f"  --text-faint: {neutral[9]};")
        print(f"  --accent: {accent[9]};")
        print(f"  --accent-strong: {accent[10]};")
        print(f"  --accent-text: {accent_text};")
        print("}")
        print()
        print(f"  /* contrast: white/accent9={white_c:.2f}  {neutral_name}-12/accent9={dark_c:.2f} */", "\n")

if __name__ == "__main__":
    main()
