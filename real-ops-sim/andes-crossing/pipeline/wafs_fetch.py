#!/usr/bin/env python3
"""WAFS turbulence (EDR) for the Andes, free route: NOAA's public 0.25° WAFS GRIB2 files on NOMADS.

For each forecast hour it writes, under <out>/wafs/:
  index.json                         run time, valid times, levels, thresholds, source file names
  edr-FL<lvl>-f<hh>.png              coloured overlay (transparent below light) for MapLibre's image source
  onset-FL<lvl>-f<hh>.json           GeoJSON contours where EDR reaches moderate (0.20) and severe (0.45): where turbulence starts

Runs on a schedule (GitHub Actions or any Linux box) because NOMADS refuses some cloud addresses.
Needs: pip install eccodes numpy pillow contourpy
Usage: python3 wafs_fetch.py --out web/data [--run 2026111312] [--hours 6,9,12,...,36]

NOMADS keeps two days of runs. The path and file name pattern changed with WAFS upgrades; both known patterns are
tried, newest first. Untested from the build machine (NOMADS answered 403 there); first scheduled run must be checked.
"""
import argparse, datetime as dt, io, json, os, sys, urllib.request

BBOX = (-82.0, -57.0, -48.0, -14.0)          # lon_min, lat_min, lon_max, lat_max: the Andes and both sides
THRESH = {'light': 0.10, 'moderate': 0.20, 'severe': 0.45}   # ICAO Annex 3 Amdt 79, medium aircraft (plan §1b)
COLORS = {'light': (255, 214, 10, 110), 'moderate': (255, 149, 0, 170), 'severe': (255, 45, 85, 210)}
UA = {'User-Agent': 'andes-crossing-wafs/0.1 (scheduled fetch, 4 runs a day)'}
BASE = 'https://nomads.ncep.noaa.gov/pub/data/nccf/com'
PATTERNS = [
    BASE + '/wafs/prod/wafs.{d}/{h}/grib2/0p25/blending/WAFS_0p25_blended_{d}{h}f{f:02d}.grib2',
    BASE + '/gfs/prod/gfs.{d}/{h}/atmos/gfs.t{h}z.awf_0p25.f{f:03d}.grib2',
]

def fetch(run, f):
    d, h = run.strftime('%Y%m%d'), run.strftime('%H')
    for p in PATTERNS:
        url = p.format(d=d, h=h, f=f)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return url, r.read()
        except Exception as e:
            print('  miss', url, e, file=sys.stderr)
    return None, None

def latest_run(now):
    run = now.replace(minute=0, second=0, microsecond=0) - dt.timedelta(hours=5)   # files land ~4-5 h after the run
    return run.replace(hour=run.hour - run.hour % 6)

def edr_fields(blob):
    """Yields (flight_level, 2-D numpy array, lats, lons) for each EDR message (max EDR preferred over mean)."""
    import eccodes, numpy as np
    seen = {}
    with io.BytesIO(blob) as fh:
        tmp = '/tmp/wafs.grib2'; open(tmp, 'wb').write(fh.read())
    with open(tmp, 'rb') as g:
        while True:
            m = eccodes.codes_grib_new_from_file(g)
            if m is None: break
            try:
                cat, num = eccodes.codes_get(m, 'parameterCategory'), eccodes.codes_get(m, 'parameterNumber')
                if not (cat == 19 and num == 30):            # 0-19-30: eddy dissipation parameter
                    continue
                stat = eccodes.codes_get(m, 'typeOfStatisticalProcessing') if eccodes.codes_is_defined(m, 'typeOfStatisticalProcessing') else -1
                lvl_pa = eccodes.codes_get(m, 'level') * (100 if eccodes.codes_get(m, 'typeOfLevel') == 'isobaricInhPa' else 1)
                fl = pa_to_fl(lvl_pa)
                ni, nj = eccodes.codes_get(m, 'Ni'), eccodes.codes_get(m, 'Nj')
                vals = eccodes.codes_get_values(m).reshape(nj, ni)
                lats = eccodes.codes_get_array(m, 'distinctLatitudes'); lons = eccodes.codes_get_array(m, 'distinctLongitudes')
                key = fl
                if key in seen and seen[key][0] == 2:       # keep the maximum (stat 2) when both are present
                    continue
                seen[key] = (stat, vals, lats, lons)
            finally:
                eccodes.codes_release(m)
    for fl, (stat, vals, lats, lons) in sorted(seen.items()):
        yield fl, vals, lats, lons

