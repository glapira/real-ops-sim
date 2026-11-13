# Andes Crossing Turbulence App: Research and Plan

Status: planning only, no code yet. Written 13 Nov 2026.

This plan covers a small web app that estimates turbulence risk for a flight crossing the Andes. You enter a route (airports, waypoints, airways, cruise level, time). The app shows a risk picture along that route, with the cross-Andes pressure difference as one of its core inputs.

The app is a pilot awareness tool. It does not replace SIGMETs, the operator's flight planning or the official forecast.

---

## 1. What the research says

### 1.1 The physics in one paragraph

The Andes near 33°S run roughly north to south with a crest around 4,500 to 6,000 m (Aconcagua 6,961 m). When strong westerlies blow across that wall in stable air, they set up mountain waves. Those waves can trap low down and form rotors on the lee (Argentine) side. They can also climb and break high up, up to the tropopause and beyond. Pilots see the result as moderate to severe turbulence, often in clear air with no lenticular cloud as a warning. A deep low east of the range and high pressure on the Chilean side drive the strongest events, which Mendoza feels at the surface as the Zonda wind.

### 1.2 The pressure-difference rule you described

Crews flying Santiago to Mendoza use a quick check from the two METARs:

1. Santiago (SCEL) QNH 8 to 12 hPa or more above Mendoza (SAME) QNH: turbulence more likely.
2. Mendoza 5 °C or more warmer than Santiago: turbulence more likely.
3. Wind at FL180 from about 280° to 320°: favourable for waves.

The fuller tool is the **Harrison Abacus** (ábaco de Harrison). It plots the SCEL minus SAME QNH difference on one axis against the upper wind on the other. Coloured zones on the chart give the expected intensity. In the original Andes version the wind came from the Juan Fernández upper-air station, at 18,000 ft, about 450 NM west of Santiago. Modern versions use the 500 hPa wind component perpendicular to the range (about FL180).

Harrison built the method for the US Rockies, from the United Airlines mountain-wave nomogram. That chart used the sea-level pressure difference across the ridge and the strongest wind between 10,000 and 20,000 ft. Airlines later adopted it for the Andes.

An open-source Windy.com plugin already implements the Andes version. It plots SCEL–SAME QNH difference against the 500 hPa cross-range wind at six times (-6 h, now, +6, +12, +18, +24 h). That plugin is the closest existing reference for our first screen.

Larger pressure differences show up in big events. One review of Zonda cases reports about 30 hPa between Santiago and Mendoza at the peak of a severe 2012 event.

### 1.3 How well the abacus works

Menegardo-Souza and colleagues (Pure and Applied Geophysics, 2022) tested the Harrison Abacus against LATAM aircraft data on the Santiago–Mendoza route. They used automated vertical acceleration and EDR records from March 2018 to December 2019 (about 1,300 records). The abacus scored a true skill statistic below 0.25. Machine-learning models fed with weather-model output (3 km model and ERA5 reanalysis) reached 0.60 or better. Random Forest did best.

The same group (2021) looked at the rare severe events on this route. Winter has the most turbulence overall. Severe events happened more often in summer and early autumn, and those did not come from mountain waves or storms. They came from clear-air turbulence driven by the Bolivian High, the subtropical jet and the terrain together.

Takeaway for the design: the pressure difference is a good first alert and pilots trust it. On its own it misses a lot. The app should combine it with model wind, stability and jet data, and show both.

### 1.4 General mountain-wave rules worth encoding

1. FAA: expect mountain-wave turbulence when 40 kt or more blows across a ridge in stable air.
2. Crest-level wind 25 to 50 kt: moderate turbulence possible downstream. Above 50 kt: severe turbulence possible 50 to 150 NM downstream, at and below rotor level, and within 5,000 ft of the tropopause.
3. NOAA training material for Chile: turbulence from the surface to 5,000 ft above the crest when the flow is perpendicular to the range and above 24 kt.
4. The 1.6 rule: if the wind 2,000 m above the crest is more than 1.6 times the crest wind, expect trapped lee waves (rotors).
5. Froude number: high values mean air goes over the range (waves). Low values mean air goes around or blocks.
6. Scorer parameter: a sharp drop with height in the mid troposphere favours trapped lee waves.
7. The more perpendicular the wind is to the range, the stronger the effect.

