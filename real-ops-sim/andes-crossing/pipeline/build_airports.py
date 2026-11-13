#!/usr/bin/env python3
"""Builds web/data/airports.json and web/data/navaids.json from OurAirports (public domain).
Usage: python3 build_airports.py <airports.csv> <navaids.csv> <out dir>
Airports keep three ranks: 1 hub (large), 2 main (medium with scheduled service), 3 secondary
(other medium aerodromes with an ICAO code in Argentina and Chile, the two sides of the crossing)."""
import csv, json, sys

SA = {'AR', 'CL', 'PE', 'BO', 'UY', 'PY', 'BR', 'EC', 'CO', 'VE', 'GY', 'SR', 'GF', 'FK'}
ANDES = {'AR', 'CL', 'PE', 'BO'}
air_csv, nav_csv, out = sys.argv[1:4]

def num(v):
    try: return float(v)
    except ValueError: return None

feats = []
for r in csv.DictReader(open(air_csv, encoding='utf-8')):
    c = r['iso_country']
    if c not in SA or r['type'] not in ('large_airport', 'medium_airport'): continue
    icao = r.get('icao_code') or (r['ident'] if len(r['ident']) == 4 and r['ident'].isalpha() else '')
    if not icao: continue
    sched = r['scheduled_service'] == 'yes'
    rank = 1 if r['type'] == 'large_airport' else 2 if sched else 3
    if rank == 3 and c not in ('AR', 'CL'): continue
    if c == 'BR' and rank == 3: continue
    lat, lon = num(r['latitude_deg']), num(r['longitude_deg'])
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 4), round(lat, 4)]},
                  'properties': {'icao': icao, 'iata': r['iata_code'], 'name': r['name'], 'city': r['municipality'],
                                 'country': c, 'elev_ft': int(num(r['elevation_ft']) or 0), 'rank': rank,
                                 'andes': c in ANDES}})
feats.sort(key=lambda f: (f['properties']['rank'], f['properties']['icao']))
json.dump({'type': 'FeatureCollection', 'source': 'OurAirports (public domain)', 'features': feats},
          open(out + '/airports.json', 'w'), separators=(',', ':'))

navs = []
for r in csv.DictReader(open(nav_csv, encoding='utf-8')):
    if r['iso_country'] not in ANDES | {'UY', 'PY'} or r['type'] not in ('VOR', 'VOR-DME', 'VORTAC', 'TACAN'): continue
    lat, lon = num(r['latitude_deg']), num(r['longitude_deg'])
    if lat is None: continue
    navs.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 4), round(lat, 4)]},
                 'properties': {'ident': r['ident'], 'name': r['name'], 'type': r['type'], 'freq_khz': r['frequency_khz'],
                                'country': r['iso_country'], 'elev_ft': int(num(r['elevation_ft']) or 0)}})
json.dump({'type': 'FeatureCollection', 'source': 'OurAirports (public domain)', 'features': navs},
          open(out + '/navaids.json', 'w'), separators=(',', ':'))
print('airports', len(feats), 'by rank', {k: sum(1 for f in feats if f['properties']['rank'] == k) for k in (1, 2, 3)}, 'navaids', len(navs))
