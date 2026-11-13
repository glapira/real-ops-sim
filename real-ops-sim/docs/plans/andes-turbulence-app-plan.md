# Andes Crossing Turbulence App: Research and Plan

Status: planning only, no code yet. Written 13 Nov 2026.

This plan covers a small web app that estimates turbulence risk for a flight crossing the Andes. You enter a route (airports, waypoints, airways, cruise level, time). The app shows a risk picture along that route, with the cross-Andes pressure difference as one of its core inputs.

The goal is a likelihood: the chance of light, moderate and severe turbulence at each point and level of your route, with a confidence label. The app gets there by combining the pressure difference, the weather models, ensembles, official warnings and, over time, your crews' own reports.

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

## 1b. Extra research for the likelihood engine

### How the professionals build a turbulence forecast

NCAR's Graphical Turbulence Guidance (GTG) drives the WAFS, Turbli and most airline products. It computes many separate diagnostics from a weather model. Some cover clear-air turbulence (wind shear, deformation, Richardson number). Others cover mountain waves. GTG3 added 14 mountain-wave diagnostics. GTG turns each diagnostic into an EDR value with a simple fitted curve, log EDR = a + b log D, then blends them.

For the mountain-wave part, GTG multiplies a normal turbulence diagnostic by terrain height and low-level wind speed. Research by Wolff and Sharman found that moderate-or-worse mountain-wave turbulence shows up mostly where terrain tops 1.5 km and where the low-level wind blows within 30° of perpendicular to the range. The Andes meet the first test along the whole route.

### Thresholds we can use

1. ICAO Annex 3 (Amendment 79, from November 2020): EDR 0.20 to 0.45 is moderate, 0.45 and above is severe. Those values hold for a medium transport aircraft. A light business jet feels the same EDR as rougher.
2. Ellrod index (vertical shear times deformation): about 4 light to moderate, 8 moderate, 12 moderate to severe, in units of 10⁻⁷ s⁻². A recent study tuned the best cut-off for EDR moderate-or-greater at about 6.4. These thresholds shift between models, so we tune them ourselves.

### Extra data we can add

1. **Ensembles.** ECMWF and other centres run 30 to 50 slightly different versions of the same forecast. Open-Meteo serves ECMWF IFS and AIFS ensembles and the Canadian GEM ensemble. The share of members that show turbulence gives an honest probability.
2. **Soundings.** Santo Domingo, Chile (WMO 85586) on the windward side and Mendoza (WMO 87418) on the lee side launch weather balloons. The University of Wyoming archive serves them. We can check the model against a real profile each morning.
3. **Satellite.** GOES-East covers South America. Its water vapour channel often shows standing wave bands in the lee of a range. Studies in Colorado found turbulence more likely on days with those signatures, though not every wave day turned rough. It works best as a visual layer for the pilot, not as a score input.
4. **International SIGMETs.** aviationweather.gov serves decoded international SIGMETs in JSON at `/api/data/isigmet`, free and without a key.
5. **Shared airline EDR data.** IATA runs a programme (Turbulence Aware) where member airlines share automated EDR reports. Worth asking whether an operator can join, because those reports would be the best truth data for tuning.

### Getting access to WAFS and shared turbulence data

1. **Free public WAFS grids (check first).** NOAA appears to publish the 0.25° WAFS hazard files, EDR turbulence included, on its public NOMADS server inside the GFS output (file pattern `gfs.tCCz.awf_0p25.fFFF.grib2`). Forum reports say these files cover 13 levels at 3-hourly steps from 6 to 36 h. If Phase 0 confirms this, we get the WAFS forecast with no account.
2. **WIFS account (WAFC Washington, covers the Americas).** You apply online at aviationweather.gov/wifs. The rule: you must perform international flight operations, or provide weather information for them. The ICAO State official and the FAA WIFS approving official both sign off, case by case. The operator holding the AOC (Comlux) is the natural applicant. Legacy WIFS access closes in November 2028, and the newer API replaces it.
3. **SADIS API (WAFC London).** Run by the Met Office, approval by the SADIS Manager. It mainly serves Europe, Africa, the Middle East and Asia, so WIFS is the better fit for South America.
4. **IATA Turbulence Aware.** Airline programme, 21 to 22 airlines in 2024 to 2026. Aircraft contribute through NCAR EDR software in the avionics (an Airbus or Boeing option). Airlines can also nominate a data integrator to receive the data. I found no published route for business aviation operators or any public pricing, so this needs a direct enquiry to IATA.
5. **SkyPath (business aviation alternative).** Collects turbulence from iPads on board, ADS-B, EDR reports and PIREPs. It supports business aviation and offers an SDK. A realistic second source of truth data if IATA says no.

