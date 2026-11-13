# Andes Crossing — Design Direction

Status: v1 direction, 2026-11-13. Audience: the engineer building the web app (MapLibre GL JS) and, later, the iOS app.
Follow this file line by line. Where it says "data", the value comes from our GeoJSON or config and is never hard-coded.

Contents: 1 Concept · 2 Tokens · 3 Map style · 4 Layout · 5 Opening and states · 6 Components and icons · 7 Accessibility · 8 Do not

---

## 1. Concept

**A quiet relief map that only raises its voice about turbulence.** The screen is one dark, monochrome relief of South
America with the Andes as a lit ridge down the left side. Everything aeronautical is drawn in cool, thin, precise lines
on top of it. The only warm colour on the entire screen is turbulence risk. If the map looks calm, the crossing is calm.

References, and what we take from each:

- **Apple Weather** (map layers, hourly strip): the forecast time scrubber, the layer legend chip, the habit of printing
  the verdict in words before the chart.
- **Apple Maps** (satellite/flyover, floating cards): the pitched hero camera over terrain, floating glass panels, the
  bottom sheet with detents, the "Choose Map" layers card.
- **ForeFlight / Garmin Pilot dark map**: chart conventions (airport, VOR, fix symbols), ICAO labels, UTC, the route
  line as the main object. We take the conventions, not the density.

What makes it distinctive:

1. **Warm hues are reserved.** Yellow, orange, red and violet mean turbulence and nothing else. No red errors, no orange
   "stale" badges, no brown terrain, no magenta route. Terrain, airways, borders and UI are neutral or cool.
2. **The two controls are the two axes.** The flight-level rail (vertical) and the time scrubber (horizontal) each carry
   a small risk strip. Before touching anything the captain sees which level and which hour are best.
3. **The route wears its risk.** The planned route is a neutral line with a risk-coloured casing sampled at the selected
   level and time.
4. **Every verdict has three parts**: likelihood, confidence, data time. They are never shown apart.
5. **It tells the truth about resolution.** Forecast steps snap (no tweening between 3-hourly grids), the 0.25° cell grid
   appears when you zoom in, and vertical exaggeration is labelled.

Platform fit: the look maps onto iOS 26 Liquid Glass natively (`glassEffect`, sheets, inspectors). On the web we
approximate glass with blur + saturation + a 1 px inner highlight. Do not fake refraction.

---

## 2. Design tokens

Rules:

- CSS custom properties are the single source of truth. MapLibre cannot read CSS variables, so `buildStyle(theme)` reads
  every `--map-*` and `--risk-*` token with `getComputedStyle` and returns the style JSON. On theme change call
  `setPaintProperty` per layer (no full `setStyle`, to keep sources and camera).
- Theme resolution: `data-theme="light" | "dark"` on `<html>` wins; with no attribute, follow the OS. The app sets
  `data-theme="dark"` on first run (cockpit default); Appearance in Layers offers Auto / Light / Dark.
- UI font is the system stack (SF Pro on Apple devices). **Map labels cannot use SF Pro** (MapLibre needs glyph PBFs and
  SF Pro may not be redistributed): bundle Inter glyphs as `Inter Regular`, `Inter Medium`, `Inter SemiBold`.
- Sizes are in `rem` so Dynamic Type works. On iOS WebKit, opt in with `font: -apple-system-body` on `html`.

