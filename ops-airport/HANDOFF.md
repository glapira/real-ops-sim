# Handing the Ops Airport to the AeroLedger chat

This folder is finished and ready to drop into AeroLedger. From here the AeroLedger chat on the Mac owns it: wiring, design changes and deploys.

Branch: `claude/ledger-ops-3d-office-e7by4h` in `glapira/real-ops-sim`, folder `ops-airport/`.
Live preview: the "AeroLedger Ops Airport" artifact on claude.ai (sample data only).

## What is in the folder

| File | What it is |
|---|---|
| `ops-airport.js` | The whole 3D ops room. One plain script, no build step. Defines `window.OpsAirport` |
| `sample-data.js` | Sample `ops_room` and `ops_graph` JSON, only for the demo page |
| `index.html` | Demo page. Open it through any local web server to see it running |
| `models/` | Real aircraft, ground vehicles, bus, yachts and buoys as `.glb` (about 13 MB) |
| `textures/` | Runway, taxiway, apron, grass, car park, water and tree textures |
| `tools/` | Python scripts that rebuilt the models from FlightGear and painted the Solidaire livery |
| `INTEGRATION.md` | How each part maps to the ops room data, and the exact wiring steps |

## Paste this into the AeroLedger chat

```
The 3D ops room for the ops page is finished in another repo. Bring it into AeroLedger and own it from here.

1. Get the files: from GitHub glapira/real-ops-sim, branch claude/ledger-ops-3d-office-e7by4h, copy the whole ops-airport/ folder (ops-airport.js, models/, textures/, INTEGRATION.md, HANDOFF.md). Skip index.html and sample-data.js, they are demo only. Keep tools/ in the repo but out of the deployed app.
2. Read ops-airport/INTEGRATION.md and HANDOFF.md first. Follow "Steps for app/views-ops.js": vendor three.js 0.170 as a module, add ops-airport.js to boot.php's $js list, mount it into the ops card, pass the ops_room and ops_graph JSON we already poll with room.update() and room.updateGraph(), and call room.unmount() when leaving the page. Pass models and textures paths that point at where you put those folders.
3. Keep the current v2 SVG ops view as the fallback when WebGL is missing.
4. Check the agents list we really serve. Every agent needs team: cloud, ledger, mac, code or ship. Add the ship team agents (ship-ops, crew-desk, supplies, mission-log) only if they exist for real.
5. Test on desktop and on my phone, day and night, light and dark. Show me screenshots before anything goes live. Do not deploy without my yes.
6. After that, design changes are yours. Use the "Where to change the design" table in HANDOFF.md.
```

## Where to change the design

Search `ops-airport.js` for these names. Line numbers move, names do not.

| To change | Look for |
|---|---|
| Team names, gate letters, gate colours, gate positions | `const TEAMS` near the top |
| Labels and all on-screen text (English and Spanish) | `const STR` |
| Building, apron, steel and livery colours | `const P = {` inside `buildWorld` |
| Terminal roof shape, height and overhangs | `const ROOF` and `roofY` |
| Roof metal, wood soffit, skylights | `roofTex`, `roofTopM`, `soffitM`, `skyM` |
| When the roof fades to show the teams | `updateRoof` (distance and angle thresholds) |
| Glass walls, entrances, gable ends | `terminalWing` |
| Glass hall round the tower | the block after `terminalWing(8, 72)` |
| Jet bridges and where they dock | `jet bridges:` comment, `park` and `dock` points, `updateBridge` |
| Turnaround timing and vehicle spots | `turnaround`, `servicePos` |
| Departure and arrival boards | `makeBoard`, `drawBoard` |
| Your own aircraft and where they park | `FLEET_SPOT` and the `fleet` option |
| Sky, sun and night colours | `const SKY` |
| Weather presets | `const WX` |
| Night lights and glows | `updateEnv` |
| Camera views (Overview, Gates, Brain...) | `const AREAS` |
| Tour stops | `TOUR_STOPS` |
| Panels, tabs, phone layout | `buildUI` and the CSS in `injectCss` |

Livery or registrations on the aircraft are painted into the model textures, not set in code. Change them in `tools/build_models.py` and rebuild. That needs the FlightGear source models, which are not in the repo, so treat it as a rare job.

## Things to know

1. The page makes no AI calls and no network calls of its own. It only draws what you pass to `update()` and `updateGraph()`.
2. Models load in the background. The drawn stand-ins show first and swap out when the files arrive. If a model fails to load, the stand-in stays.
3. On your own server, serve `models/*.glb` as they are. The `.json` model files and `modelExt: '.json'` were only needed for the claude.ai preview, which blocks `.glb`.
4. The Global 8000 is a Bombardier CRJ700 airframe painted plain white. No free Global model exists. The terminal, tower, hangar and ship are drawn in code.
5. Phones get lighter settings on their own: smaller shadows, no mirror water, no bloom.
6. Licence: see the Licence section in `INTEGRATION.md`. The FlightGear models and textures are GPL.