---

## 2. What the app does

### 2.1 Input

1. Route string, for example `SCEL UMKAL ... SAME` or `SAEZ ... DOZ ... SCEL`. Airports, waypoints, VORs and airways.
2. Planned cruise level, or a band (for business jets, FL410 to FL450 matters).
3. Departure time (ETD), so the app picks the right forecast hour.
4. Aircraft category (light, medium, heavy), because the same EDR feels worse in a light jet.

### 2.2 Output: a likelihood, not a yes or no

For each route segment and each flight level, the app gives three numbers:

1. Chance of light or worse turbulence
2. Chance of moderate or worse (MOG)
3. Chance of severe

It also gives a confidence label (high, medium, low) based on how much the models agree, and it names the main cause: mountain wave, jet stream shear, convection, or low-level rotor.

The headline for the crossing reads like this: "SCEL to SAME at FL350, 14 Nov 18Z: 45% chance of moderate or worse, mainly mountain wave over the crest. FL390 drops to 20%. Confidence medium."

---

## 3. The likelihood engine

The engine works in four steps. Each step uses data from section 3.1.

### 3.1 Every input it uses

| Group | Inputs | Where from |
|---|---|---|
| Surface pressure pair | QNH and temperature difference across the range, observed now and forecast for ETD | METARs, model sea-level pressure |
| Cross-range wind | Wind component perpendicular to the range at 700, 600, 500, 300, 250, 200 hPa. Crest-level wind. Angle to the ridge (within 30° counts) | Model, pressure levels |
| Stability | Brunt–Väisälä frequency, Froude number, Scorer parameter profile, the 1.6 rule, inversions near crest height | Model temperature and height by level |
| Wave strength | Model vertical velocity over and downwind of the crest, GTG-style terrain × low-level wind multiplier | Model plus terrain |
| Clear-air turbulence | Vertical wind shear (kt per 1,000 ft), Richardson number, Ellrod index, horizontal shear, jet core speed and distance, tropopause height against your level | Model |
| Convection | CAPE and lifted index along the route (summer storms over the range) | Model |
| Official warnings | Active SEV TURB and SEV MTW SIGMETs | aviationweather.gov isigmet |
| Checks | Morning soundings at Santo Domingo and Mendoza, satellite water vapour image | Wyoming archive, GOES-East |

### 3.2 Step 1: physics score per point

The engine samples the model every 10 NM along the route and at each flight level. For each point it computes every diagnostic above. Then it converts each one into an EDR estimate with the GTG-style curve. To start, we take the curve values from the published research and the Harrison Abacus. Later, our own data tunes them.

Mountain-wave diagnostics only count when the point sits over or downwind of high terrain and the wind crosses the range within 30° of perpendicular. Clear-air diagnostics count everywhere.

The pressure-pair check enters as its own diagnostic. It moves the whole crossing up or down, and the app also shows it on the abacus, because pilots know that chart.

### 3.3 Step 2: probability from the ensemble

The engine runs step 1 on each ensemble member, 30 to 50 forecasts. If 18 of 40 members show EDR above 0.20 at FL350 over the crest, the raw chance of moderate or worse there is 45%. The spread between members also sets the confidence label.

We run the deterministic GFS and ECMWF on top for detail, because the ensembles run at coarser resolution.

### 3.4 Step 3: overrides and floors

1. An active SEV TURB or SEV MTW SIGMET on the route sets a floor: the app shows at least "severe possible" in that area, whatever the model says.
2. If observed QNH difference right now is far above what the model forecast, the engine raises the mountain-wave score. The METAR beats the model for the next few hours.
3. If the morning sounding shows a stronger crest wind than the model, the same rule applies.

### 3.5 Step 4: calibration with real flights

Raw ensemble probabilities run too high or too low until you tune them. The app keeps a log of what crews felt (date, time, position, level, intensity, aircraft). Every few weeks the engine compares its forecasts with those reports and adjusts the curves (logistic or isotonic calibration).

