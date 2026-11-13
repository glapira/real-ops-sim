# Andes Crossing — Design Direction

Status: v2 direction, 2026-11-13. v2 aligns the app with the **Solidaire Kit** (the Ledger app's kit: `kit.css`,
`kit-components.css`, `kit.js`), because both run on the same server and in the same native shell.
Audience: the engineer building the web app (MapLibre GL JS inside the kit's `.k-app`).
Follow this file line by line. Where it says "data", the value comes from our GeoJSON or config and is never hard-coded.

Contents: 0 Kit contract · 1 Concept · 2 Tokens · 3 Map style · 4 Layout · 5 Opening and states · 6 Components and icons ·
7 Accessibility · 8 Do not

---

## 0. Kit contract

Andes Crossing extends the kit. It does not carry a second token system.

| Need | Use | Never |
|---|---|---|
| Colour in chrome | Kit roles: `--tint`, `--on-tint`, `--tint-soft`, `--paper`, `--card`, `--card-2`, `--ink`, `--slate`, `--muted` (lines and icons only, never text), `--line`, `--sep`, `--fill`, `--fill-2`, `--fill-3`, `--scrim`, `--glass-bg`, `--glass-edge`, and the kit's `--red`/`--green`/`--amber` families for its own states | New chrome colours, Apple system blue, hex values in component CSS |
| Type | `--t-large-title` … `--t-caption`, `--t-bar-word`; classes `.k-title2`, `.k-headline`, `.k-body`, `.k-subhead`, `.k-footnote`, `.k-caption`, `.k-figure`. Dynamic Type through `--type-scale` | A second type scale, px font sizes (except `--t-bar-word`) |
| Space, radii, elevation, targets | `--s-1` … `--s-8`, `--r-card`, `--r-field`, `--r-small`, `--r-pill`, `--r-sheet`, `--e-1` … `--e-3`, `--hit`, `--gap-hit` | New spacing steps, new radii, new shadows |
| Materials | `.k-glass` (`--glass-bg`, blur 20 px, saturate 180%, `--glass-edge`, `--e-2`). The kit turns it opaque under Reduce Transparency and Increase Contrast | A second blur recipe |
| Motion | `--spring-standard`, `--spring-snappy`, `--spring-sheet`, `--spring-flick` with their `-dur`; `--dur-1` 120 ms, `--dur-2` 200 ms, `--dur-3` 240 ms; `--ease-out`. **Rule R56: every animation ≤ 240 ms.** `html.reduce-motion` = crossfades only | Any UI duration above 240 ms. The single exemption is the map camera (2.3) |
| Layout | The space, never the device: `shell:pose`, `Kit.pose`, `data-k-arr` (A0–A4), `w-compact`/`w-regular`, `h-compact`/`h-short`/`h-regular`, `pointer-fine`, `hover`, `fold-h`; panes `--k-list`, `--k-inspector`; insets `--sa-*`, `--corner-*`, `--k-gutter`, `--k-fab-r` | User-agent checks, "iPhone/iPad/desktop" breakpoints, own media-query widths |
| Components | `Kit.sheet`, `Kit.pop`, `Kit.seg`, `Kit.topbar`, `Kit.toast`, `Kit.offline`, `Kit.state`, `Kit.load`, `Kit.form`, `Kit.search`, `Kit.menu`; `.k-btn-*`, `.k-chip`, `.k-group`/`.k-row`, `.k-switch`, `.k-banner`, `.k-bone` | Home-made sheets, popovers, segmented controls, toasts, skeletons |
| Theme | `data-theme` on `<html>` and `localStorage['solidaire.theme']`, shared with Ledger | A private theme switch |
| Preferences | `html.contrast-more`, `html.reduce-motion`, `html.reduce-transparency`, `html.ax` | Own `matchMedia` copies of these |

What the app adds (prefix `--map-*`, `--risk-*`, `--conf-*`, `--ac-*`; component classes `.ac-*`): the map palette, the
turbulence risk scale, the confidence treatment, three app controls (level slider, time scrubber, legend), and the
camera timings. All of it is in section 2.

**Kit extension to request (one, not a fork):** `Kit.sheet` today is modal (scrim, page behind inert) and knows the
detents `medium` and `large`. A map sheet must stay open while the map is used. Ask the kit for
`Kit.sheet(el, { modal: false, detents: ['peek', 'medium', 'large'], peek: <px> })`: no scrim and no inert page at
`peek` and `medium`, kit behaviour unchanged at `large`. Until it lands, do not copy the sheet code into the app.

Naming: in the kit, "rail" and "sidebar" are navigation bars. This file never uses those words for app parts. The
flight-level control is the **level slider**; the crossing summary lives in the **panel** (the kit's list pane).

---

## 1. Concept

**A quiet relief map that only raises its voice about turbulence.** The screen is one dark, monochrome relief of South
America with the Andes as a lit ridge down the left side. Everything aeronautical is drawn in cool, thin, precise lines
on top of it. On the map, the only warm colour is turbulence risk. If the map looks calm, the crossing is calm.

References, and what we take from each:

- **Apple Weather** (map layers, hourly strip): the forecast time scrubber, the legend chip, the habit of printing the
  verdict in words before the chart.
- **Apple Maps** (flyover, cards over the map): the pitched hero camera over terrain, glass panes over a full-bleed
  map, the sheet with detents, the "Choose Map" layers card.
- **ForeFlight / Garmin Pilot dark map**: chart conventions (airport, VOR, fix symbols), ICAO labels, UTC, the route
  line as the main object. We take the conventions, not the density.
- **Solidaire Ledger**: the chrome. Same copper tint, same type, same sheets, popovers, states and springs, so the two
  apps feel like one product.

What makes it distinctive:

1. **On the map, warm hues are reserved.** Yellow, orange, red and violet mean turbulence and nothing else: no brown
   terrain, no magenta route, no coloured selection. Terrain, airways and borders are neutral or cool. Selection on the
   map is ink (white in dark, near-black in light), never the tint.
2. **Copper stays in the chrome.** The kit's `--tint` marks actions and control state in panes, sheets and buttons. It
   is never drawn on the map canvas. Risk and tint are also kept apart by form: risk is always a filled swatch with a
   letter (N L M S X); tint is always text, an icon or a control.
3. **The two controls are the two axes.** The level slider (vertical) and the time scrubber (horizontal) each carry a
   small risk strip. Before touching anything the captain sees which level and which hour are best.
4. **The route wears its risk.** The planned route is an ink line with a risk-coloured casing sampled at the selected
   level and time.
5. **Every verdict has three parts**: likelihood, confidence, data time. They are never shown apart.
6. **It tells the truth about resolution.** Forecast steps snap (no tweening between 3-hourly grids), the 0.25° cell
   grid appears when you zoom in, and vertical exaggeration is labelled.

---

## 2. Design tokens

Rules:

- Load order: `kit.css`, `kit-components.css`, then `andes.css` (the block below). `andes.css` only adds tokens; it
  never redefines a kit role.
- MapLibre cannot read CSS variables. `buildStyle()` reads every `--map-*` and `--risk-*` token with
  `getComputedStyle(document.documentElement)` and returns the style JSON. On a theme or contrast change (observe
  `data-theme` and `class` on `<html>`), re-read and call `setPaintProperty` per layer; no full `setStyle`.
- Theme: the kit's switch. `data-theme` on `<html>`, stored in `localStorage['solidaire.theme']` (shared with Ledger).
  Dark is the cockpit default **for this app only**: at boot, if the shared key is empty and
  `localStorage['andes.themeAuto']` is not set, set `data-theme="dark"` on `<html>` without writing the shared key.
  Appearance (in Layers) is a `Kit.seg`: Light and Dark write the shared key; Auto removes it and sets
  `andes.themeAuto = '1'`.
- UI font is the kit's `--font` (SF Pro on Apple devices). **Map labels cannot use SF Pro** (MapLibre needs glyph PBFs
  and SF Pro may not be redistributed): bundle Inter glyphs as `Inter Regular`, `Inter Medium`, `Inter SemiBold`.
  Map label size follows `Kit.pose.typeScale`, clamped to 1.0–1.4.

```css
/* ============ andes.css — Andes Crossing tokens. Loads after kit.css. Adds; never overrides a kit role. ============ */
:root {
  /* --- Roles the map borrows from the kit (they follow theme and Increase Contrast by themselves) --- */
  --map-label: var(--ink);            /* airport ids, route fixes */
  --map-label-2: var(--slate);        /* names, fixes, frequencies, peaks */
  --map-airport: var(--ink);
  --map-route: var(--ink);            /* the plan is ink, never a hue */
  --map-select: var(--ink);           /* selection on the map: ink + halo, never --tint */
  --map-sigmet: var(--ink);           /* official products: neutral outline */
  --map-route-casing: var(--map-land);

  /* --- Risk scale (light map). L* falls with severity: 74 / 58 / 47 / 33. --- */
  --risk-on-dark-ink: #1C1C1E; --risk-on-light-ink: #FFFFFF;
  --risk-nil: #8C97A6;       --risk-nil-on: var(--ink);                  /* outline only, never a fill on the map */
  --risk-light: #E0B000;     --risk-light-on: var(--risk-on-dark-ink);
  --risk-moderate: #E06A00;  --risk-moderate-on: var(--risk-on-dark-ink);
  --risk-severe: #D7261E;    --risk-severe-on: var(--risk-on-light-ink);
  --risk-extreme: #7A1FA2;   --risk-extreme-on: var(--risk-on-light-ink);
  --risk-edge-extreme: #5B1380;                                          /* band edge line for extreme */
  --risk-fill-light: 0.42; --risk-fill-moderate: 0.52; --risk-fill-severe: 0.62; --risk-fill-extreme: 0.70;
  --risk-hatch: rgba(28, 28, 30, 0.40);                                  /* hatch ink on severe / extreme */
  --risk-edge-boost: 0px;                                                /* added to edge widths (Increase Contrast) */

  /* --- Confidence / uncertainty. Multiplies the risk fill alpha; drives edge style. --- */
  --conf-high: 1; --conf-medium: 0.72; --conf-low: 0.45;
  --conf-low-dash: 3 3;                                                  /* band edge and chart stroke at Low */
  --conf-bar-on: var(--ink); --conf-bar-off: var(--fill-3);

  /* --- Map palette (light) --- */
  --map-ocean: #CBD9E6;        --map-ocean-label: #6585A6;
  --map-land: #EEF1F4;         --map-land-dim: #E4E8ED;                  /* dim = outside Chile and Argentina */
  --map-lake: #CBD9E6;
  --map-hill-shadow: rgba(58, 74, 96, 0.55);
  --map-hill-highlight: rgba(255, 255, 255, 0.90);
  --map-hill-accent: rgba(120, 135, 155, 0.35);
  --map-relief-high: #FFFFFF;                                            /* colour-relief tint above 4,000 m */
  --map-coast: #8FA3B8;        --map-border: #8794A6;       --map-fir: #2F7F74;
  --map-airway-upper: #0F6CBD; --map-airway-lower: #6B778C; --map-airway-casing: rgba(238, 241, 244, 0.75);
  --map-airway-dim: 0.55;                                                /* opacity of non-crossing airways */
  --map-fix: #3D4B5E;          --map-navaid: #2E5E8C;
  --map-airport-fill: #FFFFFF; --map-halo: rgba(238, 241, 244, 0.90);    /* symbol and label halo = land colour */
  --map-sigmet-fill: rgba(28, 28, 30, 0.05);
  --map-grid: rgba(28, 28, 30, 0.14);                                    /* 0.25 degree cell outlines */
  --map-sky: #BFD5EA; --map-horizon: #E8EEF4; --map-fog: #EEF1F4;

  /* --- App sizes (rem, capped like the kit's own, so they follow the text size) --- */
  --ac-fl-w: var(--hit);                 /* level slider width */
  --ac-fl-step: min(1.75rem, 34px);      /* pitch between two levels */
  --ac-scrub-h: min(4rem, 80px);         /* time scrubber height */
  --ac-scrub-cell: min(3.5rem, 72px);    /* one forecast step */
  --ac-peek: min(9.25rem, 190px);        /* sheet peek detent, plus --sa-bottom */
  --ac-drawer-h: 280px;                  /* cross-section drawer (px: matched against the measured space) */
  --ac-font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;   /* raw METAR / SIGMET text only */

  /* --- Motion. UI motion uses the kit's springs and --dur-1..3 (≤ 240 ms, R56). --- */
  --ac-layer-fade: var(--dur-2);         /* map layer crossfades: 200 ms */
  /* The one exemption from R56: map camera moves. A camera move is a change of viewpoint, like a scroll, not a UI
     transition. Nothing else in the app may use these. */
  --ac-camera-open: 2800ms;              /* first-launch flight, continent to the Andes */
  --ac-camera-move: 600ms;               /* recentre, 2D/3D, north-up, fit to route */
  --ac-camera-ease: cubic-bezier(0.45, 0, 0.15, 1);
}

/* ---- Dark. Keep the two blocks identical (same pattern as kit.css). ---- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Risk (dark map). L*: 87 / 74 / 58 / 49. Extreme carries a light edge so it never sinks into the map. */
    --risk-nil: #8E9BAE;
    --risk-light: #FFD60A; --risk-moderate: #FF9F0A;
    --risk-severe: #FF453A; --risk-severe-on: var(--risk-on-dark-ink);
    --risk-extreme: #A63CF0; --risk-edge-extreme: #E3B5FF;
    --risk-fill-light: 0.34; --risk-fill-moderate: 0.46; --risk-fill-severe: 0.58; --risk-fill-extreme: 0.66;
    --risk-hatch: rgba(255, 255, 255, 0.38);
    --map-ocean: #08111C; --map-ocean-label: #4E6480;
    --map-land: #172232; --map-land-dim: #111A27; --map-lake: #08111C;
    --map-hill-shadow: rgba(2, 6, 12, 0.80); --map-hill-highlight: rgba(143, 166, 196, 0.50); --map-hill-accent: rgba(8, 16, 28, 0.60);
    --map-relief-high: #C9D6E6;
    --map-coast: #3B4C63; --map-border: #5C6B80; --map-fir: #5F9C92;
    --map-airway-upper: #6CC7F5; --map-airway-lower: #8A96AD; --map-airway-casing: rgba(8, 17, 28, 0.70);
    --map-fix: #A9B6C8; --map-navaid: #9CC3E6;
    --map-airport-fill: #101826; --map-halo: rgba(13, 21, 33, 0.90);
    --map-sigmet-fill: rgba(242, 242, 247, 0.06); --map-grid: rgba(242, 242, 247, 0.14);
    --map-sky: #050A12; --map-horizon: #1B2A3F; --map-fog: #0B1420;
  }
}
:root[data-theme="dark"] {
  --risk-nil: #8E9BAE;
  --risk-light: #FFD60A; --risk-moderate: #FF9F0A;
  --risk-severe: #FF453A; --risk-severe-on: var(--risk-on-dark-ink);
  --risk-extreme: #A63CF0; --risk-edge-extreme: #E3B5FF;
  --risk-fill-light: 0.34; --risk-fill-moderate: 0.46; --risk-fill-severe: 0.58; --risk-fill-extreme: 0.66;
  --risk-hatch: rgba(255, 255, 255, 0.38);
  --map-ocean: #08111C; --map-ocean-label: #4E6480;
  --map-land: #172232; --map-land-dim: #111A27; --map-lake: #08111C;
  --map-hill-shadow: rgba(2, 6, 12, 0.80); --map-hill-highlight: rgba(143, 166, 196, 0.50); --map-hill-accent: rgba(8, 16, 28, 0.60);
  --map-relief-high: #C9D6E6;
  --map-coast: #3B4C63; --map-border: #5C6B80; --map-fir: #5F9C92;
  --map-airway-upper: #6CC7F5; --map-airway-lower: #8A96AD; --map-airway-casing: rgba(8, 17, 28, 0.70);
  --map-fix: #A9B6C8; --map-navaid: #9CC3E6;
  --map-airport-fill: #101826; --map-halo: rgba(13, 21, 33, 0.90);
  --map-sigmet-fill: rgba(242, 242, 247, 0.06); --map-grid: rgba(242, 242, 247, 0.14);
  --map-sky: #050A12; --map-horizon: #1B2A3F; --map-fog: #0B1420;
}

/* ---- Increase Contrast (html.contrast-more, set by kit.js). Theme-neutral, so one block serves light and dark. ---- */
:root.contrast-more {
  --map-label-2: var(--ink);
  --map-airway-dim: 1;
  --risk-edge-boost: 0.5px;
  --conf-medium: 0.85; --conf-low: 0.65;
}

/* ---- Reduce Motion (html.reduce-motion, set by kit.js): the camera jumps, layers crossfade ---- */
html.reduce-motion { --ac-camera-open: 0ms; --ac-camera-move: 0ms; }
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
- **Why the scale is not built from the kit's `--amber` and `--red`:** those are tuned as text on soft washes
  (light `--amber` `#BF3100` and `--red` `#D70015` are close in hue and lightness; too close for map bands), and they must stay
  free to mean "offline" and "error" in the chrome. The risk tokens are a separate, app-only family.
- **Keeping risk apart from the tint and the kit tones** (copper `--tint`, `--amber` and risk-moderate are neighbours in
  hue): risk is only ever a filled swatch, bar, band or chip with its letter; it is never a text colour, an icon colour
  or a control state. Tint and kit tones are only ever text, icons, washes and control states, and never appear on the
  map canvas or inside a chart.
- The L* values were computed, not yet simulated. Before release, check both themes in a CVD simulator (protan, deutan,
  tritan) on a real iPad at minimum brightness. Tritan is the weak case for severe vs extreme: the hatch must be on.
- EDR thresholds are config, not design (`config/edr-thresholds.json`, per aircraft weight class). Working defaults to
  confirm with flight ops: light ≥ 0.10, moderate ≥ 0.20, severe ≥ 0.45, extreme: no agreed ICAO value, leave the step
  unused until ops sets one.

### 2.2 Confidence treatment

Confidence is High / Medium / Low. It is shown three ways at once:

1. **Word**: "Confidence: Medium". Always spelled out next to the verdict.
2. **Glyph**: three ascending bars (4 × 6/9/12 px, 2 px gap, 1 px radius). Filled bars in `--conf-bar-on`, the rest in
   `--conf-bar-off`. Ink, never a risk colour and never the tint.
3. **Rendering**: risk fill alpha is multiplied by `--conf-high|medium|low`. At Low, edges and chart strokes become
   dashed (`--conf-low-dash`) and probabilities are shown as a range ("40–60%"), not a single number.

### 2.3 Motion budget

| What | Timing | Reduce Motion |
|---|---|---|
| Press, hover, toggle | `--dur-1` (120 ms), kit behaviour | same |
| Sheet rise, settle, flick | `--spring-standard` / `--spring-sheet` / `--spring-flick`, 240 ms (`Kit.sheet`) | kit: fade at the detent, `--dur-2` |
| Popover, pane, drawer, segmented thumb | kit: `--spring-snappy` / `--spring-standard`, ≤ 240 ms | kit: crossfade |
| Map layer on/off, change of level or time | opacity crossfade, `--ac-layer-fade` (200 ms) | same (opacity only) |
| Skeleton | the kit's `.k-bone` pulse | kit: none |
| **Map camera: opening flight** | `--ac-camera-open` 2,800 ms. **Explicit exemption from R56.** | `jumpTo`, then one 200 ms crossfade |
| **Map camera: other moves** | `--ac-camera-move` 600 ms. Same exemption. | `jumpTo` |

Nothing staggers, nothing loops (the kit's skeleton pulse aside), nothing blinks. A touch always cancels a camera move.

---

## 3. Map style spec

Engine: MapLibre GL JS 5.x, Mercator. The first native step is the Solidaire shell (a web view), so GL JS is the
renderer on iOS too. Keep the style portable to MapLibre Native all the same: no globe projection, and 3D terrain,
`color-relief` and `sky` are optional layers the map must look complete without.
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
| Continent | fitBounds `[[-84,-56],[-33,13.5]]` (Cape Horn to the Caribbean), padding 48 | ≈ 2.2 / 2.7 / 3.0 | 0 | 0 |
| **Andes hero** | `[-69.85, -32.95]` (between SCEL and SAME, Aconcagua just north) | 6.0 / 6.5 / 6.8 | 52 | 8 |
| Crossing 2D (work view) | fitBounds `[[-73.5,-36.5],[-66.5,-29.5]]`, padding = panel insets | ≈ 5.6 / 6.2 / 6.6 | 0 | 0 |

The hero looks north along the range: Chile on the left, Argentina on the right, so a crossing reads left-right as on a
chart. Bearing 8° gives the ridges depth without disorienting. The compass button returns to north-up.
Camera timings: the opening flight uses `--ac-camera-open`, every other move `--ac-camera-move`, both with
`--ac-camera-ease`; with `html.reduce-motion` both are `jumpTo` (section 2.3).

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
  moderate 1.0 · severe 1.25 · extreme 1.5 px, each plus `--risk-edge-boost`. Dashed `[3,3]` when confidence is Low.
- **`edr-edge-label`** — symbol, line placement, `minzoom 6` — text `MOD` / `SEV` / `EXTR`, Inter SemiBold 10 px,
  colour = band colour, halo `--map-halo` 1.25 px, `symbol-spacing 420`.
- **`edr-cell-grid`** — line on `edr-cells`, `minzoom 7.5` — 0.5 px `--map-grid`. Tap a cell: popover with EDR value
  (2 decimals), band, FL, valid time.
- Position: above hillshade, below coast, borders, airways and all labels. The relief stays visible through the fill;
  nothing aeronautical is ever covered.
- Change of FL or time: crossfade `edr-a` ↔ `edr-b` over `--ac-layer-fade` (200 ms). The scrubber snaps to 3-hourly steps. Never
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
| Non-crossing opacity | `--map-airway-dim` (0.55; 1.0 with Increase Contrast) | `--map-airway-dim` − 0.10 |
| Casing | +2 px total, `--map-airway-casing` | +1.5 px total, same |
| Dash | `rnav` or unknown: solid · `conv`: `[10,4]` | same |

Labels (`airway-label`, symbol, line placement): designator in a rounded box, the charted convention. Inter SemiBold,
10 px at z5 → 12 px at z8; text colour = airway colour; box = `icon-text-fit` on a 4 px-radius SDF rectangle filled
`--map-halo`; `symbol-spacing 380`; `text-rotation-alignment: viewport` (always upright); `text-padding 8`.
Crossing airways label from z4.5, others from z6. One selected airway: width + 1.5 px, colour `--map-select` (ink, not the tint), others drop
to 0.35 opacity.

**14. Route** — the plan is neutral; its casing carries the risk.
`route-risk` line 9 px, colour by segment `risk` from `--risk-*`, opacity 0.95 (nil: `--risk-nil` at 0.5);
`route-casing` line 5.5 px `--map-route-casing`; `route-line` line 3 px `--map-route` (the kit's `--ink`), round caps and
joins; `route-selected` line 6 px `--map-select` over the selected segment, with a 14 px 0.25-opacity glow line
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
`--map-halo` 1.5 px.

| Tier | Which (data-driven `tier`) | Symbol | Symbol min zoom | Label |
|---|---|---|---|---|
| Hub | SCEL, SAME, plus the bases SABE and SAEZ | ring 14 px, 2 px stroke, runway bar 20 px | 2 | ICAO from z2.5 (SemiBold 12 → 13 px). Name on second line from z5.5 (Regular 11 px, `--map-label-2`) |
| Main | e.g. SABE, SACO, SCIE, SCFA, SAZS, SASA, SCTE | ring 11 px, 1.75 px stroke, bar 16 px | 4 | ICAO from z5 (SemiBold 11 px). Name from z7.5 |
| Secondary | the rest in data | ring 7 px, 1.5 px stroke, no bar | 6 | ICAO from z7 (Medium 10 px). No name |

- `symbol-sort-key` by tier so hubs always win collisions. `text-variable-anchor: [left, right, top, bottom]`,
  `text-radial-offset 0.9`. ICAO labels use `--map-label`; halo `--map-halo` 1.5 px.
- From z8.5, hub and main labels add elevation: `SAME · 2,310 ft`.
- When the pressure gauge is open, SCEL and SAME gain a second outer ring (22 px, 1.5 px, `--map-select`) and a QNH tag
  (`1018 hPa`, Inter SemiBold 11 px in a capsule).
- Selected airport: ring fills with `--map-select` and the bar inverts to `--map-airport-fill`; 28 px halo ring at
  0.25 opacity. Selection on the map is always ink plus a halo, never the copper tint.

**18. `peak`** — symbol, `minzoom 6` — small solid triangle 6 px `--map-label-2` + name and elevation in feet
(`Aconcagua 22,838`), Inter Regular 10 px. Only peaks on or near the crossing corridors, from data. Max 8 in view.

**19. `selection`** — the `--map-select` halo ring / line glow for the selected feature. Always the top layer.

Label order when space runs out (highest wins): route fixes · hub airports · SIGMET tag · crossing airway designators ·
main airports · EDR edge labels · FIR · peaks · everything else.

---

## 4. Layout

Layout follows the space, never the device. The app reads `data-k-arr`, the `w-*` / `h-*` / `pointer-*` classes and
`shell:pose`; it has no breakpoints of its own. Device names below are examples of where a pose usually occurs, not
conditions in code.

### 4.1 Structure

```html
<div class="k-app ac-app" data-k-focus="detail">
  <section class="k-list k-glass ac-panel">…crossing panel…</section>     <!-- list pane; moved into Kit.sheet on one column -->
  <main class="k-detail ac-stage">
    <div class="ac-map"></div>                                            <!-- MapLibre canvas -->
    <header class="k-topbar ac-bar">…route capsule, status slot…</header>
    …map buttons, level slider, time scrubber, legend, drawer…
  </main>
  <aside class="k-inspector k-glass ac-inspector">…feature detail…</aside> <!-- A4 only -->
</div>
```

```css
/* v1 has one destination, so there is no .k-nav: the list pane starts at the leading edge */
.k-app.ac-app { height: 100dvh; min-height: 0; }                        /* the map fills the space in every pose */
html:is([data-k-arr="A1b"], [data-k-arr="A2"], [data-k-arr="A3"], [data-k-arr="A4"]) .k-app.ac-app {
  grid-template-columns: var(--k-list) minmax(0, 1fr); grid-template-areas: "list detail"; }
html[data-k-arr="A4"] .k-app.ac-app[data-k-inspector="open"] {
  grid-template-columns: var(--k-list) minmax(0, 1fr) var(--k-inspector); grid-template-areas: "list detail insp"; }
/* The map runs under the panes and the safe areas; the panes are glass cards over it */
.ac-app > .ac-stage { grid-column: 1 / -1; grid-row: 1; position: relative; overflow: hidden;
  margin: 0 calc(-1 * var(--sa-right)) 0 calc(-1 * var(--sa-left)); }
.ac-app > :is(.ac-panel, .ac-inspector) { grid-row: 1; z-index: 10; margin: var(--s-3); border-radius: var(--r-sheet);
  border-right: 0; border-left: 0; padding-top: 0; }
.ac-map { position: absolute; inset: 0; }
```

- The pane positions and widths are the kit's (`--k-list` = `clamp(320px, 34%, 420px)`, `--k-inspector` = 280 px). The
  look is `.k-glass`, so the map stays visible at the edges and the kit makes the panes opaque under Reduce
  Transparency and Increase Contrast.
- After every `shell:pose`, call `map.setPadding()` with the space the panes, the sheet and the drawer cover, so
  "centre" always means the centre of the visible map.
- If the app later gets more destinations (for example Map, Briefing, Settings), they go in a `.k-nav` built with
  `Kit.nav`, the grid override above is removed, and the kit decides the bar by pose. Do not build tabs by hand.

### 4.2 The three arrangements

| | **One column** (`A0`, `A1`, or `fold-h`) | **Panel beside the map** (`A1b`, `A2`, `A3`) | **Panel, map and inspector** (`A4`) |
|---|---|---|---|
| Space | W < 680 px | W ≥ 680 px | W ≥ 1,344 px |
| Typical | phone portrait, slide-over | phone landscape, tablet, small window | large tablet landscape, desktop window |
| Crossing panel | `Kit.sheet`, bottom, non-modal, detents `peek` / `medium` / `large` (kit extension, section 0) | `.k-list` pane, leading, glass, scrolls on its own. A chevron in its header collapses it to the route capsule | same |
| Feature detail (airport, airway, cell, SIGMET) | `Kit.pop` (the kit makes it a bottom sheet with Done on compact touch) | `Kit.pop`, anchored to the feature with the arrow | `.k-inspector` pane, trailing, `data-k-inspector="open"`; stays open while the person taps through features |
| Layers | `Kit.pop` from the Layers button | same | same |
| Time scrubber | inside the sheet, visible at every detent | floating glass bar at the bottom of the map, width = min(720 px, map width − 2 × `--k-gutter`) | same |
| Level slider | chip `FL390` above the sheet, expands in place | full slider on the trailing edge of the map, vertically centred | same, to the leading side of the inspector |
| Cross-section | "Section" tab in the sheet at `large` | drawer over the bottom of the map, `--ac-drawer-h`; the scrubber docks to its top edge | same, open by default when `h-regular` |
| Legend | glass capsule, bottom leading, `--s-2` above the sheet | directly above the scrubber's leading end | same |

Height rules (they apply in every arrangement): with `h-compact` (H < 500) the level slider is always the chip and the
drawer is not offered (Section opens in the panel). With `h-short` (H < 720) the drawer is capped at 200 px.
`fold-h` (tabletop): the map sits above the band, the sheet content below it, as the kit lays out its `.k-below` area.

Sheet detents (one column):

| Detent | Height | Contents |
|---|---|---|
| `peek` | `--ac-peek` + `--sa-bottom` | Grabber · one verdict line (`Moderate likely · Confidence: Medium · FL390`, with the risk square) · time scrubber |
| `medium` | 50% (kit) | Above, plus the full crossing card, the "Best level" row, and a `Kit.seg`: Crossing / Section / Gauge / SIGMET |
| `large` | kit's large | The selected tab in full: cross-section, abacus, SIGMET list, FL × time matrix, sources and data times |

The map stays interactive at `peek` and `medium`. The sheet is never dismissed; `peek` is its rest state. On a pose
change between one column and panel-beside-map, move the same panel node between the `Kit.sheet` and the `.k-list`
pane and keep its scroll position and selected tab.

### 4.3 Shared pieces

**Top bar** — `.k-topbar` over the map (it absorbs `--sa-top` and the corner zones). No large title and no bar
material: its items are glass. Leading: the **route capsule**, a `.k-glass` pill, `min-height: var(--hit)`:
`SCEL → SAME · 787-8`. Tap opens the route form (`Kit.pop` with a `Kit.form`): departure, destination, airway or route
string, aircraft (787-8 or Global 8000), planned level, ETD in UTC. ICAO ids in `.k-figure`, weight 600,
`letter-spacing: .02em`. Under the bar: the `Kit.offline` slot (5.2).

**Map buttons** — a vertical `.k-glass` group of `.k-btn .k-btn-icon` at the trailing edge under the top bar (inset
`--k-fab-r`): Layers · 2D/3D · Recentre ("Andes"). Toggled buttons use the kit's `aria-pressed` style (`--tint-soft`,
`--tint`). A compass joins the group only when bearing ≠ 0; tap = north-up.

**Layers card** — `Kit.pop` with `.k-group` sections of `.k-toggle` / `.k-switch` rows, modelled on Apple Maps "Choose Map":

| Section | Rows | Default |
|---|---|---|
| Weather | Turbulence (EDR) · SIGMET · Pressure gauge stations | Turbulence on, SIGMET on |
| Aeronautical | Upper airways · Lower airways · Waypoints · Navaids · FIR boundaries | Upper on, FIR on, rest off |
| Terrain | Relief shading · 3D terrain | Relief on, 3D on at launch |
| Appearance | `Kit.seg`: Auto / Light / Dark (section 2) | Dark |

**Level slider** (`.ac-fl`, vertical) — altitude is vertical, so the control is vertical. A `.k-glass` capsule,
`--ac-fl-w` wide, one stop per WAFS level in data (expected: FL100, 140, 180, 240, 270, 300, 340, 360, 390, 410, 450),
highest at the top, pitch `--ac-fl-step`. Each stop: a 6 px risk dot (highest band along the route at that level for
the selected time; a `--risk-nil` ring for nil) and a label in `--t-bar-word`, `--slate`. Thumb: a pill that extends
toward the map and reads `FL390` (`.k-figure`, `--t-headline`), background `--card`, `--e-1`, like the kit's segmented
thumb. Not tinted: the dots next to it are risk colours. Drag or tap a stop; it snaps, with
`Kit.shell.haptic('selection')`. If the planned level is above the top level (the Global 8000 can cruise above FL450):
a dashed stop "Above FL450" and the card line "No forecast above FL450. Showing FL450." Chip form: a `.k-glass` pill
`FL390`, `min-height: var(--hit)`; tap expands the slider in place; it collapses 3 s after the last touch.

**Time scrubber** (`.ac-scrub`, horizontal, Apple Weather style) — `--ac-scrub-h` high. One cell per forecast step,
T+6 … T+36, 3-hourly, 11 cells of `--ac-scrub-cell`. Each cell: valid time `18Z` (`--t-subhead`, weight 600 when
selected), the UTC weekday in `--t-bar-word` under the first cell of each day (`FRI 13`), and a 4 px risk bar along the
bottom (highest band on the route at the selected level). Selected cell: `--fill-3` rounded rect (`--r-small`), ink
label. A play button (`.k-btn-icon`) on the leading side steps once per second and stops at the end. Past valid times:
opacity .45, not selectable. A "Now" tick marks the current UTC time. The freshness stamp sits above the scrubber,
trailing: `WAFS run 12Z · valid 18Z`. When the cells do not fit, the strip scrolls horizontally with the selected cell
kept in view.

**Legend** (`.ac-legend`) — a `.k-glass` pill, `min-height: 1.75rem`, `--t-caption`: `EDR FL390`, then five swatches
(12 × 12, 3 px radius, hatch included) with letters `N L M S X`. Tap opens a `Kit.pop`: full names, the EDR thresholds
for the selected aircraft, and "Colours show forecast bands. SIGMETs are outlined." Hidden when turbulence is off.

**Crossing card** — the first block of the panel:

```
SCEL → SAME via <airway>                      787-8        ← .k-subhead, --slate
Crest at 1842Z · FL390                                     ← .k-subhead .k-figure

[M] Moderate likely                                        ← .k-title2; 14 px risk square with its letter in front
Confidence: Medium  ▂▄_                                    ← .k-subhead + 3-bar glyph

Light      ████████████░░  80%
Moderate   ████████░░░░░░  55%                             ← bars 6 px high, risk colours, .k-figure values
Severe     █░░░░░░░░░░░░░  10%

ΔQNH SCEL − SAME   +7.2 hPa     500 hPa wind  270°T / 55 kt   ← .k-pair rows (label --slate, value --ink .k-figure);
EDR max on route   0.31         SIGMET        1 active (SCEZ)    one column under html.ax, as the kit does

WAFS run 12Z · valid 18Z   METAR SCEL 1700Z · SAME 1700Z   ← .k-footnote, --slate
Awareness aid. Check the official briefing and SIGMETs.    ← .k-footnote, --slate
```

Headline wording is fixed: `<Nil|Light|Moderate|Severe|Extreme> <unlikely|possible|likely|very likely>`. The headline
text is ink; only the square carries the risk colour. Below the card, a "Best level" row (`.k-row`) when another level
is at least one band lower at the same time: `Smoother at FL430: Light likely`.

**Airport detail** (`Kit.pop`, or the inspector in A4): ICAO in `.k-title2 .k-figure` + IATA in `--slate` · name ·
city, country · `Elevation 1,555 ft` · longest runway (`17L/35R · 3,748 m`) · METAR block: observation time `1700Z`
with age (`22 min ago`), **QNH `1018 hPa`** (`.k-title2 .k-figure`), temperature / dew point `18 / 07 °C`, wind
`220° / 08 kt` · raw METAR in `--ac-font-mono`, `.k-footnote` size, in a collapsed `.k-block` · buttons:
`.k-btn-tinted` "Set as departure", "Set as destination". No METAR: "No METAR for SCEL." METAR older than 90 min: the
age reads "Old · 1 h 52 min" in a neutral `.k-chip` and the QNH turns `--slate`. Because `Kit.pop` anchors to an
element, give it a 1 × 1 px anchor positioned at the feature's screen point, and move it with the map.

**Airway detail** (same container): designator in the charted box · `Upper · RNAV 5` · limits `FL250–UNL` · a
`.k-group` of segment rows: `FIX1 → FIX2`, track `092°M`, distance `48 NM`, `MEA 26,000` / `MOCA 24,300` when in data
(else "MEA not in data"), and a risk dot for the selected level and time. Tapping a row highlights the segment on the
map. Button: `.k-btn-tinted` "Use for route".

**Cross-section** (route profile). X = distance along route in NM with fix names as ticks. Y = FL000 to the top
level. Terrain: filled silhouette in `--map-land` one step lighter, 1.5 px top edge `--map-label-2`; MEA line dashed
1 px when available. Risk: one cell per (route sample × WAFS level), band colours at the map fill alphas, hatch on
S/X, the letter in the cell when the cell is ≥ 22 px wide. Planned level: 2 px `--map-route` line with the aircraft
position tick at ETA. The selected segment is mirrored on the map. Above the top level: hatched neutral area labelled
"No forecast above FL450". Minimum height 200 px.

**Pressure gauge (Harrison abacus).** A square chart: axes, zones and thresholds come from
`data/harrison-abacus.json` exactly as in the source nomogram; design does not define them. Rendering: zone areas in
risk colours at map fill alphas with letters; axes labelled with units (`ΔQNH SCEL − SAME, hPa` and `500 hPa
cross-range wind, kt`); current point = 10 px ink dot with 2 px casing and a value tag; last 6 h as a 1.5 px trail of
fading dots; forecast points (if any) as hollow dots joined by a dashed line. Above the chart, the two QNH values side
by side (`.k-tiles.k-two-figures`) with their observation times. The sign convention is always written out:
`SCEL − SAME`.

**Pointer and hover** (`html.pointer-fine`, `html.hover`; not "desktop"): hover states from the kit, a cursor readout
chip at the bottom trailing corner of the map (`33°05′S 069°51′W · 14,200 ft terrain`, `.k-footnote`, glass),
keyboard shortcuts (section 7), tooltips, and a context menu on the map (`Kit.menu`): "Route from here", "Route to
here", "What is here".

---

## 5. Opening experience and states

### 5.1 First launch

1. **0 ms** — The stage is `--map-ocean`. Bundled land, coast and borders paint in the first frame (no network).
   Camera: Continent. Hub airports and their ICAO labels are visible, including the bases SABE and SAEZ. Top bar and map
   buttons are there from the first frame; the panel is not.
2. **As tiles arrive** — hillshade appears tile by tile. No spinner.
3. **After a 400 ms hold** — `flyTo` the Andes hero: `--ac-camera-open` (2,800 ms), `curve 1.42`, easing
   `--ac-camera-ease`, pitch 0 → 52, bearing 0 → 8. Terrain is enabled at the start so the range rises during the
   flight. **This is the app's one long motion and the explicit exemption from R56** (section 2.3): it is a camera
   move, not a UI transition. Any touch cancels it and leaves the camera where it is.
4. **On `moveend`** — upper crossing airways and their labels fade in together (`--ac-layer-fade`, 200 ms). The panel
   arrives the kit's way: `Kit.sheet` opens at `peek` on its spring (240 ms), or the `.k-list` pane fades in
   (`--dur-2`). The turbulence layer for the nearest valid time and the planned (or last used) level crossfades in
   (200 ms) as soon as its data is ready, and the verdict line fills.

**Reduce Motion** (`html.reduce-motion`): no flight. `jumpTo` the hero camera in the first frame, then one 200 ms
crossfade brings in airways, panel and turbulence. No other motion.

Later launches: if the app was used in the last 12 h, restore the last camera with no animation. Otherwise start at
Continent and run step 3. Turning the turbulence layer on from Layers for the first time in a session eases to
Crossing 2D (pitch 0, bearing 0, `--ac-camera-move`); the person can pitch back at any time and the app does not
correct them again.

### 5.2 States

Use the kit's states as they are. Each block of the panel (verdict, gauge, SIGMET list, section) is its own
`Kit.load` box with `partial: true`, so one failed source never blanks the rest. The map itself is never replaced by a
state: states live in the panel, the top-bar slot and toasts.

| State | Kit part | What the person sees | Copy |
|---|---|---|---|
| Empty: no route | `Kit.state(box, 'empty')` in the panel | Hero map; the crossing card is a prompt with two fields and quick picks (`.k-chips`): `SCEL → SAME`, `SAME → SCEL`, `SCEL → SAEZ` | "Plan a crossing. Enter departure and destination." |
| Loading: forecast | `Kit.load` skeleton in the final layout (`.k-bone`) | Map and controls usable. Scrubber bars and slider dots are `--fill` bones. Verdict line is a bone | (kit skeleton; no text) |
| Loading: hillshade | none | Flat land until tiles arrive | — |
| Offline, saved data | `Kit.offline(slot, { text })` under the top bar (the kit's amber banner), `html.k-offline` | Everything works from the saved run | "Offline: showing WAFS run 12Z, fetched 1432Z." |
| Offline, nothing saved | `Kit.state(box, 'offline')` | Base map only | "Offline: no forecast saved yet. Connect once before the flight to save the latest run." |
| Fetch error | `Kit.state(box, 'partial', { retry })` next to the block; the layer keeps the last good data | Inline line with Retry | "Could not load the turbulence forecast." |
| Timeout (20 s, kit) | `Kit.state(box, 'timeout', { retry })` | Inline line with Retry | kit string: "The server did not answer in time." |
| Old run (run time > 12 h ago) | neutral `.k-chip` with the kit clock glyph beside the stamp | Verdict stays; confidence drops one step | "Old run: WAFS 00Z. A newer run is due." |
| Expired (all valid times passed) | `Kit.state(box, 'empty', { action })` in the verdict block | Turbulence layer removed, verdict withheld | "Forecast expired. Last valid time 12Z Thu." Action: "Refresh" |
| Partial data (a level or step missing) | disabled control | That slider stop or scrubber cell is dashed, opacity .45 | "FL410 is not in this run." (tooltip and VoiceOver hint) |
| METAR missing or old | neutral `.k-chip` in the gauge block | Gauge shows the last value in `--slate` with its age | "SAME QNH is 2 h 10 min old. Gauge not updated." |
| No SIGMET | `Kit.state(box, 'empty')` | SIGMET tab | "No active SIGMET for SCEZ or SAMF." Always name the FIRs checked |
| Route saved, layer toggled, data refreshed | `Kit.toast(text)` | Toast, 4 s | "WAFS run 18Z loaded." |

Colour of states: the kit's own (amber offline banner, red error glyph) and only in the chrome. Data-age marks that sit
next to risk swatches (old run, old METAR, expired) are neutral chips with a clock and words, so nothing near a verdict
can be mistaken for a risk band.

### 5.3 Data-freshness stamps

- Every data product on screen carries its own stamp: `.k-footnote .k-figure`, `--slate`.
- Formats: model `WAFS run 12Z · valid 18Z` (add the weekday when not today UTC: `valid 06Z Sat`). Observations
  `METAR SCEL 1700Z`. SIGMET `Valid 1500Z–1900Z`. Fetch time when offline: `fetched 1432Z`.
- All times are UTC with `Z`. No local time anywhere, no relative-only times ("22 min ago" may follow an absolute time,
  never replace it).
- Units and references, always written: `FL390`, `kt`, `hPa`, `ft` (terrain and elevations), `NM`, `°C`, wind as
  `270°T / 55 kt` for model winds, `°M` for charted airway tracks. EDR to two decimals, no unit.
- Saved for offline: the vector base is bundled; hillshade tiles z2–z9 for `[[-76,-40],[-64,-26]]` are cached on the
  first online launch; the last two WAFS runs and the last METAR/SIGMET set are kept.

---

## 6. Components

### 6.1 From the kit, unchanged

States (hover `--fill-2`, pressed `--fill-3` + scale .97, selected `--tint-soft` / `--tint`, disabled opacity .45,
focus 2 px `--tint` outline) are the kit's. Do not restyle them.

| Use in Andes Crossing | Kit part | Notes |
|---|---|---|
| Crossing panel on one column | `Kit.sheet` (`.k-sheet`) | Needs the non-modal + `peek` extension (section 0) |
| Airport, airway, cell, SIGMET detail; Layers; legend detail; route form | `Kit.pop` (`.k-pop`) | Anchored on a fine pointer or regular width; a sheet on compact touch |
| Crossing / Section / Gauge / SIGMET; Appearance | `Kit.seg` (`.k-seg`) | One tab stop, arrow keys, selection haptic from the kit |
| "Set as departure", "Use for route", Retry | `.k-btn-tinted` | At most one `.k-btn-filled` per view (route form: "Show crossing") |
| Map buttons, play, close, collapse | `.k-btn .k-btn-icon` in a `.k-glass` group | Toggle = `aria-pressed` |
| Layer rows | `.k-group` + `.k-toggle` / `.k-switch` | Whole row is the target |
| Segment rows, SIGMET rows, "Best level" | `.k-group` / `.k-row` with slots | Selected row = the kit's `--tint-soft` wash |
| Facts (label + value) | `.k-pair`, `.k-figure` | One column under `html.ax` |
| Two QNH values | `.k-tiles.k-two-figures`, `.k-tile-figure` | |
| Raw METAR / SIGMET text | `.k-block` (collapsed) | Text in `--ac-font-mono` |
| Old run, old METAR, quick picks | `.k-chip` (neutral), `.k-chips` | No amber or red tone next to risk swatches |
| Route fields | `Kit.form`, `.k-field`, `.k-input` | ICAO fields: uppercase, 4 characters, auto-advance |
| Loading, empty, error, timeout, offline, partial | `Kit.load`, `Kit.state`, `.k-bone` | 5.2 |
| Offline banner | `Kit.offline`, `.k-banner` | Slot under the top bar |
| Confirmations | `Kit.toast` | Never the only place an error is shown |
| Map context menu | `Kit.menu` | Fine pointer and long press |
| Top bar | `.k-topbar` | No large title, no bar material |

### 6.2 App components (`.ac-*`, built only from kit and app tokens)

| Component | Size | Default | Hover / pressed | Selected / active | Disabled |
|---|---|---|---|---|---|
| Route capsule `.ac-route` | min-height `--hit`, `--r-pill`, padding 0 `--s-4` | `.k-glass`; ids ink `.k-figure` 600; aircraft `--slate` | `--fill-2` / `--fill-3` overlay, scale .97 | editing: `aria-expanded`, the form popover is open | — |
| Level slider `.ac-fl` | `--ac-fl-w` wide; stops at `--ac-fl-step`; thumb `--hit` high | `.k-glass`; labels `--t-bar-word` `--slate`; 6 px risk dots | stop: `--fill-2` / `--fill-3` | thumb `--card`, `--e-1`, label ink `--t-headline` | missing level: dashed ring, .45 |
| Level chip `.ac-fl-chip` | min-height `--hit`, `--r-pill` | `.k-glass`; `FL390` ink 600 + risk dot | as buttons | expanded: becomes the slider | — |
| Scrubber cell `.ac-scrub-cell` | `--ac-scrub-cell` × `--ac-scrub-h`, never narrower than `--hit` | label `--t-subhead` `--slate`; 4 px risk bar | `--fill-2` / `--fill-3` | `--fill-3` rect `--r-small`, label ink 600 | past or missing: .45, not focusable |
| Legend `.ac-legend` | min-height 1.75rem, `--r-pill`; hit area extended to `--hit` | `.k-glass`, `--t-caption` | as buttons | popover open: `aria-expanded` | — |
| Risk chip `.ac-risk` | min-height 1.5rem, `--r-small`, padding 0 `--s-2` | background `--risk-*`, text `--risk-*-on`, `--t-caption`: letter + word (`M Moderate`) | not interactive | — | Nil: transparent, 1 px `--risk-nil` border, ink text |
| Risk square `.ac-risk-sq` | 14 × 14 (10 in rows), 3 px radius | `--risk-*` + letter in `--risk-*-on`; hatch on S / X | — | — | — |
| Confidence glyph `.ac-conf` | 16 × 12 | bars per 2.2 | — | — | — |
| Probability bar `.ac-prob` | 6 px high, `--r-pill` | track `--fill`, fill `--risk-*`, value `.k-figure` | — | Low confidence: the fill ends in a lighter range segment | — |
| Freshness stamp `.ac-stamp` | `.k-footnote` | `--slate`, optional kit clock glyph | — | old: ink + neutral `.k-chip` | — |
| Map tag `.ac-tag` (QNH, SIGMET, cell value) | min-height 1.375rem, `--r-small` | `.k-glass` without shadow, `--t-caption` | — | — | — |
| Cross-section drawer `.ac-drawer` | `--ac-drawer-h`, resizable 200–420 px | `.k-glass`, `--r-sheet` top corners | drag handle = the kit's grabber style | — | — |
| Cursor readout `.ac-cursor` | `.k-footnote` | `.k-glass` pill, `html.hover` only | — | — | — |

Rule for risk in text: never set text in a risk colour. Use the chip or the square next to ink text.

### 6.3 Icon set (inline SVG)

Match the kit's glyphs: 24 × 24 viewBox, 2 px stroke, round caps and joins, `currentColor`, no fills unless stated;
rendered at 1.25rem in buttons. Reuse the kit's own `error`, `clock`, `offline`, `check` and `clear` glyphs; do not
redraw them. Map symbols are in section 3 and are separate SDF images.

| Name | Shape |
|---|---|
| `layers` | Three stacked rounded rhombuses, offset vertically |
| `view-3d` | Isometric cube outline with the three visible edges meeting at the centre |
| `view-2d` | Flat rounded square with a small north tick on the top edge |
| `recenter-andes` | Two overlapping mountain peaks inside open corner brackets |
| `compass` | Circle with a two-tone needle, filled north half |
| `chevron-left` / `-right` / `-down` | Single 90° chevron, 10 px tall |
| `play` / `pause` | Filled rounded triangle / two filled rounded bars |
| `arrow-route` | Thin rightward arrow, 14 px long, for `SCEL → SAME` |
| `swap` | Two opposed horizontal arrows, stacked |
| `turbulence` | Three horizontal wavy lines, the middle one broken by a small upward kink |
| `sigmet` | Irregular five-sided polygon outline with a short vertical bar and dot inside |
| `gauge` | Semicircular dial arc with tick marks and a needle at about 60° |
| `section` | Mountain silhouette along the bottom, a straight horizontal line above it, one vertical tick |
| `airport` | Circle with a single diagonal bar through it (matches the map symbol) |
| `airway` | Straight line between two small four-point stars |
| `flight-level` | Two short stacked horizontal bars with an up-down double arrow to their right |
| `refresh` | Three-quarter circular arrow, arrowhead at the open end |
| `info` | Circle with a dot and a short vertical bar ("i") |
| `confidence-1` / `-2` / `-3` | Three ascending bars; 1, 2 or 3 filled (filled rects) |
| `aircraft` | Top-view airliner: slim fuselage, swept wings, small tailplane |
| `search` | Circle with a short handle at lower right |
| `sun` / `moon` | Circle with eight short rays / crescent (Appearance) |

---

## 7. Accessibility

**Contrast**

- Text: ≥ 4.5:1 for all text (the kit's roles already meet it on `--card` and `--paper`), ≥ 7:1 for primary data
  (verdict, QNH, FL, times): set those in `--ink`, never `--slate`. `--muted` is for lines and icons only (kit rule).
  Glass over the map: the kit's `--glass-bg` is 92% opaque, so text contrast on glass equals text on `--card` within
  rounding; verify over the lightest and darkest map area in each theme.
- Non-text: ≥ 3:1 for control boundaries, icons, focus rings, airways, airport symbols and every risk band edge
  against the land colour. The light band has no edge; verify its fill ≥ 3:1 against `--map-land` in both themes.
- Dark theme: chrome is the kit's (`--paper` black, `--card` `#1C1C1E`). The map is never pure black (`--map-ocean`
  `#08111C`), so the relief keeps its shadows. Check the whole screen at minimum brightness in a dark room.
- **Increase Contrast** (`html.contrast-more`): the kit switches its roles and makes glass opaque. The app block in
  section 2 adds: secondary map labels in ink, all airways at full opacity, risk edges + 0.5 px, less fading for
  Medium and Low confidence. `buildStyle()` re-reads tokens when the class changes.
- **Reduce Transparency** (`html.reduce-transparency`): nothing to do; `.k-glass` becomes `--card`.

**Colour independence**

- Every risk display carries a letter or word. Severe and extreme carry hatch. Confidence carries a word.
- A "Differentiate without colour" setting (from the shell's report when it provides it, else an app setting) puts
  letters inside the scrubber and slider risk marks and raises hatch contrast.

**Motion**

- `html.reduce-motion`: the kit drops travel and springs. The app drops the camera flight and every camera ease
  (`jumpTo`), and keeps only opacity crossfades (200 ms). Scrubber play stays available; each step is a crossfade.
- No UI animation exceeds 240 ms (R56). The camera exemption is stated in 2.3 and 5.1 and applies to nothing else.

**Text size**

- All UI text follows `--type-scale` through the kit's type tokens. Under `html.ax`: `.k-pair` rows stack, the
  scrubber cells widen (they are in rem) and the strip scrolls, the level slider is always the chip form, and the
  sheet opens at `medium` instead of `peek` when the verdict line no longer fits in `--ac-peek`.
- Bar-like labels (slider stops, weekday marks) use `--t-bar-word` and stay 11 pt, as the kit's bars do.
- Map labels scale by `Kit.pose.typeScale`, clamped 1.0–1.4, re-applied on `shell:pose`.

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
| Level slider | `role="slider"`, vertical. Value text: "Flight level 390, moderate". Up / down move one level |
| Time scrubber | `role="slider"`. Value text: "18 Zulu Friday, T plus 6, moderate" |
| Verdict | `aria-live="polite"`, debounced 500 ms: "Moderate likely. Confidence medium. Flight level 390, 18 Zulu." |
| Freshness stamp | "W A F S run 12 Zulu, valid 18 Zulu." |

ICAO identifiers are spelled letter by letter. Units are spoken in full. Sheets, popovers, toasts and states keep the
roles and focus handling the kit gives them.

**Keyboard** (any pose with a keyboard)

- Tab order: route capsule → map buttons → panel → level slider → time scrubber → legend → map features list →
  inspector. Focus ring: the kit's 2 px `--tint` outline. `Kit.seg` and the sliders are one tab stop each.
- Map focused: arrow keys pan (Shift = larger step), `+` / `-` zoom, Shift + arrows rotate and pitch.
- Shortcuts (shown in tooltips):

| Key | Action | Key | Action |
|---|---|---|---|
| `[` / `]` | Previous / next forecast time | `L` | Layers |
| `Page Up` / `Page Down` | Flight level up / down | `T` | Toggle turbulence layer |
| `Space` | Play / pause the scrubber | `3` | Toggle 2D / 3D |
| `/` | Edit route | `0` | Recentre on the Andes |
| `N` | North up | `S` | Cross-section |
| `Esc` | Close popover, clear selection (kit) | `G` | Pressure gauge |

---

## 8. Three things NOT to do

1. **Do not put a warm colour on the map for anything but turbulence, and do not use a traffic-light scale.**
   No green for "nil" (nil is no fill). No copper tint, kit amber or kit red on the map canvas or in a chart: not for
   selection, the route, airways, terrain or SIGMETs. No brown or green terrain tint, no satellite imagery, no
   coloured country fills. No risk colour as text. Related: do not use MapLibre's `heatmap` layer or a blurred raster
   for EDR; draw thresholded bands with edges.

2. **Do not show a verdict without its confidence and its data time, and do not invent precision.**
   No bare "Moderate". No tweened frames between 3-hourly grids. No smoothing of the 0.25° field beyond contour
   interpolation. No single-number probability at Low confidence. No unlabelled vertical exaggeration. No verdict from
   an expired run. No local times, no missing units, no "270°" without T or M.

3. **Do not fork the kit, and do not let the chrome compete with the map.**
   No new chrome colours, radii, shadows, type sizes or durations; no hex values in component CSS; no home-made sheet,
   popover, segmented control, toast or skeleton; no device or user-agent checks (read `shell:pose`); no animation
   over 240 ms except the map camera. No opaque full-width headers and no dashboard of tiles on the first screen: the
   map is the screen and the panes are glass over it. And do not restyle chart symbols into something a pilot has to
   learn: an airport is a circle with a runway bar, a VOR is a hexagon, a fix is a triangle or a star.
