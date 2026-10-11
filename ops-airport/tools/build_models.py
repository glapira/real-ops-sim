"""Build the ops room's GLB models from FlightGear (GPL) sources, with the Solidaire livery painted on."""
import os, sys, re
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import ac2glb, paint

SCR = os.path.join(os.path.dirname(__file__), '..')
FG = os.path.join(SCR, 'fg')
B787 = '/home/user/iskenderwang/787-family/Models'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SCR, 'glb')
ONLY = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
WHITE = (244, 244, 242)
def fg2ac(x, y, z): return (x, z, -y)

def body_frame(p, rx):
    # length from the whole fuselage; radius and centre height from a slice in the middle (no fin, no fairings)
    pts = np.concatenate([P.reshape(-1, 3) for n, P, _ in p.tris if re.search(rx, n, re.I)])
    x0, x1 = pts[:, 0].min(), pts[:, 0].max(); L = x1 - x0
    mid = pts[np.abs(pts[:, 0] - (x0 + L * 0.3)) < L * 0.04]
    R = np.abs(mid[:, 2]).max(); cy = (mid[:, 1].min() + mid[:, 1].max()) / 2
    return x0, L, cy, R

def put_marks(p, fus_rx, fin_rx, *, word=None, reg=None, logo=True, word_at=0.2, word_h=0.5, word_y=0.5, reg_at=0.84, reg_h=0.22, reg_y=0.42, logo_k=0.62, logo_dx=0.0, logo_dy=0.0):
    nose, L, cy, R = body_frame(p, fus_rx)
    print('   frame nose %.2f len %.2f cy %.2f R %.2f' % (nose, L, cy, R))
    for side in (1, -1):
        if word:
            art = paint.wordmark(400); h = R * word_h; w = h * art.width / art.height
            p.decal(art, fus_rx, nose + L * word_at, cy + R * word_y, w, h, side)
        if reg:
            art = paint.text_img(reg, 200); h = R * reg_h; w = h * art.width / art.height
            p.decal(art, fus_rx, nose + L * reg_at, cy + R * reg_y, w, h, side)
        if logo and fin_rx:
            fmn, fmx = p.bounds(fin_rx); fh = fmx[1] - fmn[1]; size = fh * logo_k
            fx = (fmn[0] + fmx[0]) / 2 + logo_dx * fh; fy = fmn[1] + fh * 0.5 + logo_dy * fh
            p.decal(paint.sunburst(600, 11, 'left' if side > 0 else 'right'), fin_rx, fx, fy, size, size, side, min_dot=0.5)

def neutral(rgb, m):
    mx, mn = max(rgb), min(rgb); sat = (mx - mn) / max(mx, 1e-6)
    if sat > 0.3 and rgb[1] >= rgb[0] and rgb[1] >= rgb[2]: return [0.74, 0.75, 0.77]      # primer green -> grey
    return rgb

def tex_painter(items, texnames, src, exclude=None):
    return paint.Painter(items, texnames, Image.open(src), exclude=exclude)

def run(name): return ONLY is None or name in ONLY

# ---------------------------------------------------------------- 787-8
if run('b787'):
    items = [os.path.join(B787, '787-8.ac'), os.path.join(B787, 'GEnx.ac')]
    ex = r'windows-dim|wiper|/[lr]hfans$|/[lr]hfan$|GEnx\.ac/wing$|lights|beacon|tlight|navlite|landlt|lltcover|logolts|strobe'
    p = tex_painter(items, {'787-8.png', '787-10.png'}, os.path.join(B787, '787-8.png'), exclude=ex)
    put_marks(p, r'/fuselage$', r'/fin$|/rudder$', word=True, reg='P4-787', word_at=0.205, word_h=0.42, word_y=0.56, reg_at=0.845, reg_h=0.17, reg_y=0.5, logo_k=0.58, logo_dx=0.08, logo_dy=0.02)
    painted = p.image()
    ac2glb.convert(items, os.path.join(OUT, 'b787.glb'), exclude=ex, decimate=[(r'NGear$|Wheel|GearBaseRod|RGear|Compressor', 0.65), (r'cone$', 0.6)], tint=neutral, keep_alpha=lambda t: False, tex_override={'787-10.png': '787-8.png', 'GEnx.png': 'Liveries-engines/GEnx.png'},
                   tex_paint={'787-8.png': lambda im: painted}, tex_max=4096, report=False)

# ---------------------------------------------------------------- Dornier 228 NXT (FlightGear do228 by D-ECHO)
if run('do228'):
    D = os.path.join(FG, 'do228/Models')
    items = [os.path.join(D, 'do228.ac')]
    ex = r'interior|seats|panel|\.int|placard|pedestal|Cube|prop_disc|handrail|pilot|signs|yoke|lever|switch|knob|instrument|screen'
    p = tex_painter(items, 'do228.png', os.path.join(D, 'do228.png'), exclude=ex)
    p.recolor(lambda rgb, sat, mx: (sat > 0.22) & (mx > 0.12))
    fm = p.mask(r'/fuselage$') if hasattr(p, 'mask') else None
    p.fill(r'/vstab$|/rudder$', WHITE)
    # strip the old titles and registration from the fuselage sides (dark lettering)
    nose, L, cy, R = body_frame(p, r'/fuselage$')
    for side in (1, -1):
        p.decal(paint.solid(WHITE + (255,)), r'/fuselage$', nose + L * 0.55, cy - R * 0.45, L * 0.5, R * 0.55, side)
        p.decal(paint.solid(WHITE + (255,)), r'/fuselage$', nose + L * 0.8, cy + R * 0.25, L * 0.32, R * 1.1, side)
    put_marks(p, r'/fuselage$', r'/vstab$|/rudder$', word=True, reg='DO228NXT', word_at=0.25, word_h=0.42, word_y=-0.32, reg_at=0.8, reg_h=0.3, reg_y=0.25, logo_k=0.6, logo_dx=0.22, logo_dy=0.1)
    painted = p.image()
    ac2glb.convert(items, os.path.join(OUT, 'do228.glb'), exclude=ex, keep_alpha=lambda t: 'prop_disc' in t, decimate=[(r'wheel|prop\.|spinner', 0.7)], tex_paint={'do228.png': lambda im: painted}, tex_max=2048, report=False)

