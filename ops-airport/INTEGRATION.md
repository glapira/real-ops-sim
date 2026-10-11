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
| Split-flap boards on the terminal roof | Departures from `departures[]` (Boarding when due within 3 h, Overdue in red), Arrivals from `arrivals[]` or the latest `feed[]` rows. Click a board to open its list |
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

Everything here is written from scratch: geometry, people, aircraft, brain and UI. Nothing is copied from agents-office or deskrpg. The only dependency is three.js (MIT).