```css
/* ============ Andes Crossing tokens ============ */
:root {
  color-scheme: light;

  /* Type */
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, sans-serif;
  --font-rounded: ui-rounded, "SF Pro Rounded", var(--font-ui);          /* big numerals only */
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;      /* ICAO ids, raw METAR */
  --font-map: "Inter Medium";                                            /* MapLibre glyph stack name */
  --text-large-title: 2rem;     --lh-large-title: 2.4375rem;  /* 34/41 at 17px base */
  --text-title-2: 1.2941rem;    --lh-title-2: 1.647rem;       /* 22/28 */
  --text-title-3: 1.1765rem;    --lh-title-3: 1.4706rem;      /* 20/25 */
  --text-headline: 1rem;        --lh-headline: 1.2941rem;     /* 17/22 semibold */
  --text-body: 1rem;            --lh-body: 1.2941rem;         /* 17/22 */
  --text-subhead: 0.8824rem;    --lh-subhead: 1.1765rem;      /* 15/20 */
  --text-footnote: 0.7647rem;   --lh-footnote: 1.0588rem;     /* 13/18 */
  --text-caption: 0.7059rem;    --lh-caption: 0.9412rem;      /* 12/16 */
  --text-caption-2: 0.6471rem;  --lh-caption-2: 0.7647rem;    /* 11/13, minimum size anywhere */
  --weight-regular: 400; --weight-medium: 500; --weight-semibold: 600; --weight-bold: 700;
  --tracking-caps: 0.04em;      /* small caps labels: UPPER AIRWAYS, CONFIDENCE */

  /* Spacing (4 pt base), radii, sizes */
  --space-1: 2px; --space-2: 4px; --space-3: 8px; --space-4: 12px; --space-5: 16px;
  --space-6: 20px; --space-7: 24px; --space-8: 32px; --space-9: 40px;
  --radius-xs: 6px;    /* risk chips, keycaps */
  --radius-sm: 10px;   /* segmented control, list row highlight */
  --radius-md: 14px;   /* buttons, inputs */
  --radius-lg: 20px;   /* cards, popovers */
  --radius-xl: 26px;   /* floating sidebar, sheet top corners */
  --radius-full: 999px;
  --hit: 44px;         /* minimum touch target, never smaller */
  --hit-pointer: 32px; /* desktop pointer-only minimum */
  --panel-inset: 12px; /* gap between floating panel and screen edge */
  --sidebar-w: 360px;  --sidebar-w-wide: 380px; --inspector-w: 340px;
  --rail-w: 44px;      --scrubber-h: 64px;      --toolbar-h: 44px;

  /* Blur and motion */
  --blur-thin: 12px; --blur-regular: 24px; --blur-thick: 40px; --material-saturate: 180%;
  --dur-press: 120ms; --dur-fade: 200ms; --dur-move: 350ms; --dur-sheet: 450ms; --dur-emphasis: 600ms;
  --dur-camera: 3200ms; --dur-camera-short: 900ms;
  --ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);      /* iOS sheet curve */
  --ease-camera: cubic-bezier(0.45, 0, 0.15, 1);

  /* Surfaces and materials (light) */
  --bg: #EEF1F4;
  --surface-solid: #FFFFFF;
  --surface-raised: #F4F5F7;
  --material-thick: rgba(250, 251, 252, 0.84);    /* sheets, sidebar, inspector */
  --material-regular: rgba(250, 251, 252, 0.70);  /* toolbars, scrubber, rail */
  --material-thin: rgba(250, 251, 252, 0.52);     /* chips on the map */
  --material-stroke: rgba(0, 0, 0, 0.08);         /* 0.5px outer hairline */
  --material-highlight: rgba(255, 255, 255, 0.65);/* 1px inset top edge */
  --scrim: rgba(0, 0, 0, 0.20);

  /* Text, separators, fills (Apple label / fill colours) */
  --text-1: #0B0D12;
  --text-2: rgba(60, 60, 67, 0.74);
  --text-3: rgba(60, 60, 67, 0.50);   /* decorative only, never data */
  --text-on-accent: #FFFFFF;
  --separator: rgba(60, 60, 67, 0.20);
  --separator-opaque: #C6C6C8;
  --fill-1: rgba(120, 120, 128, 0.20); --fill-2: rgba(120, 120, 128, 0.16); --fill-3: rgba(118, 118, 128, 0.12);

  /* Accent (systemBlue). Selection, focus, links, selected route segment. */
  --accent: #007AFF; --accent-pressed: #0062CC; --accent-tint: rgba(0, 122, 255, 0.12);
  --focus-ring: 0 0 0 3px rgba(0, 122, 255, 0.45);

  /* Shadows */
  --shadow-1: 0 1px 2px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06);     /* chips, buttons on map */
  --shadow-2: 0 2px 4px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.14);   /* panels, popovers */
  --shadow-3: 0 4px 8px rgba(0,0,0,0.08), 0 24px 60px rgba(0,0,0,0.20);   /* sheet at large detent */

  /* Risk scale (light map). L* falls with severity: 74 / 58 / 47 / 33. */
  --risk-nil: #8C97A6;       --risk-nil-on: #0B0D12;       /* outline only, never a fill on the map */
  --risk-light: #E0B000;     --risk-light-on: #0B0D12;
  --risk-moderate: #E06A00;  --risk-moderate-on: #0B0D12;
  --risk-severe: #D7261E;    --risk-severe-on: #FFFFFF;
  --risk-extreme: #7A1FA2;   --risk-extreme-on: #FFFFFF;
  --risk-edge-extreme: #5B1380;                            /* band edge line for extreme */
  --risk-fill-light: 0.42; --risk-fill-moderate: 0.52; --risk-fill-severe: 0.62; --risk-fill-extreme: 0.70;
  --risk-hatch: rgba(11, 13, 18, 0.40);                    /* hatch ink on severe/extreme */

  /* Confidence / uncertainty. Multiplies the risk fill alpha; also drives edge style. */
  --conf-high: 1; --conf-medium: 0.72; --conf-low: 0.45;
  --conf-low-dash: 3 3;      /* band edge and chart stroke when confidence is low */
  --conf-bar-on: var(--text-1); --conf-bar-off: var(--fill-1);

  /* Map palette (light) */
  --map-ocean: #CBD9E6;        --map-ocean-label: #6585A6;
  --map-land: #EEF1F4;         --map-land-dim: #E4E8ED;      /* dim = outside Chile and Argentina */
  --map-lake: #CBD9E6;
  --map-hill-shadow: rgba(58, 74, 96, 0.55);
  --map-hill-highlight: rgba(255, 255, 255, 0.90);
  --map-hill-accent: rgba(120, 135, 155, 0.35);
  --map-relief-high: #FFFFFF;  /* colour-relief tint above 4,500 m */
  --map-coast: #8FA3B8;
  --map-border: #8794A6;
  --map-fir: #2F7F74;
  --map-airway-upper: #0F6CBD; --map-airway-lower: #6B778C;  --map-airway-casing: rgba(238, 241, 244, 0.75);
  --map-fix: #3D4B5E;          --map-navaid: #2E5E8C;
  --map-airport: #1B2430;      --map-airport-fill: #FFFFFF;  --map-airport-halo: #FFFFFF;
  --map-label: #253041;        --map-label-2: #5D6B7E;       --map-label-halo: rgba(238, 241, 244, 0.90);
  --map-peak: #5D6B7E;
  --map-route: #0B0D12;        --map-route-casing: #FFFFFF;  --map-route-selected: #007AFF;
  --map-sigmet: #0B0D12;       --map-sigmet-fill: rgba(11, 13, 18, 0.05);
  --map-grid: rgba(11, 13, 18, 0.14);                        /* 0.25 degree cell outlines */
  --map-sky: #BFD5EA; --map-horizon: #E8EEF4; --map-fog: #EEF1F4;
}

/* ---- Dark tokens. Keep the two blocks below identical. ---- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #070D15; --surface-solid: #1C1F26; --surface-raised: #262A33;
    --material-thick: rgba(22, 25, 32, 0.82); --material-regular: rgba(28, 31, 39, 0.66); --material-thin: rgba(34, 38, 47, 0.48);
    --material-stroke: rgba(255, 255, 255, 0.12); --material-highlight: rgba(255, 255, 255, 0.08); --scrim: rgba(0, 0, 0, 0.45);
    --text-1: #F4F6FA; --text-2: rgba(235, 235, 245, 0.72); --text-3: rgba(235, 235, 245, 0.44); --text-on-accent: #FFFFFF;
    --separator: rgba(120, 124, 136, 0.40); --separator-opaque: #38383A;
    --fill-1: rgba(120, 120, 128, 0.36); --fill-2: rgba(120, 120, 128, 0.32); --fill-3: rgba(118, 118, 128, 0.24);
    --accent: #0A84FF; --accent-pressed: #409CFF; --accent-tint: rgba(10, 132, 255, 0.22);
    --focus-ring: 0 0 0 3px rgba(10, 132, 255, 0.60);
    --shadow-1: 0 1px 2px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.30);
    --shadow-2: 0 2px 4px rgba(0,0,0,0.40), 0 10px 30px rgba(0,0,0,0.50);
    --shadow-3: 0 4px 8px rgba(0,0,0,0.45), 0 24px 60px rgba(0,0,0,0.60);
    /* Risk (dark map). L*: 87 / 74 / 58 / 49. Extreme carries a light edge so it never sinks into the map. */
    --risk-nil: #8E9BAE; --risk-nil-on: #F4F6FA;
    --risk-light: #FFD60A; --risk-light-on: #0B0D12;
    --risk-moderate: #FF9F0A; --risk-moderate-on: #0B0D12;
    --risk-severe: #FF453A; --risk-severe-on: #0B0D12;
    --risk-extreme: #A63CF0; --risk-extreme-on: #FFFFFF; --risk-edge-extreme: #E3B5FF;
    --risk-fill-light: 0.34; --risk-fill-moderate: 0.46; --risk-fill-severe: 0.58; --risk-fill-extreme: 0.66;
    --risk-hatch: rgba(255, 255, 255, 0.38);
    --conf-bar-on: var(--text-1); --conf-bar-off: var(--fill-1);
    /* Map (dark) */
    --map-ocean: #08111C; --map-ocean-label: #4E6480;
    --map-land: #172232; --map-land-dim: #111A27; --map-lake: #08111C;
    --map-hill-shadow: rgba(2, 6, 12, 0.80); --map-hill-highlight: rgba(143, 166, 196, 0.50); --map-hill-accent: rgba(8, 16, 28, 0.60);
    --map-relief-high: #C9D6E6;
    --map-coast: #3B4C63; --map-border: #5C6B80; --map-fir: #5F9C92;
    --map-airway-upper: #6CC7F5; --map-airway-lower: #8A96AD; --map-airway-casing: rgba(8, 17, 28, 0.70);
    --map-fix: #A9B6C8; --map-navaid: #9CC3E6;
    --map-airport: #F4F6FA; --map-airport-fill: #101826; --map-airport-halo: #08111C;
    --map-label: #DCE3EC; --map-label-2: #93A1B5; --map-label-halo: rgba(13, 21, 33, 0.90); --map-peak: #93A1B5;
    --map-route: #FFFFFF; --map-route-casing: #08111C; --map-route-selected: #0A84FF;
    --map-sigmet: #F4F6FA; --map-sigmet-fill: rgba(244, 246, 250, 0.06);
    --map-grid: rgba(244, 246, 250, 0.14);
    --map-sky: #050A12; --map-horizon: #1B2A3F; --map-fog: #0B1420;
  }
}
[data-theme="dark"] {
  color-scheme: dark;
  --bg: #070D15; --surface-solid: #1C1F26; --surface-raised: #262A33;
  --material-thick: rgba(22, 25, 32, 0.82); --material-regular: rgba(28, 31, 39, 0.66); --material-thin: rgba(34, 38, 47, 0.48);
  --material-stroke: rgba(255, 255, 255, 0.12); --material-highlight: rgba(255, 255, 255, 0.08); --scrim: rgba(0, 0, 0, 0.45);
  --text-1: #F4F6FA; --text-2: rgba(235, 235, 245, 0.72); --text-3: rgba(235, 235, 245, 0.44); --text-on-accent: #FFFFFF;
  --separator: rgba(120, 124, 136, 0.40); --separator-opaque: #38383A;
  --fill-1: rgba(120, 120, 128, 0.36); --fill-2: rgba(120, 120, 128, 0.32); --fill-3: rgba(118, 118, 128, 0.24);
  --accent: #0A84FF; --accent-pressed: #409CFF; --accent-tint: rgba(10, 132, 255, 0.22);
  --focus-ring: 0 0 0 3px rgba(10, 132, 255, 0.60);
  --shadow-1: 0 1px 2px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.30);
  --shadow-2: 0 2px 4px rgba(0,0,0,0.40), 0 10px 30px rgba(0,0,0,0.50);
  --shadow-3: 0 4px 8px rgba(0,0,0,0.45), 0 24px 60px rgba(0,0,0,0.60);
  --risk-nil: #8E9BAE; --risk-nil-on: #F4F6FA;
  --risk-light: #FFD60A; --risk-light-on: #0B0D12;
  --risk-moderate: #FF9F0A; --risk-moderate-on: #0B0D12;
  --risk-severe: #FF453A; --risk-severe-on: #0B0D12;
  --risk-extreme: #A63CF0; --risk-extreme-on: #FFFFFF; --risk-edge-extreme: #E3B5FF;
  --risk-fill-light: 0.34; --risk-fill-moderate: 0.46; --risk-fill-severe: 0.58; --risk-fill-extreme: 0.66;
  --risk-hatch: rgba(255, 255, 255, 0.38);
  --conf-bar-on: var(--text-1); --conf-bar-off: var(--fill-1);
  --map-ocean: #08111C; --map-ocean-label: #4E6480;
  --map-land: #172232; --map-land-dim: #111A27; --map-lake: #08111C;
  --map-hill-shadow: rgba(2, 6, 12, 0.80); --map-hill-highlight: rgba(143, 166, 196, 0.50); --map-hill-accent: rgba(8, 16, 28, 0.60);
  --map-relief-high: #C9D6E6;
  --map-coast: #3B4C63; --map-border: #5C6B80; --map-fir: #5F9C92;
  --map-airway-upper: #6CC7F5; --map-airway-lower: #8A96AD; --map-airway-casing: rgba(8, 17, 28, 0.70);
  --map-fix: #A9B6C8; --map-navaid: #9CC3E6;
  --map-airport: #F4F6FA; --map-airport-fill: #101826; --map-airport-halo: #08111C;
  --map-label: #DCE3EC; --map-label-2: #93A1B5; --map-label-halo: rgba(13, 21, 33, 0.90); --map-peak: #93A1B5;
  --map-route: #FFFFFF; --map-route-casing: #08111C; --map-route-selected: #0A84FF;
  --map-sigmet: #F4F6FA; --map-sigmet-fill: rgba(244, 246, 250, 0.06);
  --map-grid: rgba(244, 246, 250, 0.14);
  --map-sky: #050A12; --map-horizon: #1B2A3F; --map-fog: #0B1420;
}

/* ---- System preferences ---- */
@media (prefers-reduced-transparency: reduce) {
  :root { --material-thick: var(--surface-solid); --material-regular: var(--surface-solid); --material-thin: var(--surface-raised);
          --blur-thin: 0px; --blur-regular: 0px; --blur-thick: 0px; }
}
@media (prefers-contrast: more) {
  :root { --text-2: var(--text-1); --separator: var(--separator-opaque); --material-stroke: var(--separator-opaque); }
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-move: 0ms; --dur-sheet: 0ms; --dur-emphasis: 0ms; --dur-camera: 0ms; --dur-camera-short: 0ms; }
}

/* ---- Material recipe (use for every floating surface) ---- */
.material {
  background: var(--material-regular);
  -webkit-backdrop-filter: blur(var(--blur-regular)) saturate(var(--material-saturate));
  backdrop-filter: blur(var(--blur-regular)) saturate(var(--material-saturate));
  border: 0.5px solid var(--material-stroke);
  box-shadow: inset 0 1px 0 var(--material-highlight), var(--shadow-2);
}
```