Once we have a few hundred labelled crossings, we can train a Random Forest the way the 2022 study did, using historical model data (ERA5 or Open-Meteo's historical forecasts) as inputs. The study got its best results that way.

### 3.6 Proving it works

1. **Backtest.** Before anyone relies on it, run the engine on past dates with known events: the Aerolíneas Argentinas injuries in September 2019, Avianca near Salta in June 2016, and big Zonda days with 25 to 30 hPa differences. Check that it lights up.
2. **Quiet days.** Run it on calm days too, so we know how often it cries wolf.
3. **Side by side.** For one season, show the app's forecast next to Turbli and the WAFS turbulence chart, and log which one matched the flight.
4. **Score.** Track the same skill score the study used (true skill statistic). The abacus alone scored under 0.25. The target is 0.5 or better.

---

## 4. Screens

1. **Cross-section.** Distance along route on the x-axis, altitude on the y-axis. Terrain underneath, probability of moderate or worse as colour above, your planned level as a line.
2. **Map.** The route over terrain, each leg coloured by risk at your level, SIGMET areas and the satellite water vapour image as optional layers.
3. **Abacus.** The pressure-pair point on the Harrison Abacus with its trend from -6 h to +24 h.
4. **Best level and time.** A small grid of levels against departure times, so you can see that FL390 or leaving two hours later looks calmer.
5. **Why.** The main drivers for the worst segment, in plain words: "Crest wind 55 kt at 500 hPa, stable layer at 5 km, jet 140 kt 60 NM south."
6. **Report.** A form for crews to log what they felt after the flight.

Every screen shows the data time and the source, so a pilot knows how fresh it is.

---

## 5. Data sources

| Need | Source | Cost and access | Notes |
|---|---|---|---|
| METAR QNH and temperature | aviationweather.gov Data API | Free, no key | Need to confirm SCEL and SAME return data |
| International SIGMETs | aviationweather.gov `/api/data/isigmet` | Free, no key | Confirm Chilean and Argentine FIR coverage |
| Model winds, temperature, heights, vertical velocity by level | Open-Meteo (GFS, ECMWF) | Free for non-commercial use, no key | Commercial use needs a paid plan |
| Ensembles | Open-Meteo ensemble API (ECMWF IFS and AIFS, GEM) | Same as above | Confirm which pressure levels each ensemble serves |
| Historical model data for backtests and training | Open-Meteo historical forecast API, ERA5 | Free | |
| Soundings | University of Wyoming archive | Free | Stations 85586 and 87418 |
| Satellite | GOES-East water vapour | Free | Visual layer |
| Terrain profile | SRTM tiles or Open-Meteo elevation | Free | |
| Airways and waypoints | Chile and Argentina AIP ENR 3 | Free to read, manual entry | Store as YAML |
| WAFS EDR turbulence | WIFS or SADIS | Account required | Benchmark and extra layer |
| Shared airline EDR reports | IATA Turbulence Aware | Membership | Best truth data if reachable |

Navigation data is the awkward part. Commercial nav databases need a licence. For the Andes we only need a few dozen airways and waypoints, so a hand-built YAML file from the AIP works.

### Station pairs for the pressure check (to confirm)

1. SCEL Santiago / SAME Mendoza (the classic central crossing)
2. SCEL Santiago / SACO Córdoba
3. SCFA Antofagasta / SASA Salta (northern crossing)
4. SCIE Concepción or SCTC Temuco / SAZN Neuquén
5. SCTE Puerto Montt / SAZS Bariloche (Patagonia)

---

## 6. Architecture

1. **Front end.** A single-page app in TypeScript. MapLibre GL for the map, D3 or Plotly for the cross-section and the abacus.
2. **Back end.** Python (FastAPI). Python has the weather maths libraries we need (MetPy for stability and shear, xarray for model grids, scikit-learn for calibration and the Random Forest).
3. **Scheduler.** A job pulls new model runs every 6 hours, METARs and SIGMETs every 15 to 30 minutes, and pre-computes the Andes grid. A route request then only reads the pre-computed grid, so answers come back in a second or two.
4. **Storage.** SQLite or Postgres for the forecast cache, the crew reports and the backtest results.
5. **Data folder.** Station pairs, abacus zones, thresholds, airways and waypoints, all in YAML.
6. **Hosting.** Open access for now. Add a login when it connects to the Ledger.

---

## 7. Phases

**Phase 0, verify (before code).**
1. Get the original Harrison Abacus chart with its zone values.
2. Test that aviationweather.gov returns SCEL and SAME METARs and Andes SIGMETs.
3. Test Open-Meteo pressure-level and ensemble data over 33°S.
4. Pull the airway list from the Chile and Argentina AIPs.
5. Confirm current Annex 3 EDR thresholds (Amendment 82 may change WAFS products).

**Phase 1, the engine on one crossing.**
SCEL–SAME only. All diagnostics, ensemble probabilities, the abacus, and the crew report form. Backtest on the known events.

**Phase 2, any route.**
Route parser, airway database, cross-section, map, best-level grid.

**Phase 3, all crossings and extra layers.**
Other station pairs, SIGMET overlay, soundings check, satellite layer, WAFS comparison if we get access.

**Phase 4, calibration and learning.**
Tune the curves from crew reports. Train the Random Forest once enough data exists. Connect to the Ledger.

---

## 8. Open questions

1. Where should this live? This repo says "flight-simulation use only" in its README and licence notes. A real-ops tool may belong in its own repo or inside the Ledger project.
2. What runs on your server today (Node, Python, PHP, plain static hosting)?
3. Who uses it at first: you, Solidaire crews, or the public?
4. Which crossings matter most beyond Santiago–Mendoza?
5. Do you have the abacus chart your company uses, and any company thresholds?
6. Commercial or not: Open-Meteo's free tier is non-commercial only.
7. Can Solidaire or Comlux join IATA Turbulence Aware, or get WAFS access through WIFS or SADIS?
8. Will your crews fill in a turbulence report after each Andes crossing? Calibration depends on it.

---

## 9. Sources

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

20. Sharman and Pearson (2017), GTG3 mountain-wave diagnostics, as summarised in Sharman's review "Aviation Turbulence: Dynamics, Forecasting, and Response to Climate Change". https://link.springer.com/article/10.1007/s00024-018-1822-0
21. NOAA, "Improvement of Mountain-Wave Turbulence Forecasts in NOAA's Rapid Refresh". https://journals.ametsoc.org/downloadpdf/view/journals/wefo/34/3/waf-d-18-0187_1.pdf
22. ICAO METP, revised EDR values, Amendment 79 to Annex 3. https://www.icao.int/airnavigation/METP/Seventh Meeting of the MOG/METPWGMOG_7_SN.35_Revised_EDR_values_Amd_79_vs_final_22mar2018.pdf
23. OPSGROUP, "Who is Eddie and what does he have to do with turbulence". https://ops.group/blog/who-is-eddie-and-what-does-he-have-to-do-with-turbulence/
24. Ellrod index (AWC definition and thresholds). https://en.wikipedia.org/wiki/Ellrod_index
25. Open-Meteo ensemble API. https://open-meteo.com/en/docs/ensemble-api
26. aviationweather.gov Data API OpenAPI spec (isigmet). https://aviationweather.gov/data/api/swagger.yaml
27. University of Wyoming sounding archive, Chilean stations (LSST note). https://confluence.lsstcorp.org/display/SIM/Wyoming+web+site+with+archived+atmospheric+data
28. CIMSS, mountain wave signatures on water vapour imagery. https://cimss.ssec.wisc.edu/satellite-blog/archives/2115

29. WIFS (WAFS Internet File Service). https://aviationweather.gov/wifs/
30. ICAO, obtaining a WIFS account. https://www.icao.int/sites/default/files/METP/Documents/Obtaining-access-to-WIFS-as-a-backup-to-SADIS-FTP.pdf
31. SADIS WAFS Gridded Data service. https://eur-registry.swim.aero/node/166466
32. IATA, Turbulence Aware platform expands (Dec 2024). https://www.iata.org/en/pressroom/2024-releases/2024-12-10-04/
33. Airbus, turbulence alert collaborative network. https://www.aircraft.airbus.com/en/newsroom/news/2023-03-turbulence-alert-the-collaborative-network
34. SkyPath. https://skypath.io
35. X-Plane.org forum, WAFS GRIB file naming on NOMADS. https://forums.x-plane.org/forums/topic/282159-what-the-heck-is-a-grib-file/

Note: this session's network blocked direct downloads of these pages. The findings above come from search summaries and abstracts. The blog thresholds (8 to 12 hPa, 5 °C, 280° to 320°) are not confirmed by an official source yet.
