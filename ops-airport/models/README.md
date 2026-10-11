# Ops Airport models

These GLB files are converted from FlightGear aircraft and ground equipment, with the Solidaire livery painted on by `tools/build_models.py`. All sources are GPL v2 or later, so these converted models are GPL v2 or later too.

| File | Source | Authors |
|---|---|---|
| `b787.glb` | [787 family](https://github.com/IskenderWang/787-family): 787-8 airframe, GEnx engines | FlightGear 787 team |
| `a320.glb` | FGAddon `A320-family`: A320-216 airframe, CFM56 engines | Josh Davidson (Octal450) and contributors |
| `global.glb` | FGAddon `CRJ700-family`: CRJ700 airframe, engines and gear, as a stand-in for the Global 8000 | FlightGear CRJ700 team |
| `do228.glb` | FGAddon `do228`: Dornier 228-212 | Bea Wolf (D-ECHO) |
| `fuel.glb`, `cater.glb` | 787 family: `Models/Ground/Services` (Volvo FM fuel and catering trucks) | FlightGear 787 team |
| `tug.glb` | FGAddon `pushback` | FlightGear contributors |
| `followme.glb` | FGAddon `followme` | FlightGear contributors |

FGAddon: https://sourceforge.net/p/flightgear/fgaddon/HEAD/tree/trunk/Aircraft/

To rebuild, fetch the sources with `tools/sfget.py` (FGAddon) and git (787 family), then run `python3 tools/build_models.py <out-dir>`.
