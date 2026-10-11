"""Paint liveries onto FlightGear textures by projecting artwork onto the model surface.
All positions are in the AC frame: x aft (m), y up (m), z left (m)."""
import math, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import ac2glb

FONT = None
def font(px, weight=700):
    import os
    base = os.path.join(os.path.dirname(__file__), '..', 'fontpkg', 'package', 'files', f'montserrat-latin-{weight}-normal.woff')
    try: return ImageFont.truetype(base, px)
    except Exception: return ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', px)

RAMP = ['#F4A53C', '#E07B24', '#9A5426', '#4A2A17']
def ramp(t):
    f = t * (len(RAMP) - 1); i = min(len(RAMP) - 2, int(f)); k = f - i
    a = [int(RAMP[i][j:j + 2], 16) for j in (1, 3, 5)]; b = [int(RAMP[i + 1][j:j + 2], 16) for j in (1, 3, 5)]
    return tuple(int(a[c] + (b[c] - a[c]) * k) for c in range(3)) + (255,)
def sunburst(size, n=11, open_side='left'):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx = cy = size / 2; r1, r2 = size * 0.2, size * 0.47
    start = -math.pi * 0.62 if open_side == 'left' else -math.pi * 0.38; sweep = math.pi * 1.55 * (1 if open_side == 'left' else -1)
    for i in range(n):
        t = i / (n - 1); a0 = start + sweep * (i / n); a1 = a0 + sweep / n * 0.6
        ro = r2 * (0.86 + 0.14 * math.sin(i * 2.3 + 0.7)); ri = r1 * (0.92 + 0.1 * math.cos(i * 1.7))
        pts = [(cx + math.cos(a0) * ri, cy + math.sin(a0) * ri), (cx + math.cos(a0) * ro, cy + math.sin(a0) * ro), (cx + math.cos(a1) * ro, cy + math.sin(a1) * ro), (cx + math.cos(a1) * ri, cy + math.sin(a1) * ri)]
        d.polygon(pts, fill=ramp(t))
    return im