### 2.1 Risk scale rules

| Step | Letter | Dark | Light | Map fill | Second cue (not colour) |
|---|---|---|---|---|---|
| Nil | N | `#8E9BAE` outline | `#8C97A6` outline | none (transparent) | no fill |
| Light | L | `#FFD60A` | `#E0B000` | flat | — |
| Moderate | M | `#FF9F0A` | `#E06A00` | flat | 1 px edge line |
| Severe | S | `#FF453A` | `#D7261E` | flat + 45° hatch, 8 px pitch, 1 px | 1.25 px edge line |
| Extreme | X | `#A63CF0` | `#7A1FA2` | flat + cross-hatch, 8 px pitch, 1 px | 1.5 px edge in `--risk-edge-extreme` |

- Hue order follows weather radar (yellow, red, magenta-violet), which crews already read without thinking.
  Colour-blind safety comes from three redundant cues: a lightness step of at least 9 L* between neighbours, hatch on
  the top two steps, and the letter N/L/M/S/X wherever a swatch appears. Colour is never the only cue.
- There is no green. "Nil" is the absence of fill. Green would collide with the FIR colour and with red under
  deuteranopia.
- The L* values were computed, not yet simulated. Before release, check both themes in a CVD simulator (protan, deutan,
  tritan) on a real iPad at minimum brightness. Tritan is the weak case for severe vs extreme: the hatch must be on.
- EDR thresholds are config, not design (`config/edr-thresholds.json`, per aircraft weight class). Working defaults to
  confirm with flight ops: light ≥ 0.10, moderate ≥ 0.20, severe ≥ 0.45, extreme: no agreed ICAO value, leave the step
  unused until ops sets one.

### 2.2 Confidence treatment

Confidence is High / Medium / Low. It is shown three ways at once:

1. **Word**: "Confidence: Medium". Always spelled out next to the verdict.
2. **Glyph**: three ascending bars (4 × 6/9/12 px, 2 px gap, 1 px radius). Filled bars in `--conf-bar-on`, the rest in
   `--conf-bar-off`. Neutral colour, never a risk colour.
3. **Rendering**: risk fill alpha is multiplied by `--conf-high|medium|low`. At Low, edges and chart strokes become
   dashed (`--conf-low-dash`) and probabilities are shown as a range ("40–60%"), not a single number.

---

## 3. Map style spec

Engine: MapLibre GL JS 5.x, Mercator. No globe projection (not available in MapLibre Native; keep parity).
`minZoom 2`, `maxZoom 10`, `maxPitch 70`. Zooms below are MapLibre zooms (512 px tiles).

### 3.1 Sources

| id | type | content | notes |
|---|---|---|---|
| `ne` | geojson / bundled vector | Natural Earth land, countries, coastline, lakes | 50m below z5, 10m from z5. Bundled, works offline. |
| `dem-shade` | raster-dem | AWS Terrarium `…/terrarium/{z}/{x}/{y}.png` | `encoding: "terrarium"`, `tileSize: 256`, `maxzoom: 10` |
| `dem-terrain` | raster-dem | same tiles, second source | separate source for `setTerrain` avoids hillshade artefacts |
| `aero` | geojson | airports, airways, fixes, navaids, FIRs, peaks | ours; feature props listed per layer |
| `edr` | geojson | iso-band polygons + band edges for one FL and one valid time | two instances, `edr-a` and `edr-b`, for crossfade |
| `edr-cells` | geojson | native 0.25° cell squares with `edr` value | loaded only at z ≥ 7.5 |
| `sigmet` | geojson | SIGMET polygons | |
| `route` | geojson | route line split into segments with `risk`, `conf` | |

Symbols are inline SVGs rasterised to SDF images with `map.addImage(id, img, { sdf: true })` at 2× and tinted with
`icon-color` from tokens. One image per shape, no per-theme sprites.

### 3.2 Layers, bottom to top

Format: **layer id** — type — paint/layout. "D" = dark value, "L" = light value. Where only a token is given, use it in both themes.

**1. `ocean`** — background — `background-color: --map-ocean` (D `#08111C`, L `#CBD9E6`).