### 1.5 Official and commercial turbulence products

1. **WAFS gridded turbulence (EDR).** ICAO's global forecast, 0.25° grid, out to 48 h, built on NCAR's GTG algorithm. It covers clear-air and mountain-wave turbulence. Access runs through WIFS (US) or SADIS (UK), both need an account. aviationweather.gov shows a global WAFS display.
2. **US GFA turbulence maps** do not cover South America.
3. **SIGMETs** from the Chilean and Argentine FIRs (SEV TURB, SEV MTW). These are the legal warnings and must appear in the app.
4. **ICAO EDR thresholds.** Current guidance treats EDR above about 0.20 as moderate and above about 0.45 as severe. Older text used 0.4 and 0.7. Confirm against the current Annex 3 before coding.
5. **Turbli** uses GFS plus NOAA's global GTG. Turbli itself says the 13 km model misses small-scale mountain turbulence and the mountain-wave part tends to over-forecast.

### 1.6 Routes and geography

Turbli has ranked Mendoza–Santiago the most turbulent route in the world two years running (2024 and 2025). Other Andes routes on its list: Córdoba–Santiago, Mendoza–Salta, Mendoza–Bariloche, Bariloche–Santiago. Injury events also happened on longer crossings, for example Avianca near Salta (June 2016) and Aerolíneas Argentinas over the Andes (September 2019).

Southern Patagonia has the strongest wave activity in the Andes, mostly in winter.

For SCEL, a simulator briefing (not authoritative) says the STARs via SIMOK or ASIMO are preferred and arrivals via UMKAL should be avoided in mountain-wave conditions, with a high crossing preferred. These need checking against the current Chilean AIP.

I could not confirm the exact airway designators across the range from public sources. We need the Chile and Argentina AIP (ENR 3) for that.

---

## 2. What the app does

### 2.1 Input

1. Route string, for example `SCEL UMKAL ... SAME` or `SAEZ ... DOZ ... SCEL`. Airports, waypoints, VORs and airways.
2. Planned cruise level, or a band (for business jets, FL410 to FL450 matters).
3. Departure time (ETD), so the app picks the right forecast hour.
4. Aircraft category (light, medium, heavy), because the same EDR feels worse in a light jet.

### 2.2 Three layers of evidence

**Layer A, the pressure check (the Harrison layer).**
For each crossing on the route, the app picks the station pair on each side of the range and reads QNH and temperature from the latest METARs. It also pulls forecast sea-level pressure from the model for ETD. It computes the QNH difference, the temperature difference and the cross-range wind at 500 hPa. Then it plots the point on an abacus chart with the trend from -6 h to +24 h.

Starting station pairs (to confirm):

1. SCEL Santiago / SAME Mendoza (central crossing, the classic one)
2. SCEL Santiago / SACO Córdoba (longer central crossing)
3. SCFA Antofagasta / SASA Salta (northern crossing)
4. SCIE Concepción or SCTC Temuco / SAZN Neuquén
5. SCTE Puerto Montt / SAZS Bariloche (Patagonian crossing)

**Layer B, the model profile along the route.**
The app samples the weather model every 10 to 20 NM along the route, at pressure levels from 850 to 150 hPa. For each point it computes:

1. Wind component across the range
2. Crest-level wind and the 1.6 rule
3. Stability (Brunt–Väisälä frequency) and Froude number
4. Scorer parameter profile
5. Vertical wind shear and Richardson number (clear-air turbulence)
6. Jet core position and tropopause height
7. A simple CAT index such as Ellrod TI

These combine into a risk score per point and level: nil, light, moderate, severe.

