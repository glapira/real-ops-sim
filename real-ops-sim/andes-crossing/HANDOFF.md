# Handoff to the Mac session (Remote Control / Claude in Chrome)

The cloud session built the framework: engine, data layer, server endpoints, offline support, base data and screens.
Three jobs need your Mac: a browser with your logins, the Outlook attachments, and the FTP account.

## How to start it

1. Update the Claude desktop app on the Mac.
2. Make a normal folder, for example `~/Documents/andes` (not inside a hidden folder or ~/Library).
3. In that folder: `git clone https://github.com/glapira/real-ops-sim && cd real-ops-sim && git checkout claude/andes-turbulence-research-rbngqm`
4. Open Claude Code there (desktop app, or `claude` in the terminal) with Claude in Chrome turned on.
   Leave ForeFlight Dispatch (or Navigraph Charts) logged in in Chrome.
5. Paste the prompt below.

## Prompt to paste

> Read `real-ops-sim/andes-crossing/HANDOFF.md` and `real-ops-sim/andes-crossing/docs/` first. Do jobs 1 to 3 in order.
> Reference only, never for navigation. Keep chart content (escape routes) out of git: it goes to the server only.

### Job 1: airways across the Andes → `web/data/airways.json`

Source: ForeFlight Dispatch or Navigraph Charts in Chrome (logged in), reference use only.
Scope: every published ATS route (upper and lower, RNAV and conventional) that crosses or runs along the Andes, the whole
range from Venezuela and Colombia to Tierra del Fuego (about 11°N to 55°S): the Bogotá, Barranquilla, Guayaquil, Lima,
La Paz, Antofagasta, Santiago, Puerto Montt, Punta Arenas, Resistencia, Córdoba, Mendoza and Comodoro Rivadavia FIRs.
Include the routes the operator flies from the bases SABE and SAEZ toward Chile, Peru, Colombia and North America.

Format (GeoJSON FeatureCollection, one Feature per airway, LineString in route order):
`{"type":"Feature","properties":{"ident":"UL780","level":"upper|lower|both","rnav":true,"fixes":["AAAAA","BBBBB"],"mea_ft":[...],"source":"ForeFlight Dispatch, cycle 2611"},"geometry":{"type":"LineString","coordinates":[[lon,lat],...]}}`
Also write `web/data/fixes.json` (Point per fix: ident, type). Coordinates in decimal degrees to 4 places.
Set `"status":"ready"` and the AIRAC cycle at the top level. Commit and push.

### Job 2: escape routes → `web/data/escape-routes.json` (server only, NOT in git)

Source: Outlook, thread "ANDES Depressurization/Driftdown Proof Charts" from James Smith (Jeppesen).
Use the 13 Nov proofs (787 ANDES 2 EB/WB relabelled after Guillermo Toledo's 11 Nov check, G8000 ANDES 1 WB) and the
6 and 10 Nov proofs Guillermo passed as OK; replace all of them with the final PDFs when they arrive (expected 16–19 Nov,
effective 27 Nov revision). G8000 ANDES 2 and 3 are still to come; G8000 ANDES 3 EB lacks the route before EL401.
Format: `docs/escape-routes-schema.md`. Copy everything exactly as printed. Add the file to `.gitignore`.

### Job 3: deploy to the server

Upload `andes-crossing/web/` to a new folder on the avitrainsolutions.com hosting, next to `aeroledger/`
(suggested `public_html/andes/`, so the app lives at https://avitrainsolutions.com/andes/). No login for now.
The app links the shared kit at `/solidaire/shared/kit/` that is already on the server.
Make `web/api/cache/` and `web/api/store/` writable by PHP (the endpoints use PHP's curl extension, or streams as a fallback). Check https://avitrainsolutions.com/andes/api/metar.php?ids=SCEL,SAME
returns JSON. Then add the GitHub Actions workflow in `deploy/` with the FTP secrets (FTP_SERVER, FTP_USERNAME, FTP_PASSWORD)
set in the repository settings, so the WAFS job can upload every 6 hours.