**2. `land-dim`** — fill, all NE land — `--map-land-dim` (D `#111A27`, L `#E4E8ED`).
**3. `land`** — fill, NE countries where `ADM0_A3 in [CHL, ARG]` — `--map-land` (D `#172232`, L `#EEF1F4`).
The two crossing countries sit one step brighter than the rest of the continent. No country tinting beyond this.

**4. `relief-tint`** — color-relief on `dem-shade` (optional, GL JS ≥ 5.6; skip if unsupported) — gives the high Andes a
pale crest so the range reads at continent zoom without colour.
`color-relief-color`: interpolate on elevation: 0 m → transparent · 2,500 m → transparent · 4,000 m →
`--map-relief-high` at 0.10 · 5,500 m → `--map-relief-high` at 0.28 (D) / 0.55 (L). Visible z2–z10.

**5. `hillshade`** — hillshade on `dem-shade`.

| Property | Dark | Light |
|---|---|---|
| `hillshade-shadow-color` | `rgba(2,6,12,0.80)` | `rgba(58,74,96,0.55)` |
| `hillshade-highlight-color` | `rgba(143,166,196,0.50)` | `rgba(255,255,255,0.90)` |
| `hillshade-accent-color` | `rgba(8,16,28,0.60)` | `rgba(120,135,155,0.35)` |
| `hillshade-illumination-direction` | 315 | 315 |
| `hillshade-illumination-anchor` | `viewport` | `viewport` |
| `hillshade-exaggeration` by zoom | z2 0.30 · z4 0.45 · z6 0.60 · z8 0.55 · z10 0.40 | z2 0.25 · z4 0.38 · z6 0.50 · z8 0.45 · z10 0.35 |

Visible at all zooms (z2–z10). While the turbulence layer is on, multiply exaggeration by 0.7 (ease 200 ms) so the
relief does not muddy the risk colours. `viewport` anchor keeps the light top-left when the map is rotated, which
prevents relief inversion.

**6. `lake`** — fill, NE lakes, `minzoom 5` — `--map-lake`. No rivers, no roads, no cities, no land cover. Ever.

**7. `terrain` (3D, optional)** — `map.setTerrain({ source: "dem-terrain", exaggeration })`.
Exaggeration is set on `zoomend`: z ≤ 6.5 → 1.8 · z 6.5–8 → 1.5 · z > 8 → 1.2. Off in 2D mode (`setTerrain(null)`).
Sky (style root `sky`): `sky-color --map-sky`, `horizon-color --map-horizon`, `fog-color --map-fog`,
`fog-ground-blend 0.6`, `horizon-fog-blend 0.5`, `sky-horizon-blend 0.8`.
Whenever 3D is on, the attribution line reads "Terrain ×1.8" (current value). 3D is an enhancement: the 2D hillshade
map must be complete without it, and MapLibre Native terrain support must be verified before the iOS build depends on it.

Cameras (all `[lng, lat]`):

| Camera | center | zoom (iPhone / iPad / desktop) | pitch | bearing |
|---|---|---|---|---|
| Continent | fitBounds `[[-84,-56],[-33,13.5]]` (Cape Horn to Aruba), padding 48 | ≈ 2.2 / 2.7 / 3.0 | 0 | 0 |
| **Andes hero** | `[-69.85, -32.95]` (between SCEL and SAME, Aconcagua just north) | 6.0 / 6.5 / 6.8 | 52 | 8 |
| Crossing 2D (work view) | fitBounds `[[-73.5,-36.5],[-66.5,-29.5]]`, padding = panel insets | ≈ 5.6 / 6.2 / 6.6 | 0 | 0 |

The hero looks north along the range: Chile on the left, Argentina on the right, so a crossing reads left-right as on a
chart. Bearing 8° gives the ridges depth without disorienting. The compass button returns to north-up.

**8. Turbulence (EDR)** — rendered as **filled iso-bands with edge lines**. Not a `heatmap` layer (that is point
density, not a field) and not a blurred raster (it hides the model resolution).

- Bands are computed from the 0.25° WAFS grid by marching squares at the threshold values, linear interpolation only,
  no smoothing. One GeoJSON per (FL, valid time): polygons with `band: "light" | "moderate" | "severe" | "extreme"`,
  plus edge lines.
- **`edr-fill`** — fill — `fill-color` by `band` from `--risk-*`; `fill-opacity` = `--risk-fill-<band>` × confidence
  (D 0.34 / 0.46 / 0.58 / 0.66, L 0.42 / 0.52 / 0.62 / 0.70); `fill-antialias: false` (no seams). Nil is not drawn.
- **`edr-hatch`** — fill with `fill-pattern` — severe: 45° lines; extreme: cross-hatch; 8 px tile, 1 px line in
  `--risk-hatch`. Drawn from z4 up (below z4 the hatch turns to noise).
- **`edr-edge`** — line — colour = band colour (`--risk-edge-extreme` for extreme), opacity 0.9, width: light 0 ·
  moderate 1.0 · severe 1.25 · extreme 1.5 px. Dashed `[3,3]` when confidence is Low.
- **`edr-edge-label`** — symbol, line placement, `minzoom 6` — text `MOD` / `SEV` / `EXTR`, Inter SemiBold 10 px,
  colour = band colour, halo `--map-label-halo` 1.25 px, `symbol-spacing 420`.
- **`edr-cell-grid`** — line on `edr-cells`, `minzoom 7.5` — 0.5 px `--map-grid`. Tap a cell: popover with EDR value
  (2 decimals), band, FL, valid time.
- Position: above hillshade, below coast, borders, airways and all labels. The relief stays visible through the fill;
  nothing aeronautical is ever covered.
- Change of FL or time: crossfade `edr-a` ↔ `edr-b` over 200 ms. The scrubber snaps to 3-hourly steps. Never
  interpolate between forecast grids.

**9. SIGMET** — official products are neutral, model fields are coloured.
`sigmet-fill` fill `--map-sigmet-fill`; `sigmet-line` line 2 px `--map-sigmet`, dash `[4,2]`, opacity 0.9;
`sigmet-label` symbol at polygon centroid: capsule tag, Inter SemiBold 11 px, e.g. `SIGMET 3 · SEV MTW · FL250/400`.

**10. `coastline`** — line — `--map-coast` (D `#3B4C63`, L `#8FA3B8`), width z2 0.5 · z6 0.75 · z10 1.0 px.

**11. `country-border`** — line — `--map-border` (D `#5C6B80`, L `#8794A6`), opacity 0.7, solid, width z2 0.5 · z5
0.75 · z8 1.25 px. Country names: Inter Medium, caps, tracking 0.12 em, 11 px at z3 → 13 px at z6, `--map-label-2`,
hidden above z7.

**12. FIR boundaries** — `fir-line` line — `--map-fir` (D `#5F9C92`, L `#2F7F74`), opacity 0.6, width z3 0.75 · z6
1.0 · z9 1.5 px, dash `[8,3,1.5,3]` (long-short, the modern stand-in for the charted tick line). `minzoom 3`.
`fir-label` symbol, line placement, `minzoom 5`: `SCEZ SANTIAGO FIR`, Inter Medium 10 px caps, same colour, opacity
0.8, `symbol-spacing 600`, offset 0.8 em to the inside of the FIR.

**13. Airways.** Feature props: `designator`, `level: "upper" | "lower"`, `nav: "rnav" | "conv" | null`,
`crossing: true` when the segment crosses the Andes crest. Lower drawn first, upper on top.

| | Upper | Lower |
|---|---|---|
| Colour | `--map-airway-upper` (D `#6CC7F5`, L `#0F6CBD`) | `--map-airway-lower` (D `#8A96AD`, L `#6B778C`) |
| Min zoom | crossing 3 · others 5 | 6.5 (off by default) |
| Width (px) | z3 0.6 · z5 1.0 · z7 1.5 · z9 2.25 | z6.5 0.75 · z8 1.0 · z10 1.5 |
| Crossing airways | width × 1.5, opacity 1.0 | width × 1.25 |
| Non-crossing opacity | 0.55 | 0.45 |
| Casing | +2 px total, `--map-airway-casing` | +1.5 px total, same |
| Dash | `rnav` or unknown: solid · `conv`: `[10,4]` | same |

