#!/usr/bin/env python3
"""Builds web/data/crest.json: the Andes crest from terrain, Venezuela to Tierra del Fuego (11°N to 55°S).
Source: AWS Terrarium elevation tiles (Mapzen, open data), zoom 6 (~2.4 km per pixel).
Method: for each 0.25° of latitude, the longitude of the highest smoothed terrain between 82°W and 60°W, then a median
filter so the line does not jump between parallel cordilleras. Each point keeps the crest elevation (m).
Where the range splits (Colombia's three cordilleras, the Bolivian altiplano), the line follows the highest one.
Usage: python3 build_crest_dem.py <cache dir> <out file>"""
import io, json, math, os, sys, urllib.request
from statistics import median
from PIL import Image

Z, LON0, LON1, LAT_N, LAT_S, STEP = 6, -82.0, -60.0, 11.0, -55.0, 0.25
cache, out = sys.argv[1:3]; os.makedirs(cache, exist_ok=True)
tiles = {}
def tile(x, y):
    if (x, y) not in tiles:
        p = os.path.join(cache, f'{Z}-{x}-{y}.png')
        if not os.path.exists(p):
            with urllib.request.urlopen(f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{Z}/{x}/{y}.png', timeout=60) as r:
                open(p, 'wb').write(r.read())
        tiles[(x, y)] = Image.open(p).convert('RGB').load()
    return tiles[(x, y)]
def elev(lon, lat):
    n = 2 ** Z; fx = (lon + 180) / 360 * n
    fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    x, y = int(fx), int(fy); px, py = int((fx - x) * 256), int((fy - y) * 256)
    r, g, b = tile(x, y)[px, py]
    return r * 256 + g + b / 256 - 32768
pts = []
lat = LAT_N
while lat >= LAT_S:
    lons = [LON0 + i * 0.02 for i in range(int((LON1 - LON0) / 0.02) + 1)]
    row = [max(0.0, elev(lo, lat)) for lo in lons]
    sm = [sum(row[max(0, i - 3):i + 4]) / len(row[max(0, i - 3):i + 4]) for i in range(len(row))]   # ~15 km smoothing
    i = max(range(len(sm)), key=sm.__getitem__)
    pts.append([lons[i], lat, row[i]])
    lat = round(lat - STEP, 4)
lon_f = [median([p[0] for p in pts[max(0, k - 3):k + 4]]) for k in range(len(pts))]   # 7-point median: no jumps
coords = [[round(lon_f[k], 3), pts[k][1]] for k in range(len(pts))]
elev_m = [int(round(max(elev(lon_f[k] + d, pts[k][1]) for d in (-0.06, -0.03, 0, 0.03, 0.06)))) for k in range(len(pts))]
json.dump({'type': 'Feature', 'properties': {'name': 'Andes crest', 'source': 'AWS Terrarium z6, highest smoothed terrain per 0.25° of latitude',
           'elev_m': elev_m}, 'geometry': {'type': 'LineString', 'coordinates': coords}}, open(out, 'w'), separators=(',', ':'))
print('points', len(coords), 'tiles', len(tiles), 'max elev', max(elev_m), 'at', coords[elev_m.index(max(elev_m))])
for la in (10, 4.5, -2, -12, -16.5, -23, -32.65, -41, -50, -54):
    k = min(range(len(coords)), key=lambda j: abs(coords[j][1] - la)); print(' ', coords[k], elev_m[k], 'm')