# ---------------------------------------------------------------- A320 for work flights
if run('a320'):
    R_ = os.path.join(FG, 'A320-family/Models/Fuselage/res')
    items = [os.path.join(R_, 'A320-216.ac'), os.path.join(R_, 'CFM56.ac')]
    ex = r'Inner|Actuator|Cables|Mechanism|NurbsPath|/Rat$|Placards|Static-Elements|Cargo\d\.Inner|Light|Beacon|Strobe|Cockpit|Seat|Wiper'
    p = tex_painter(items, 'Fuse-Main.png', os.path.join(R_, 'Fuse-Main.png'), exclude=ex)
    p.recolor(lambda rgb, sat, mx: (sat > 0.12) & (mx > 0.15))
    nose, L, cy, R = body_frame(p, r'/Fuselage$')
    # the fin is part of the fuselage mesh: paint everything above the cabin crown at the tail white, then put the mark on it
    p.fill(r'/Fuselage$|/Rudder$', WHITE, region=((nose + L * 0.7, nose + L * 1.05), (cy + R * 1.05, cy + R * 10)))
    fin = np.concatenate([P.reshape(-1, 3) for n, P, _ in p.tris if re.search(r'/Fuselage$|/Rudder$', n)]); fin = fin[fin[:, 1] > cy + R * 1.2]
    fmn, fmx = fin.min(0), fin.max(0); fh = fmx[1] - fmn[1]
    for side in (1, -1): p.decal(paint.sunburst(600, 11, 'left' if side > 0 else 'right'), r'/Fuselage$|/Rudder$', (fmn[0] + fmx[0]) / 2 + fh * 0.1, fmn[1] + fh * 0.48, fh * 0.6, fh * 0.6, side, min_dot=0.5)
    put_marks(p, r'/Fuselage$', None, word=True, reg=None, logo=False, word_at=0.22, word_h=0.42, word_y=0.55)
    painted = p.image()
    ac2glb.convert(items, os.path.join(OUT, 'a320.glb'), exclude=ex + r'|WingtipFence', decimate=[(r'Wheels|Fitting|SlidingTube|Torque|Slave|Lock|Stay|Fan', 0.75), (r'Sharklet', 0.6)], tint=neutral, keep_alpha=lambda t: False, tex_paint={'Fuse-Main.png': lambda im: painted}, tex_max=2048, report=True)

# ---------------------------------------------------------------- Global 8000 stand-in: Bombardier CRJ700 airframe, plain white
if run('global'):
    C = os.path.join(FG, 'CRJ700-family/Models')
    items = [os.path.join(C, 'CRJ700.ac'),
             (os.path.join(C, 'CRJ700-engine.ac'), fg2ac(6.796, -2.27, -0.31)), (os.path.join(C, 'CRJ700-engine.ac'), fg2ac(6.796, 2.27, -0.31)),
             (os.path.join(C, 'CRJ700-nosegear.ac'), fg2ac(-14.232, 0, -3.201)), (os.path.join(C, 'CRJ700-maingear.ac'), fg2ac(0.986, 0, -3.357))]
    ex = r'StairHandles|Int$|CargoRoom|Pitot|Interior|LandingLts|RATBlades|Wires|Cockpit(?!Frame)'
    p = tex_painter(items, 'CRJ700-Blank.png', os.path.join(C, 'CRJ700-Blank.png'), exclude=ex)
    put_marks(p, r'/Fuselage\.001$', None, word=False, reg='P4-8000', logo=False, reg_at=0.72, reg_h=0.26, reg_y=0.15)
    painted = p.image()
    ac2glb.convert(items, os.path.join(OUT, 'global.glb'), exclude=ex, decimate=[(r'gear|wheel|strut', 0.7)], tint=neutral, keep_alpha=lambda t: False, tex_paint={'CRJ700-Blank.png': lambda im: painted}, tex_max=2048, report=False)

# ---------------------------------------------------------------- ground equipment
if run('ground'):
    G = os.path.join(B787, 'Ground/Services')
    for nm, path, ex in [('fuel', 'Fuel-Truck/Fuel_Truck_Short_VolvoFM.ac', None), ('cater', 'Catering/Catering_Loader_Truck_VolvoFM-stowed.ac', None),
                         ('stairs', 'Stairs/stairs.ac', None), ('deice', 'De-Icing/volvo_deicing_truck.ac', None), ('gpu', 'External-Power/ext-pwr-box.ac', None),
                         ('belt', 'Baggage/cargo_ramp.ac', None)]:
        try: ac2glb.convert([os.path.join(G, path)], os.path.join(OUT, nm + '.glb'), exclude=ex, tex_max=1024, report=False)
        except Exception as e: print('skip', nm, e)
    ac2glb.convert([os.path.join(FG, 'pushback/Models/pushback.ac')], os.path.join(OUT, 'tug.glb'), exclude=r'pilot|speedometer|gauge|flashlight', tex_max=1024, report=False)
    ac2glb.convert([os.path.join(FG, 'followme/Models/followme.ac')], os.path.join(OUT, 'followme.glb'), exclude=r'interior|Messages', tex_max=1024, report=False)