Labels (`airway-label`, symbol, line placement): designator in a rounded box, the charted convention. Inter SemiBold,
10 px at z5 → 12 px at z8; text colour = airway colour; box = `icon-text-fit` on a 4 px-radius SDF rectangle filled
`--map-label-halo`; `symbol-spacing 380`; `text-rotation-alignment: viewport` (always upright); `text-padding 8`.
Crossing airways label from z4.5, others from z6. One selected airway: width + 1.5 px, colour `--accent`, others drop
to 0.35 opacity.

**14. Route** — the plan is neutral; its casing carries the risk.
`route-risk` line 9 px, colour by segment `risk` from `--risk-*`, opacity 0.95 (nil: `--risk-nil` at 0.5);
`route-casing` line 5.5 px `--map-route-casing`; `route-line` line 3 px `--map-route` (D white, L ink), round caps and
joins; `route-selected` line 5 px `--map-route-selected` over the selected segment, with a 12 px 0.25-opacity glow line
beneath. Route waypoints: 5 px white/ink dots with 1.5 px casing. Widths are constant across zooms.

**15. Waypoints / fixes** — standard shapes, 1.25 px stroke, round joins, colour `--map-fix`.

| Kind | Symbol | Size | Min zoom (symbol / label) |
|---|---|---|---|
| RNAV waypoint, compulsory | four-point star, filled | 9 px | on crossing airways 6 / 7 · others 7.5 / 8.5 |
| RNAV waypoint, on request | four-point star, outline | 9 px | same |
| Fix, compulsory | triangle, filled | 8 px | same |
| Fix, on request | triangle, outline | 8 px | same |

Labels: five-letter name, Inter Medium 10 px (11 px at z ≥ 9), `--map-label-2`, offset `[0.7, 0]` em right, halo 1.25 px.
Fixes on the active route are always shown from z5 with labels in `--map-label`.

**16. Navaids** — `--map-navaid` (D `#9CC3E6`, L `#2E5E8C`), 1.25 px stroke, `minzoom 6`, labels `minzoom 7`.
VOR: hexagon with centre dot, 12 px. VOR/DME: the hexagon inside a square, 13 px. DME: square with centre dot, 11 px.
NDB: centre dot with one dotted ring, 12 px. No compass rose. Label: ident (3 letters) Inter SemiBold 10 px; frequency
in `--map-label-2` 9 px on a second line from z8.5.

**17. Airports** — the charted aerodrome circle, modernised: a ring with one bar through it at the main runway's true
bearing (`rwy_brg_true` drives `icon-rotate`). Colour `--map-airport`, ring fill `--map-airport-fill`, halo
`--map-airport-halo` 1.5 px.

| Tier | Which (data-driven `tier`) | Symbol | Symbol min zoom | Label |
|---|---|---|---|---|
| Hub | SCEL, SAME, SAEZ, plus home base TNCA | ring 14 px, 2 px stroke, runway bar 20 px | 2 | ICAO from z2.5 (SemiBold 12 → 13 px). Name on second line from z5.5 (Regular 11 px, `--map-label-2`) |
| Main | e.g. SABE, SACO, SCIE, SCFA, SAZS, SASA, SCTE | ring 11 px, 1.75 px stroke, bar 16 px | 4 | ICAO from z5 (SemiBold 11 px). Name from z7.5 |
| Secondary | the rest in data | ring 7 px, 1.5 px stroke, no bar | 6 | ICAO from z7 (Medium 10 px). No name |

- `symbol-sort-key` by tier so hubs always win collisions. `text-variable-anchor: [left, right, top, bottom]`,
  `text-radial-offset 0.9`. ICAO labels use `--map-label`; halo `--map-label-halo` 1.5 px.
- From z8.5, hub and main labels add elevation: `SAME · 2,310 ft`.
- When the pressure gauge is open, SCEL and SAME gain a second outer ring (22 px, 1.5 px, `--accent`) and a QNH tag
  (`1018 hPa`, Inter SemiBold 11 px in a capsule).
- Selected airport: ring fills with `--accent`, 28 px halo ring at 0.25 opacity.

**18. `peak`** — symbol, `minzoom 6` — small solid triangle 6 px `--map-peak` + name and elevation in feet
(`Aconcagua 22,838`), Inter Regular 10 px. Only peaks on or near the crossing corridors, from data. Max 8 in view.

**19. `selection`** — the accent halo ring / line glow for the selected feature. Always the top layer.

Label order when space runs out (highest wins): route fixes · hub airports · SIGMET tag · crossing airway designators ·
main airports · EDR edge labels · FIR · peaks · everything else.

---

## 4. Layout