def pa_to_fl(pa):
    # ICAO standard atmosphere, pressure (Pa) → flight level (hundreds of ft)
    h_m = 44330.77 * (1 - (pa / 101325.0) ** 0.190263)
    return int(round(h_m / 0.3048 / 100 / 10) * 10)

def crop(vals, lats, lons):
    import numpy as np
    lons = ((lons + 180) % 360) - 180
    order = np.argsort(lons); lons = lons[order]; vals = vals[:, order]
    if lats[0] < lats[-1]: lats = lats[::-1]; vals = vals[::-1, :]
    jj = (lats >= BBOX[1]) & (lats <= BBOX[3]); ii = (lons >= BBOX[0]) & (lons <= BBOX[2])
    return vals[np.ix_(jj, ii)], lats[jj], lons[ii]

def to_png(vals, path):
    import numpy as np
    from PIL import Image
    rgba = np.zeros(vals.shape + (4,), dtype=np.uint8)
    for k in ('light', 'moderate', 'severe'):
        rgba[vals >= THRESH[k]] = COLORS[k]
    Image.fromarray(rgba, 'RGBA').save(path, optimize=True)

def onset(vals, lats, lons):
    import numpy as np, contourpy
    gen = contourpy.contour_generator(x=lons, y=lats, z=np.nan_to_num(vals, nan=0.0))
    feats = []
    for k in ('moderate', 'severe'):
        for line in gen.lines(THRESH[k]):
            if len(line) < 4: continue
            feats.append({'type': 'Feature', 'properties': {'cat': k, 'edr': THRESH[k]},
                          'geometry': {'type': 'LineString', 'coordinates': [[round(float(x), 3), round(float(y), 3)] for x, y in line]}})
    return {'type': 'FeatureCollection', 'features': feats}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--run'); ap.add_argument('--hours', default='6,9,12,15,18,21,24,27,30,33,36')
    a = ap.parse_args()
    run = dt.datetime.strptime(a.run, '%Y%m%d%H') if a.run else latest_run(dt.datetime.utcnow())
    out = os.path.join(a.out, 'wafs'); os.makedirs(out, exist_ok=True)
    index = {'run': run.strftime('%Y-%m-%dT%H:00Z'), 'bbox': BBOX, 'thresholds': THRESH, 'steps': [], 'source': 'NOAA WAFS 0.25 deg (NOMADS)'}
    for f in [int(x) for x in a.hours.split(',')]:
        url, blob = fetch(run, f)
        if not blob: continue
        levels = []
        for fl, vals, lats, lons in edr_fields(blob):
            v, la, lo = crop(vals, lats, lons)
            to_png(v, os.path.join(out, f'edr-FL{fl:03d}-f{f:02d}.png'))
            json.dump(onset(v, la, lo), open(os.path.join(out, f'onset-FL{fl:03d}-f{f:02d}.json'), 'w'), separators=(',', ':'))
            levels.append(fl)
        index['steps'].append({'f': f, 'valid': (run + dt.timedelta(hours=f)).strftime('%Y-%m-%dT%H:00Z'), 'levels': levels, 'file': url.rsplit('/', 1)[-1]})
        print('f%02d' % f, 'levels', levels)
    if not index['steps']: sys.exit('no WAFS file found for run ' + index['run'])
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