**Layer C, official warnings.**
Active SIGMETs for the FIRs the route crosses, drawn on the map and the cross-section. If we get WAFS access later, the WAFS EDR grid goes here too.

### 2.3 Output

1. **Cross-section.** Distance along route on the x-axis, altitude on the y-axis. Terrain profile underneath, risk colours above, your planned level as a line. This is the main picture.
2. **Map.** The route over a terrain map, each leg coloured by the worst risk at your level. SIGMET areas on top.
3. **Abacus chart.** The SCEL–SAME point (or the pair for your crossing) on the abacus, with its trend over the next 24 h.
4. **Summary card.** Overall risk for the crossing, the worst segment, the best level band, the time window that looks calmer, and the raw numbers (QNH difference, temperature difference, 500 hPa cross-range wind).

Every screen shows the data time and source, so a pilot knows how fresh it is.

---

## 3. Data sources

| Need | Source | Cost and access | Notes |
|---|---|---|---|
| METAR QNH and temperature | aviationweather.gov Data API | Free, no key | Need to confirm SCEL and SAME return data |
| Model winds, temperature, heights by level | Open-Meteo (GFS, ECMWF) | Free for non-commercial use, no key | Commercial use needs a paid plan |
| SIGMETs | aviationweather.gov international SIGMET feed | Free | Confirm coverage of Chilean and Argentine FIRs |
| Terrain profile | Open-Meteo elevation or SRTM tiles | Free | 90 m SRTM is plenty |
| Airways and waypoints | Chile and Argentina AIP ENR 3 | Free to read, manual entry | Store as YAML in the repo |
| WAFS EDR turbulence | WIFS or SADIS | Account required | Phase 3, optional |

Navigation data is the awkward part. Commercial nav databases (Navigraph and similar) need a licence. For the Andes we only need a few dozen airways and waypoints, so a hand-built YAML file from the AIP is the practical path. It matches how this repo already stores data.

---

## 4. Architecture

1. **Front end.** A single-page app in TypeScript. MapLibre GL for the map. A charting library (D3 or Plotly) for the cross-section and the abacus.
2. **Back end.** A small API on your server (Node or Python FastAPI). It fetches METARs, SIGMETs and model data, caches them for 15 to 30 minutes, and does the route maths. This avoids browser CORS problems and keeps the free APIs happy.
3. **Data folder.** Station pairs, abacus zones, Andes airways and waypoints, all as YAML.
4. **Hosting.** Open access for now, as you said. Add a login later when it connects to the Ledger.

---

## 5. Phases

**Phase 0, verify (before code).**
1. Get the original Harrison Abacus chart with its zone values. If your company or the DMC has a version, that is the best source.
2. Test that aviationweather.gov returns SCEL and SAME METARs and Andes SIGMETs.
3. Test Open-Meteo pressure-level data over 33°S.
4. Pull the airway list from the Chile and Argentina AIPs.
5. Confirm the current ICAO EDR thresholds.

**Phase 1, the abacus screen (MVP).**
SCEL–SAME only. Live METAR difference, model 500 hPa cross-range wind, abacus plot with the 24 h trend, and a plain summary. This alone is useful on day one.

**Phase 2, route and cross-section.**
Route parser, airway database, model sampling along the route, risk scoring, cross-section and map.

**Phase 3, official layers and more crossings.**
SIGMET overlay, the other station pairs, WAFS EDR if we get access.

**Phase 4, learn from real flights.**
A simple form where crews log what they felt (level, time, intensity). Over time this tunes the thresholds for your aircraft. This is also the natural link to the Ledger: flights and crew reports already live there.

---

## 6. Open questions

1. Where should this live? This repo says "flight-simulation use only" in its README and licence notes. A real-ops tool may belong in its own repo or inside the Ledger project.
2. What runs on your server today (Node, Python, PHP, plain static hosting)?
3. Who uses it at first: you, Solidaire crews, or the public?
4. Which crossings matter most beyond Santiago–Mendoza?
5. Do you have the abacus chart your company uses, and any company thresholds?
6. Commercial or not: Open-Meteo's free tier is non-commercial only.

