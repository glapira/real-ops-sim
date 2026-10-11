# Ops Airport: wiring it into the ops room page

`ops-airport.js` is one plain script with no build step. It draws the ops room as a small 3D airport and reads the same two feeds the current page already fetches. It makes no network or AI calls of its own.

## What maps to what

| Airport | Ops room |
|---|---|
| Gate A · Cloud | `team: "cloud"` agents (Jarvis, Contract desk, Second opinion) |
| Gate B · Ledger AI | `team: "ledger"` agents (Reader, Assistant) |
| Gate C · Mac | `team: "mac"` agents (Mac clerk, Memory curator) |
| Hangar D · Code team | `team: "code"` agents (Router, Triage, Scout, Quick, Build, Deep, Escalate, Verifier, Workflow) |
| Port office S · Ship team | `team: "ship"` agents (people or agents of the NGO's ship side). To give them work, add them to `ops_room.agents` with `team: "ship"` and log their events like any other agent |
| People at desks | `agents[]`. `working` types with a lit screen, `resting` sips coffee or walks to the coffee point, `off` leaves an empty chair |
| Aircraft landing and taxiing in | new rows in `arrivals[]` and `feed[]` (one flight per row, gate picked from the row's `agent`) |
| Turnaround on stand | On block, Read, Check, Book, File, Pushback (bottom-left tracker) |
| Replayed flights | when nothing new arrives, the field replays today's `feed[]` so it never looks dead. These flights say "Replay" in their card |
| Tower and floating brain | `ops_graph` nodes, clustered by type: cards front left, parties front right, notes on top, documents back left, people back right. `hot` nodes pulse. Edges are the faint lines |
| Radar and the blue van | Jarvis. While `jarvis.state === "working"` the radar spins fast, rings go out over the field and the van drives the apron. Gate A walks to the brain when a sweep starts |
| Fleet stands | `opts.fleet` (your two aircraft) |
| Harbour on the Med, port office S · Ship team | `team: "ship"` agents sit in the port office on the quay. Their work, and any arrival that mentions a ship, vessel, port call, bunkering, crew change or rescue, comes in by launch, moors and runs Moored, Read, Check, Book, File, Cast off |
| Rescue vessel alongside the quay | `opts.ship = { name, label, imo, loa, beam }`. Click it for its details and the ship team |
| Split-flap boards under the landside canopy | Departures from `departures[]` (Boarding when due within 3 h, Overdue in red), Arrivals from `arrivals[]` or the latest `feed[]` rows. Click a board to open its list |
| Terminal roof | A curved standing-seam roof with a wood soffit, skylights and a long landside canopy over the kerb. It fades out when you zoom in on the gates (Gates view, or any close look from above), so the teams stay visible, and comes back on the overview |
| Jet bridges | One per gate. Each one swings out and docks at the forward left door when a flight is on block, then pulls back before pushback |
| Tour button | a slow cinematic glide: brain, a moving flight, the gates, a turnaround, the workshop, the fleet, the boards, then the overview. Any touch stops it |
| Clocks | Madrid large, the Mac's local zone if different, then `clocks.zones`, then the countdown to `next_run_at` |
| Usage rings | `usage.five_hour` and `usage.seven_day`, with a tick at `usage.cap` |
| Tabs | Team, Arrivals, Departures (`departures[]` with `due`), Messages (`feed[]`) |

Day and night follow Madrid time (07:00 to 20:00 is day). Dark mode deepens the night. Weather (Clear, Rain, Fog, Calima, Storm) and the light override (Auto, Day, Night) sit behind the cloud button and are remembered per browser.

## Steps for `app/views-ops.js`

1. Vendor three.js once, for example `app/vendor/three/three.module.min.js` from three@0.170.0 with its LICENSE. The module also runs on the classic `three.min.js` (r150 to r159).
2. Copy `ops-airport.js` to `app/ops-airport.js` and add it to boot.php's `$js` list next to `ops-brain3d.js`. It only defines `window.OpsAirport` and does nothing until mounted.
3. In the ops view, mount into the existing rounded card and feed it the JSON you already poll:

```js
const THREE = await import('./vendor/three/three.module.min.js');
const room = OpsAirport.mount(cardEl, {
  THREE,
  lang: App.lang === 'es' ? 'es' : 'en',
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  tz: 'Europe/Madrid',
  brand: { parts: [['SOLID', '#E07B24'], ['AIRE', '#6B3A1E']], ramp: ['#F4A53C', '#E07B24', '#9A5426', '#4A2A17'] },
  fleet: [
    { reg: 'P4-787', type: 'b787', label: 'Boeing 787-8' },
    { reg: 'P4-8000', type: 'global', label: 'Bombardier Global 8000' },
    { reg: 'DO228NXT', type: 'do228', label: 'Dornier 228 NXT' }
  ],
  ship: { name: 'Solidaire', label: 'Rescue vessel', imo: '9224817', loa: 66, beam: 15.03 },
  onOpen: (link) => { if (link) location.hash = link; }
});
// existing polling: ops_room every 15 s, ops_graph every 60 s, paused when hidden
room.update(opsRoomJson);
room.updateGraph(opsGraphJson);
// on leaving the page
room.unmount();
```

4. Keep the v2 SVG view as the fallback when WebGL is missing (`OpsAirport.mount` throws if `THREE` is absent, and three.js throws if WebGL is off).
5. Give the card a height, for example `height: min(78vh, 820px)` on desktop and `calc(100dvh - header)` on phones. The overlay switches to a phone layout under 820 px wide, with bottom sheets for details and lists.

Fleet entries can carry extra rows for the detail card, for example `notes: [['Next check', 'Feb 2027']]`. Fleet types: `b787`, `global`, `do228`, drawn at their real relative lengths (56.7 m, 33.8 m, 16.6 m).

Livery: pass `brand` and every aircraft is painted like the fleet sheet, white with the sunburst on the tail and the wordmark forward. The Global stays plain, as on the sheet. Work flights carry their flight number as the registration and a thin cheatline in the item's colour.

```js
brand: { parts: [['SOLID', '#E07B24'], ['AIRE', '#6B3A1E']], ramp: ['#F4A53C', '#E07B24', '#9A5426', '#4A2A17'] },
fleet: [
  { reg: 'P4-787', type: 'b787', label: 'Boeing 787-8' },
  { reg: 'P4-8000', type: 'global', label: 'Bombardier Global 8000' },
  { reg: 'DO228NXT', type: 'do228', label: 'Dornier 228 NXT' }
]
```

## Cost and performance

No AI calls and no extra polling. It renders at up to 30 fps on phones and stops while the tab is hidden. Phones get smaller shadow maps and fewer particles. `prefers-reduced-motion` stops the walking, the swirl and the camera glides. Keys: `+` and `-` zoom, arrows pan, `0` resets, `Esc` clears the selection.

## Licence

The code in `ops-airport.js` is written from scratch. Nothing is copied from agents-office or deskrpg. three.js is MIT, and the water and sky shaders are adapted from its examples (MIT, see `textures/THREE-LICENSE.txt`).

The aircraft, vehicles and most surface textures come from FlightGear and are GPL v2 or later. Sources and authors are in `models/README.md` and `textures/README.md`. Using them inside your own app is fine. If you ever ship AeroLedger to other people, keep those READMEs with the files and offer the sources, or pass `models: false` and `textures: false` to fall back to the drawn versions.

## Real aircraft and ground equipment

The page loads real models from `models/` (pass `models: 'app/ops-airport/models/'` or wherever you copy them, or `models: false` to keep the drawn ones). They come from FlightGear's GPL aircraft: the 787-8, A320, CRJ700 (standing in for the Global 8000), Dornier 228, the Volvo fuel and catering trucks, the pushback tug and the Follow-Me car. `models/README.md` lists sources and authors. Each model loads in the background and replaces the drawn stand-in when it arrives. The whole set is about 13 MB, cached by the browser after the first visit.

The Solidaire livery is painted onto each model's own texture by `tools/build_models.py`, so it sits on the real panel lines, doors and windows. To change the livery or registrations, edit that script and rebuild.

## Textures, water and light

`textures/` holds real surface textures: FlightGear runway tiles (threshold, designators, touchdown zones, aiming point, centreline), taxiway asphalt, airport grass, an aerial car park, and three.js water normals (sources in `textures/README.md`). Pass `textures: '<path>/'`, or `textures: false` for the painted fallbacks.

On desktop the sea is a reflective water shader (adapted from three.js Water, MIT) with shallow turquoise near the beach, deep blue offshore and a surf line. The picture renders in HDR with a light bloom and 4K shadows. Phones keep the lighter path: no mirror, no bloom, 1K shadows. Options: `water: false`, `bloom: false`.