Breakpoints (by viewport width): **compact** < 744 px (iPhone, iPad slide-over) · **regular** 744–1279 px (iPad) ·
**wide** ≥ 1280 px (desktop, iPad 13" landscape). The map is always full-bleed under everything, including the status bar.
All floating surfaces use the material recipe, respect `env(safe-area-inset-*)`, and sit `--panel-inset` from edges.

Native mapping: bottom sheet → `.sheet` with `presentationDetents`; sidebar → `NavigationSplitView`-style floating
panel; inspector → `.inspector`; pickers → segmented `Picker`; toolbar buttons → glass button groups.

### 4.1 Shared pieces

**Route capsule (top).** `SCEL → SAME · 787-8`. Tap to edit departure, destination, airway/route string, aircraft
(787-8 or Global 8000), planned level and ETD (UTC). ICAO ids in `--font-mono` semibold.

**Map buttons (top right, vertical glass group, 44 × 44 each, 0.5 px separators):** Layers · 2D/3D · Recentre
("Andes"). A compass appears under the group only when bearing ≠ 0; tap = north-up.

**Layers card** (popover on regular/wide, half-height sheet on compact; modelled on Apple Maps "Choose Map"):

| Section | Rows (switch rows, 44 pt) | Default |
|---|---|---|
| Weather | Turbulence (EDR) · SIGMET · Pressure gauge stations | Turbulence on, SIGMET on |
| Aeronautical | Upper airways · Lower airways · Waypoints · Navaids · FIR boundaries | Upper on, FIR on, rest off |
| Terrain | Relief shading · 3D terrain | Relief on, 3D on at launch |
| Appearance | segmented: Auto / Light / Dark | Dark |

**Flight-level rail (right edge, vertical).** Altitude is vertical, so the control is vertical. A 44 px-wide glass
capsule with one stop per WAFS level in data (expected: FL100, 140, 180, 240, 270, 300, 340, 360, 390, 410, 450), top
= highest, 28 px pitch (≈ 324 px tall). Each stop: a 6 px risk dot (max risk along the route at that level for the
selected time; grey ring for nil) and a caption-2 label. Thumb: a 64 × 32 capsule that extends left and reads `FL390`
in `--font-rounded` semibold. Drag or tap a stop; snaps with a light haptic (native). If the planned level is above
the top level (the Global 8000 can cruise above FL450): the rail shows a dashed stop "Above FL450" and the card says
"No forecast above FL450. Showing FL450." On compact width the rail collapses to a `FL390` chip (44 pt high) at the
right edge above the sheet; tapping it expands the rail in place and collapses again 3 s after the last touch.

**Time scrubber (horizontal, Apple Weather style).** 64 px high. One cell per forecast step, T+6 … T+36, 3-hourly, 11
cells. Each cell: valid time `18Z` (subhead, semibold when selected), weekday in caption-2 under the first cell of
each UTC day (`FRI 13`), and a 4 px risk bar along the bottom (risk on the route at the selected FL). Selected cell:
`--fill-1` rounded rect, 10 px radius. A play button (44 pt) on the left steps once per 900 ms and stops at the end.
Cells whose valid time has passed are dimmed to 0.4 and not selectable. A "Now" tick marks the current UTC time
between cells. Freshness stamp sits right-aligned above the scrubber: `WAFS run 12Z · valid 18Z`.

**Legend.** A thin-material capsule, 28 px high: `EDR FL390` then five swatches (12 × 12, 3 px radius, hatch
included) with letters `N L M S X`. Tap opens a popover with full names, EDR thresholds for the selected aircraft and
"Colours show forecast likelihood bands. SIGMETs are outlined." Hidden when the turbulence layer is off.

**Crossing card** (the summary; the first thing in the sheet/sidebar):

```
SCEL → SAME via <airway>                      787-8
Crest at 1842Z · FL390

Moderate likely                               ← title-2, semibold, text-1; 10 px risk square with letter M before it
Confidence: Medium  ▂▄_                       ← subhead + 3-bar glyph

Light      ████████████░░  80%
Moderate   ████████░░░░░░  55%                ← three bars, 6 px high, risk colours, tabular figures
Severe     █░░░░░░░░░░░░░  10%

ΔQNH SCEL − SAME   +7.2 hPa     500 hPa wind  270°T / 55 kt
EDR max on route   0.31         SIGMET        1 active (SCEZ)

WAFS run 12Z · valid 18Z   METAR SCEL 1700Z · SAME 1700Z
Awareness aid. Check the official briefing and SIGMETs.
```

Headline wording is fixed: `<Nil|Light|Moderate|Severe|Extreme> <unlikely|possible|likely|very likely>`. Below the card:
a "Best level" row when another level is at least one band lower at the same time: `Smoother at FL430: Light likely`.

**Airport detail** (popover anchored to the symbol on regular/wide, 320 px wide; pushed into the sheet on compact):
ICAO in mono title-2 + IATA in `--text-2` · name · city, country · `Elevation 1,555 ft` · longest runway
(`17L/35R · 3,748 m`) · METAR block: observation time `1700Z` with age (`22 min ago`), **QNH `1018 hPa`** (title-3,
rounded), temperature/dew point `18 / 07 °C`, wind `220° / 08 kt` · raw METAR in mono footnote, collapsed by default ·
buttons: "Set as departure", "Set as destination". No METAR: "No METAR for SCEL." METAR older than 90 min: age shown as
"Old · 1 h 52 min" and QNH in `--text-2`.

**Airway detail** (same container): designator in the charted box · `Upper · RNAV 5` · limits `FL250–UNL` ·
segment list rows: `FIX1 → FIX2`, track `092°M`, distance `48 NM`, `MEA 26,000` / `MOCA 24,300` when in data (else
"MEA not in data"), and a risk dot for the selected FL and time. Tapping a row highlights the segment on the map.
Button: "Use for route".

**Cross-section** (route profile). X = distance along route in NM with fix names as ticks. Y = FL000 to the top
level. Terrain: filled silhouette in `--map-land` one step lighter, 1.5 px top edge `--map-label-2`; MEA line dashed
1 px when available. Risk: one cell per (route sample × WAFS level), band colours at the map fill alphas, hatch on
S/X, letter in the cell when the cell is ≥ 22 px wide. Planned level: 2 px `--map-route` line with the aircraft
position tick at ETA. Selected segment is mirrored on the map (`route-selected`). Above the top level: hatched neutral
area labelled "No forecast above FL450". Minimum height 200 px.

**Pressure gauge (Harrison abacus).** A square chart: axes, zones and thresholds come from
`data/harrison-abacus.json` exactly as in the source nomogram; design does not define them. Rendering: zone areas in
risk colours at map fill alphas with letters; axes labelled with units (`ΔQNH SCEL − SAME, hPa` and `500 hPa
cross-range wind, kt`); current point = 10 px `--text-1` dot with 2 px casing and a value tag; last 6 h as a 1.5 px
trail of fading dots; forecast points (if any) as hollow dots joined by a dashed line. Above the chart, the two QNH
values side by side with their observation times. Sign convention is always written out: `SCEL − SAME`.

### 4.2 iPhone (compact)

- **Top**: route capsule, left-aligned, max width = screen − 76 px. Map buttons top right. Legend capsule bottom left,
  8 px above the sheet. FL chip bottom right, 8 px above the sheet.
- **Bottom sheet**, always present, `--material-thick`, top radius `--radius-xl`, grabber 36 × 5 px. Map stays
  interactive at the first two detents.

| Detent | Height | Contents |
|---|---|---|
| Peek | 148 pt + safe area | Grabber · one verdict line (`Moderate likely · Confidence: Medium · FL390`, with risk square) · time scrubber |
| Medium | 50% | Above, plus the full crossing card, "Best level" row, and a segmented control: Crossing / Section / Gauge / SIGMET |
| Large | full height − 54 pt | Selected tab in full: cross-section (landscape hint), abacus, SIGMET list, FL × time matrix, sources and data times |

- Feature taps (airport, airway, cell) push a detail page inside the sheet at Medium, with a back chevron; the map pans
  so the feature clears the sheet.
- Landscape iPhone: sheet becomes a 340 pt left panel (regular-style), rail returns to the right edge.

SwiftUI: `.presentationDetents([.height(148), .medium, .large])`,
`.presentationBackgroundInteraction(.enabled(upThrough: .medium))`, `.interactiveDismissDisabled()`.

### 4.3 iPad landscape (regular)

- **Left: floating sidebar**, 360 px wide, inset 12 px, radius `--radius-xl`, `--material-thick`, height fits content
  up to the screen minus insets, scrolls inside. Top to bottom: route capsule (in the panel header) · crossing card ·
  segmented control Crossing / Section / Gauge / SIGMET · tab content. A chevron in the header collapses it to the
  route capsule alone.
- **Right edge**: map buttons (top), FL rail (vertically centred).
- **Bottom centre**: time scrubber as a floating bar, width = min(720 px, space between sidebar and rail − 24 px),
  12 px from the bottom. Legend capsule sits directly above its left end.
- **Cross-section drawer**: when the Section tab is open, a 280 px-high panel slides up between the sidebar and the
  rail; the scrubber docks to its top edge. Drag the top edge to resize 200–420 px.
- **Detail**: airport/airway popovers anchor to the feature with an arrow, 320 px wide. If the sidebar would be
  covered, the map pans instead.
- Portrait iPad: sidebar becomes a 320 px panel that overlays from the left; everything else is the same.

### 4.4 Desktop (wide)

Same as iPad landscape, with:

- Sidebar 380 px. A right **inspector** (340 px, floating, same material) replaces popovers for airport and airway
  detail and stays open while you click through features. The FL rail and map buttons shift left of it.
- Cross-section drawer is open by default at ≥ 1440 × 900.
- Hover states, a cursor readout chip bottom right (`33°05′S 069°51′W · 14,200 ft terrain`, footnote, thin material),
  keyboard shortcuts (section 7), and right-click on the map → "Route from here / Route to here / What's here".
- Max content: none. The map always fills the window; panels keep their fixed widths.

---

## 5. Opening experience and states

### 5.1 First launch

1. **0 ms** — Screen is `--map-ocean`. Bundled land, coast and borders paint in the first frame (no network needed).
   Camera: Continent. Hub airports and their ICAO labels are visible, including TNCA at the top. No panels yet.
2. **0–600 ms** — Hillshade tiles fade in as they arrive (200 ms per tile). Toolbar buttons fade in.
3. **600–3,800 ms** — `flyTo` Andes hero: duration `--dur-camera` (3,200 ms), `curve 1.42`, easing `--ease-camera`,
   pitch 0 → 52, bearing 0 → 8. Terrain is enabled at the start of the flight so the range rises during it.
4. **At 2,600 ms** — Upper crossing airways fade in west to east (opacity 0 → 1, 400 ms each, 80 ms stagger), then
   their designator labels.
5. **At 3,800 ms** — Sheet rises to Peek (iPhone) or sidebar fades and slides 16 px in (iPad/desktop), 450 ms,
   `--ease-sheet`. Scrubber and rail fade in. The turbulence layer for the nearest valid time and the planned (or
   last used) level fades in over 400 ms, and the verdict line fills.

Any touch during the flight cancels it and leaves the camera where it is. Later launches: restore the last camera with
no animation if the app was used in the last 12 h; otherwise jump to Continent and run step 3 at 1,800 ms. With
`prefers-reduced-motion`: `jumpTo` the hero camera and crossfade the layers in 200 ms. Turning the turbulence layer on
from the Layers card for the first time in a session eases to Crossing 2D (pitch 0, bearing 0, 900 ms); the user can
pitch back at any time and we do not fight them again.

### 5.2 States

| State | What the user sees | Copy |
|---|---|---|
| Empty: no route | Hero map, crossing card replaced by a prompt and two fields | "Plan a crossing. Enter departure and destination." Quick picks: `SCEL → SAME`, `SAME → SCEL`, `SCEL → SAEZ` |
| Loading: forecast | Map and controls usable. Scrubber cells and rail dots show neutral shimmer bars (`--fill-2`, 1.2 s sweep; static when reduced motion). Verdict line: skeleton | "Loading WAFS run 12Z…" |
| Loading: hillshade | Flat land until tiles arrive, then fade in. No spinner | — |
| Offline, cached data | Everything works from cache. A neutral banner chip under the route capsule with a cloud-slash icon | "Offline. WAFS run 12Z, fetched 1432Z." |
| Offline, nothing cached | Base map only. Card explains | "Offline. No forecast stored. Connect once before the flight to save the latest run." |
| Old run (run time > 12 h ago) | Stamp gains a clock icon and `--text-1` weight; verdict stays but confidence drops one step | "Old run: WAFS 00Z. A newer run is due." |
| Expired (all valid times passed) | Turbulence layer removed, verdict withheld | "Forecast expired. Last valid time 12Z Thu. Refresh when online." |
| Fetch error | Layer keeps the last good data; chip with retry | "Turbulence data did not load. Retry" |
| Partial data (a level or step missing) | That rail stop or scrubber cell is dashed and disabled | "FL410 not in this run." |
| METAR missing or old | Gauge shows the last value greyed with its age; verdict notes it | "SAME QNH is 2 h 10 min old. Gauge not updated." |
| No SIGMET | SIGMET tab | "No active SIGMET for SCEZ or SAMF." Always name the FIRs checked |

Errors and stale states use neutral colour, an icon and words. Never red or orange (reserved for turbulence).

### 5.3 Data-freshness stamps

- Every data product on screen carries its own stamp, in footnote size, `--text-2`, tabular figures.
- Formats: model `WAFS run 12Z · valid 18Z` (add weekday when not today UTC: `valid 06Z Sat`). Observations
  `METAR SCEL 1700Z`. SIGMET `Valid 1500Z–1900Z`. Fetch time when offline: `fetched 1432Z`.
- All times are UTC with `Z`. No local time anywhere, no relative-only times ("22 min ago" may follow an absolute time,
  never replace it).
- Units and references, always written: `FL390`, `kt`, `hPa`, `ft` (terrain and elevations), `NM`, `°C`, wind as
  `270°T / 55 kt` for model winds, `°M` for charted airway tracks. EDR to two decimals, no unit.
- Offline cache: bundle the vector base; pre-cache hillshade tiles z2–z9 for `[[-76,-40],[-64,-26]]` on first online
  launch; keep the last two WAFS runs and the last METAR/SIGMET set.

---

## 6. Components

Common state rules: **hover** (pointer only) = `--fill-3` overlay · **pressed** = `--fill-1` overlay and scale 0.97 over
`--dur-press` · **selected** = `--accent-tint` background with `--accent` text/icon, or the control's own selected
style below · **disabled** = 0.38 opacity, no pointer events · **focus-visible** = `--focus-ring`. Touch targets are
≥ 44 × 44 pt even when the visible shape is smaller.

| Component | Size | Default | Selected / active | Notes |
|---|---|---|---|---|
| Glass icon button | 44 × 44, radius 14; grouped: shared capsule, radius 14 | `--material-regular`, icon `--text-1` 22 px | icon `--accent`, bg `--accent-tint` | Layers, 2D/3D, Recentre, Compass |
| Route capsule | height 44, radius full, padding 0 16 | `--material-regular`, mono ICAO ids | editing: expands to a card with fields | Arrow glyph between ids |
| Text field | height 44, radius 14 | `--fill-3` bg, `--text-1`, placeholder `--text-3` | focus: ring + caret `--accent` | ICAO fields uppercase, mono, 4 chars, auto-advance |
| Primary button | height 44 (50 in sheets), radius 14 | `--accent` bg, `--text-on-accent`, headline | pressed `--accent-pressed` | One per view at most |
| Secondary button | height 44, radius 14 | `--fill-2` bg, `--accent` text | pressed `--fill-1` | "Set as departure", "Retry" |
| Segmented control | height 32 (36 compact), radius 10, thumb radius 8 | track `--fill-3`, labels subhead `--text-1` | thumb `--surface-solid` (D `#636366` at 0.6), `--shadow-1`, label semibold | Thumb slides 200 ms `--ease-out` |
| Switch row | row 44, switch 51 × 31 | track `--fill-1` | track `--accent` | Layers card. Whole row is the target |
| List row | min height 44, padding 0 16, separator inset 16 | title body, detail `--text-2` | `--accent-tint` bg, radius 10 | Chevron 13 px `--text-3` when it pushes |
| FL rail | 44 wide, stops 28 pitch, thumb 64 × 32 | `--material-regular`, labels caption-2 `--text-2` | thumb `--surface-solid`, label rounded semibold `--text-1`, `--shadow-1` | Disabled stop: dashed ring, 0.38 |
| Time scrubber cell | 56 × 64 (min 44 wide) | label subhead `--text-2`, 4 px risk bar | `--fill-1` bg, label semibold `--text-1` | Past: 0.4 opacity, not focusable |
| Play button | 44 × 44 | play triangle `--text-1` | pause bars `--accent` | Stops at last step |
| Risk chip | height 22, radius 6, padding 0 8 | bg `--risk-*`, text `--risk-*-on`, caption semibold, letter + word (`M Moderate`) | — | Nil: transparent, 1 px `--risk-nil` border. Never text in risk colour on a plain surface below title-3 size |
| Confidence glyph | 16 × 12 | bars per 2.2 | — | Always next to the word |
| Probability bar | height 6, radius 3 | track `--fill-2`, fill `--risk-*` | Low confidence: fill shown as a range with a lighter tail | Value right-aligned, tabular |
| Freshness stamp | footnote, height 18 | `--text-2`, optional 12 px icon | old: `--text-1` + clock icon | Never coloured |
| Status chip (offline, error) | height 32, radius full | `--material-thin`, icon + footnote | with action: trailing `--accent` label | Under the route capsule |
| Legend capsule | height 28, radius full | `--material-thin`, caption | — | Swatches 12 × 12, hatch included |
| Bottom sheet | detents in 4.2, top radius 26 | `--material-thick`, grabber 36 × 5 `--fill-1` | Large: `--shadow-3`, map dimmed by `--scrim` | Rubber-bands past detents |
| Sidebar / inspector | 360–380 / 340, radius 26 | `--material-thick`, `--shadow-2` | collapsed: route capsule only | Header 52 high, sticky |
| Popover | 320 wide, radius 20, arrow 12 | `--material-thick`, `--shadow-2` | — | Opens 200 ms scale 0.96 → 1 from the anchor |
| Map callout tag | height 22, radius 6 | `--material-thin`, caption semibold | — | QNH tags, SIGMET tags, cell value |
| Skeleton | radius 6 | `--fill-2` with sweep | — | Matches the text block it replaces |
| Tooltip (wide only) | radius 8, footnote | `--surface-solid`, `--shadow-1` | — | 600 ms delay; shows shortcut key |

### 6.1 Icon set (inline SVG)

All icons: 24 × 24 viewBox, 1.75 px stroke, round caps and joins, `currentColor`, no fills unless stated. Map symbols
are in 3.2 and are separate SDF images.

| Name | Shape |
|---|---|
| `layers` | Three stacked rounded rhombuses, offset vertically |
| `view-3d` | Isometric cube outline with the three visible edges meeting at centre |
| `view-2d` | Flat rounded square with a small north tick on the top edge |
| `recenter-andes` | Two overlapping mountain peaks inside open corner brackets |
| `compass` | Circle with a two-tone needle, filled north half |
| `north-up` | Upward arrowhead with a small "N" above it |
| `chevron-left` / `-right` / `-down` | Single 90° chevron, 10 px tall |
| `close` | Two diagonal strokes crossing in a 12 px box |
| `play` / `pause` | Filled rounded triangle / two filled rounded bars |
| `arrow-route` | Thin rightward arrow, 14 px long, for `SCEL → SAME` |
| `swap` | Two opposed horizontal arrows, stacked |
| `turbulence` | Three horizontal wavy lines, the middle one broken by a small upward kink |
| `sigmet` | Irregular five-sided polygon outline with a small exclamation bar and dot inside |
| `gauge` | Semicircular dial arc with tick marks and a needle at about 60° |
| `section` | Mountain silhouette along the bottom with a straight horizontal line above it and one vertical tick |
| `airport` | Circle with a single diagonal bar passing through it (matches the map symbol) |
| `airway` | Straight line between two small four-point stars |
| `flight-level` | Two short stacked horizontal bars with an up-down double arrow to their right |
| `clock` | Circle with two hands at ten past ten |
| `cloud-slash` | Cloud outline with a diagonal slash through it |
| `refresh` | Three-quarter circular arrow, arrowhead at the open end |
| `info` | Circle with a dot and a short vertical bar ("i") |
| `warning` | Rounded triangle with a vertical bar and dot (neutral colour only) |
| `confidence-1/2/3` | Three ascending bars; 1, 2 or 3 filled (filled rects) |
| `locate` | Diagonal navigation arrowhead pointing up-right (device location, optional) |
| `aircraft` | Top-view airliner: slim fuselage, swept wings, small tailplane |
| `search` | Circle with a short handle at lower right |
| `ellipsis` | Three filled dots in a row |
| `checkmark` | Single tick stroke |
| `sun` / `moon` | Circle with eight short rays / crescent (Appearance) |

---

## 7. Accessibility

**Contrast**

- Text: ≥ 4.5:1 for all text, ≥ 7:1 for primary data (verdict, QNH, FL, times), measured against the material over
  the darkest and the lightest map area it can cover. `--text-3` is for decoration only.
- Non-text: ≥ 3:1 for control boundaries, icons, focus rings, airways, airport symbols and every risk band edge
  against the land colour. Light-band fill has no edge; its legibility comes from the fill, verify ≥ 3:1 against
  `--map-land` at its alpha in both themes.
- Dark theme: no pure white surfaces and no pure black map (OLED smear). Brightest large area is a panel at
  `--material-thick`. Check the whole screen at minimum iPad brightness in a dark room.
- Honour `prefers-contrast: more` and `prefers-reduced-transparency` (token overrides in section 2). With increased
  contrast, also set airway opacity to 1.0 and all risk edges to 1.5 px.

**Colour independence**

- Every risk display carries a letter or word. Severe and extreme carry hatch. Confidence carries a word.
- A "Differentiate without colour" setting (follows the iOS setting when native) turns on letters inside scrubber and
  rail risk marks and raises hatch contrast.

**Motion**

- `prefers-reduced-motion`: no camera flight (jump + 200 ms crossfade), no stagger, no shimmer, no auto-play of the
  scrubber, sheet and popovers appear without travel. Layer crossfades stay (they are opacity only).
- Nothing blinks or pulses, at any severity.

**Dynamic Type**

- All UI text scales with the system setting up to AX3; panels scroll instead of truncating. At accessibility sizes the
  crossing card stacks its two-column facts into one column and the scrubber cells widen to 72 px (horizontal scroll).
- Map labels scale with a single `labelScale` factor (1.0–1.4) tied to the text size setting.

**VoiceOver / screen readers**

The map canvas is not readable, so every feature has a parallel DOM element. Provide a visually hidden, focusable
"Map features" list that mirrors what is in view (airports, crossing airways, SIGMETs, route), plus live regions.

| Element | Label pattern |
|---|---|
| Map container | "Map of the central Andes. 3 airports, 4 upper airways, 1 SIGMET in view." |
| Airport | "Santiago, S C E L, hub airport. Elevation 1,555 feet. Q N H 1018 hectopascals at 1700 Zulu." |
| Airway | "Upper airway `<designator spelled out>`, R NAV. Crosses the Andes. 4 segments." |
| Route segment | "Segment `<fix>` to `<fix>`, 48 nautical miles. Moderate turbulence likely at flight level 390." |
| Turbulence layer | "Turbulence forecast, flight level 390, valid 18 Zulu Friday. Highest band on route: moderate." |
| SIGMET | "SIGMET 3, Santiago F I R. Severe mountain wave, flight level 250 to 400, valid 1500 to 1900 Zulu." |
| FL rail | Slider. Value: "Flight level 390, moderate". Increment/decrement move one level |
| Time scrubber | Slider. Value: "18 Zulu Friday, T plus 6, moderate" |
| Verdict | `aria-live="polite"`, debounced 500 ms: "Moderate likely. Confidence medium. Flight level 390, 18 Zulu." |
| Freshness stamp | "W A F S run 12 Zulu, valid 18 Zulu." |

ICAO identifiers are spelled letter by letter. Units are spoken in full. Native: expose the same items as
`accessibilityElements` on the map view, and make the rail and scrubber `accessibilityAdjustable`.

**Keyboard (desktop)**

- Tab order: route capsule → map buttons → sidebar → FL rail → time scrubber → legend → map features list → inspector.
  Focus ring on everything. Focus never lands on the bare canvas without the features list being reachable.
- Map focused: arrow keys pan (Shift = larger step), `+` / `-` zoom, Shift + arrows rotate and pitch.
- Global shortcuts (shown in tooltips):

| Key | Action | Key | Action |
|---|---|---|---|
| `[` / `]` | Previous / next forecast time | `L` | Layers |
| `Page Up` / `Page Down` | Flight level up / down | `T` | Toggle turbulence layer |
| `Space` | Play / pause scrubber | `3` | Toggle 2D / 3D |
| `/` | Edit route | `0` | Recentre on the Andes |
| `N` | North up | `S` | Cross-section |
| `Esc` | Close popover, clear selection | `G` | Pressure gauge |

- Sliders (rail, scrubber) follow the ARIA slider pattern: arrows step, Home/End jump to ends.

---

## 8. Three things not to do

1. **Do not spend warm colour on anything but turbulence, and do not use a traffic-light scale.**
   No green for "nil" (nil is no fill). No red error banners, orange stale badges, magenta route line, brown or green
   terrain tint, satellite imagery, or coloured country fills. The moment a second thing is orange, the map stops
   being readable at a glance. Related: do not use MapLibre's `heatmap` layer or a blurred raster for EDR; draw
   thresholded bands with edges.

2. **Do not show a verdict without its confidence and its data time, and do not invent precision.**
   No bare "Moderate". No tweened frames between 3-hourly grids. No smoothing of the 0.25° field beyond contour
   interpolation. No single-number probability at Low confidence. No unlabelled vertical exaggeration. No verdict from
   an expired run. No local times, no missing units, no "270°" without T or M.

3. **Do not let the chrome compete with the map or drift from native patterns.**
   No opaque full-width headers, no hamburger menus, no custom modal styles, no tab bar, no dashboard of tiles on
   the first screen. Panels float, use materials, and correspond one-to-one with a native component (sheet with
   detents, floating sidebar, inspector, popover, segmented control). If a control has no SwiftUI equivalent, redesign
   it until it does. And do not restyle chart symbols into something a pilot has to learn: an airport is a circle
   with a runway bar, a VOR is a hexagon, a fix is a triangle or a star.