---

## 7. Sources

1. Aviación Global, "Flying across the Andes. Mountain wave." https://www.aviacionglobal.com/miscellaneous/flying-across-the-andes-mountain-wave/
2. Menegardo-Souza et al. (2022), "In-Flight Turbulence Forecast Model Based on Machine Learning for the Santiago (Chile)–Mendoza (Argentina) Air Route", Pure and Applied Geophysics. https://link.springer.com/article/10.1007/s00024-022-03053-5
3. Menegardo-Souza et al. (2021), "Synoptic Patterns of Unusual Severe Turbulence Events in the Santiago (Chile)–Mendoza (Argentina) Route Region in Summer in the Southern Hemisphere", Pure and Applied Geophysics. https://doi.org/10.1007/s00024-021-02809-9
4. Windy plugin "Ábaco de Harrison" by fcoramos. https://github.com/fcoramos/windy-plugin-abaco-de-harrison
5. Harrison, "The mountain wave", NASA (1965). https://ntrs.nasa.gov/citations/19650026358
6. NASA literature survey of clear-air turbulence (1970). https://ntrs.nasa.gov/api/citations/19700022691/downloads/19700022691.pdf
7. Seluchi et al. (2003), "Analysis of Three Situations of the Foehn Effect over the Andes (Zonda Wind) Using the Eta–CPTEC Regional Model", Weather and Forecasting. http://mtc-m16b.sid.inpe.br/col/cptec.inpe.br/walmeida/2003/08.19.08.58/doc/Seluchi_Analysis%20of%20three%20situations.pdf
8. Norte (2015), "Understanding and Forecasting Zonda Wind (Andean Foehn) in Argentina: A Review". https://www.scirp.org/journal/paperinformation?paperid=56341
9. ICAO SAM 2016 SIGMET workshop, "Turbulencia: pronóstico y diagnóstico" (Davison). https://www.icao.int/sites/default/files/sp-files/SAM/Documents/2016-SIGMET/8_turbulencia_aviacion.pdf
10. NOAA WPC Chile 2016 training, mountain turbulence forecast exercise. https://ftp.wpc.ncep.noaa.gov/mike/CHILE_2016/Ejercicios-PDF/Ejercicio%206c_Pronostico%20de%20Turbulencia%20de%20Montanha.pdf
11. Mark Sinclair, "Aviation Weather Hazards" (crest-wind severity guide). https://www.weather.gov/media/zhu/ZHU_Training_Page/turbulence_stuff/turbulence3/turbulence.pdf
12. Turbli, forecasts for wind and turbulence. https://turbli.com/forecasts-for-wind-and-turbulence/
13. Turbli, mountain waves. https://turbli.com/blog/a-turbulent-world-mountain-waves/
14. aviationweather.gov WAFS help. https://aviationweather.gov/wafs/help.html
15. aviationweather.gov Data API. https://aviationweather.gov/data/api/
16. Open-Meteo GFS API. https://open-meteo.com/en/docs/gfs-api
17. Aeroinside, Avianca A332 near Salta, 4 Jun 2016. https://www.aeroinside.com/7665/avianca-a332-near-salta-on-jun-4th-2016-turbulence-injures-11
18. Aeroinside, Aerolíneas Argentinas A332 over the Andes, 20 Sep 2019. https://www.aeroinside.com/13751/argentinas-a332-over-andes-on-sep-20th-2019-turbulence-injures-9
19. Emol, route turbulence ranking, 3 Nov 2026. https://www.emol.com/noticias/Nacional/2026/11/03/1215974/ranking-rutas-aereas-turbulencias-santiago.html

Note: this session's network blocked direct downloads of these pages. The findings above come from search summaries and abstracts. The blog thresholds (8 to 12 hPa, 5 °C, 280° to 320°) are not confirmed by an official source yet.