def wordmark(h=400, parts=(('SOLID', '#E07B24'), ('AIRE', '#6B3A1E'))):
    f = font(int(h * 0.62)); tmp = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    tw = sum(tmp.textlength(t, font=f) for t, _ in parts); icon = int(h * 0.95)
    W = int(icon + h * 0.12 + tw + h * 0.1); im = Image.new('RGBA', (W, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    im.alpha_composite(sunburst(icon), (0, int((h - icon) / 2)))
    x = icon + h * 0.12
    for t, c in parts: d.text((x, h * 0.52), t, font=f, fill=c, anchor='lm'); x += d.textlength(t, font=f)
    return im
def text_img(txt, h=200, color='#2b2f36', weight=600):
    f = font(int(h * 0.8), weight); tmp = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    W = int(tmp.textlength(txt, font=f) + h * 0.2); im = Image.new('RGBA', (W, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((W / 2, h * 0.52), txt, font=f, fill=color, anchor='mm'); return im
def solid(color, w=64, h=64): return Image.new('RGBA', (w, h), color)

class Painter:
    def __init__(self, ac_items, texname, img, exclude=None):
        """ac_items: list of paths or (path, offset); texname: texture basename (after overrides) to paint"""
        self.img = np.array(img.convert('RGBA')).astype(np.float32); self.H, self.W = self.img.shape[:2]
        self.tris = []
        for it in ac_items:
            path, off = it if isinstance(it, tuple) else (it, None)
            mats, roots = ac2glb.parse_ac(path); fl = []
            for r in roots: ac2glb.flatten(r, out=fl)
            for o in fl:
                if exclude and re.search(exclude, o['name'], re.I): continue
                tex = o['texture']
                if tex is None or not (tex == texname or (isinstance(texname, (set, tuple, list)) and tex in texname)): continue
                idx, uv, sm, mi, ds = ac2glb.tris_of(o, mats)
                if not len(idx): continue
                v = o['v'] + (np.array(off) if off is not None else 0)
                self.tris.append((o['name'], v[idx], uv))
    def bounds(self, rx):
        ps = [p for n, p, _ in self.tris if re.search(rx, n, re.I)]
        if not ps: return None
        a = np.concatenate([p.reshape(-1, 3) for p in ps]); return a.min(0), a.max(0)
    def _raster(self, P, UV, fn):
        px = np.stack([UV[:, 0] * self.W, (1 - UV[:, 1]) * self.H], 1)
        x0, y0 = np.floor(px.min(0)).astype(int); x1, y1 = np.ceil(px.max(0)).astype(int)
        x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, self.W - 1); y1 = min(y1, self.H - 1)
        if x1 < x0 or y1 < y0: return
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = px; v0, v1 = b - a, c - a; den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-9: return
        wx, wy = gx - a[0], gy - a[1]
        l1 = (wx * v1[1] - v1[0] * wy) / den; l2 = (v0[0] * wy - wx * v0[1]) / den; l0 = 1 - l1 - l2
        m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not m.any(): return
        pos = l0[m, None] * P[0] + l1[m, None] * P[1] + l2[m, None] * P[2]
        fn(gy[m].astype(int), gx[m].astype(int), pos)
    def fill(self, rx, color, side=None, region=None):
        col = np.array(color, np.float32)
        for n, Ps, UVs in self.tris:
            if not re.search(rx, n, re.I): continue
            for P, UV in zip(Ps, UVs):
                if side is not None:
                    nrm = np.cross(P[1] - P[0], P[2] - P[0]); l = np.linalg.norm(nrm)
                    if l < 1e-12 or nrm[2] / l * side < 0.2: continue
                def f(r, c, pos):
                    if region is not None:
                        (xa, xb), (ya, yb) = region; k = (pos[:, 0] >= xa) & (pos[:, 0] <= xb) & (pos[:, 1] >= ya) & (pos[:, 1] <= yb)
                        r, c = r[k], c[k]
                    self.img[r, c, :3] = col[:3]
                self._raster(P, UV, f)
    def recolor(self, pred, color=(244, 244, 242)):
        rgb = self.img[:, :, :3] / 255.0; mx = rgb.max(2); mn = rgb.min(2); sat = (mx - mn) / np.maximum(mx, 1e-6)
        m = pred(rgb, sat, mx)
        shade = 0.93 + 0.07 * np.clip(mx, 0, 1)
        for k in range(3): self.img[:, :, k] = np.where(m, color[k] * shade, self.img[:, :, k])
    def decal(self, art, rx, cx, cy, w, h, side, min_dot=0.25, mirror_on_right=True):
        """project art (PIL RGBA) onto surfaces of objects matching rx, centred at (x=cx aft, y=cy up), w x h metres, on side +1 (left, z>0) or -1 (right)"""
        A = np.array(art.convert('RGBA')).astype(np.float32); ah, aw = A.shape[:2]
        for n, Ps, UVs in self.tris:
            if not re.search(rx, n, re.I): continue
            for P, UV in zip(Ps, UVs):
                if P[:, 0].max() < cx - w / 2 or P[:, 0].min() > cx + w / 2 or P[:, 1].max() < cy - h / 2 or P[:, 1].min() > cy + h / 2: continue
                nrm = np.cross(P[1] - P[0], P[2] - P[0]); l = np.linalg.norm(nrm)
                if l < 1e-12 or nrm[2] / l * side < min_dot: continue
                def f(r, c, pos):
                    s = (pos[:, 0] - (cx - w / 2)) / w if side > 0 else ((cx + w / 2) - pos[:, 0]) / w
                    t = ((cy + h / 2) - pos[:, 1]) / h
                    k = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
                    if not k.any(): return
                    sx = np.clip((s[k] * aw).astype(int), 0, aw - 1); sy = np.clip((t[k] * ah).astype(int), 0, ah - 1)
                    src = A[sy, sx]; al = src[:, 3:4] / 255.0; rr, cc = r[k], c[k]
                    self.img[rr, cc, :3] = self.img[rr, cc, :3] * (1 - al) + src[:, :3] * al
                self._raster(P, UV, f)
    def image(self): return Image.fromarray(np.clip(self.img, 0, 255).astype(np.uint8), 'RGBA')
