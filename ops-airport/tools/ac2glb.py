"""AC3D (.ac, as used by FlightGear) -> compact GLB for the ops room.

- applies the object hierarchy (loc/rot), texrep/texoff
- triangulates polygons, drops line surfaces
- smooth normals per object with a crease angle (flat for unshaded surfaces)
- groups triangles by (texture, material, double-sided), dedupes vertices
- converts AC frame (x aft, y up, z left) to three.js (x left, y up, z forward), scales, puts wheels on y=0
- embeds textures as JPEG/PNG, optionally resized
"""
import json, math, os, re, struct, io, sys
import numpy as np
from PIL import Image

def parse_ac(path):
    with open(path, 'r', encoding='latin-1') as f:
        toks = f.read().splitlines()
    i = 0
    assert toks[0].startswith('AC3D'), path
    i = 1
    mats = []
    def obj_parse():
        nonlocal i
        head = toks[i].split(); i += 1
        o = {'type': head[1], 'name': '', 'texture': None, 'texrep': (1.0, 1.0), 'texoff': (0.0, 0.0), 'rot': None, 'loc': (0.0, 0.0, 0.0), 'verts': None, 'surfs': [], 'kids': [], 'crease': 61.0}
        while i < len(toks):
            line = toks[i].strip()
            if not line: i += 1; continue
            key = line.split()[0]
            if key == 'name': o['name'] = line[5:].strip().strip('"'); i += 1
            elif key == 'data':
                n = int(line.split()[1]); i += 1
                # data block can span lines; consume characters
                consumed = 0
                while consumed < n and i < len(toks):
                    consumed += len(toks[i]) + 1; i += 1
            elif key == 'texture': o['texture'] = line[8:].strip().strip('"'); i += 1
            elif key == 'texrep': p = line.split(); o['texrep'] = (float(p[1]), float(p[2])); i += 1
            elif key == 'texoff': p = line.split(); o['texoff'] = (float(p[1]), float(p[2])); i += 1
            elif key == 'rot': p = list(map(float, line.split()[1:10])); o['rot'] = np.array(p).reshape(3, 3); i += 1
            elif key == 'loc': p = line.split(); o['loc'] = (float(p[1]), float(p[2]), float(p[3])); i += 1
            elif key == 'crease': o['crease'] = float(line.split()[1]); i += 1
            elif key in ('url', 'subdiv', 'hidden', 'locked', 'folded'): i += 1
            elif key == 'numvert':
                n = int(line.split()[1]); i += 1
                v = np.array([list(map(float, toks[i + k].split()[:3])) for k in range(n)], dtype=np.float64) if n else np.zeros((0, 3))
                o['verts'] = v; i += n
            elif key == 'numsurf':
                n = int(line.split()[1]); i += 1
                for _ in range(n):
                    flags = int(toks[i].split()[1], 0); i += 1
                    mat = 0
                    if toks[i].strip().startswith('mat'): mat = int(toks[i].split()[1]); i += 1
                    nr = int(toks[i].split()[1]); i += 1
                    refs = []
                    for k in range(nr):
                        p = toks[i + k].split(); refs.append((int(p[0]), float(p[1]) if len(p) > 1 else 0.0, float(p[2]) if len(p) > 2 else 0.0))
                    i += nr
                    o['surfs'].append((flags, mat, refs))
            elif key == 'kids':
                n = int(line.split()[1]); i += 1
                for _ in range(n): o['kids'].append(obj_parse())
                return o
            else: i += 1
        return o
    roots = []
    while i < len(toks):
        line = toks[i]
        if line.startswith('MATERIAL'):
            m = re.match(r'MATERIAL\s+"?(.*?)"?\s+rgb\s+(\S+)\s+(\S+)\s+(\S+)\s+amb\s+(\S+)\s+(\S+)\s+(\S+)\s+emis\s+(\S+)\s+(\S+)\s+(\S+)\s+spec\s+(\S+)\s+(\S+)\s+(\S+)\s+shi\s+(\S+)\s+trans\s+(\S+)', line)
            if m:
                g = m.groups(); mats.append({'name': g[0], 'rgb': tuple(map(float, g[1:4])), 'emis': tuple(map(float, g[7:10])), 'spec': tuple(map(float, g[10:13])), 'shi': float(g[13]), 'trans': float(g[14])})
            else: mats.append({'name': 'm', 'rgb': (0.8, 0.8, 0.8), 'emis': (0, 0, 0), 'spec': (0, 0, 0), 'shi': 10, 'trans': 0})
            i += 1
        elif line.startswith('OBJECT'): roots.append(obj_parse())
        else: i += 1
    return mats, roots

def flatten(o, M=np.eye(4), path='', out=None):
    if out is None: out = []
    L = np.eye(4)
    if o['rot'] is not None: L[:3, :3] = o['rot']
    L[:3, 3] = o['loc']
    W = M @ L
    name = (path + '/' + o['name']) if o['name'] else path
    if o['verts'] is not None and len(o['surfs']):
        v = o['verts'] @ W[:3, :3].T + W[:3, 3]
        out.append({'name': name, 'leaf': o['name'], 'v': v, 'surfs': o['surfs'], 'texture': o['texture'], 'texrep': o['texrep'], 'texoff': o['texoff'], 'crease': o['crease']})
    for k in o['kids']: flatten(k, W, name, out)
    return out

def tris_of(obj, mats):
    """yield per-surface triangles with per-corner uv and smooth flag"""
    v = obj['v']; tr, to = obj['texrep'], obj['texoff']
    P, UV, F, S, MI, DS = [], [], [], [], [], []
    for flags, mat, refs in obj['surfs']:
        st = flags & 0xF
        if st != 0 or len(refs) < 3: continue
        for k in range(1, len(refs) - 1):
            tri = (refs[0], refs[k], refs[k + 1])
            P.append([t[0] for t in tri]); UV.append([(t[1] * tr[0] + to[0], t[2] * tr[1] + to[1]) for t in tri])
            S.append(bool(flags & 0x10)); MI.append(mat); DS.append(bool(flags & 0x20))
    return np.array(P, dtype=np.int64).reshape(-1, 3), np.array(UV, dtype=np.float64).reshape(-1, 3, 2), np.array(S), np.array(MI), np.array(DS)

def smooth_normals(v, idx, smooth, crease_deg):
    a, b, c = v[idx[:, 0]], v[idx[:, 1]], v[idx[:, 2]]
    fn = np.cross(b - a, c - a); area = np.linalg.norm(fn, axis=1, keepdims=True); fnu = fn / np.maximum(area, 1e-12)
    out = np.repeat(fnu[:, None, :], 3, axis=1).copy()
    if not smooth.any(): return out
    cos_c = math.cos(math.radians(min(max(crease_deg, 1), 179)))
    # vertex -> faces (only smooth faces); also weld coincident vertices by position
    keyv = np.round(v * 1e4).astype(np.int64)
    _, weld = np.unique(keyv, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    vid = weld[idx]
    from collections import defaultdict
    adj = defaultdict(list)
    for f in np.nonzero(smooth)[0]:
        for k in range(3): adj[vid[f, k]].append(f)
    for f in np.nonzero(smooth)[0]:
        for k in range(3):
            fs = adj[vid[f, k]]
            if len(fs) == 1: continue
            fsa = np.array(fs); d = fnu[fsa] @ fnu[f]
            sel = fsa[d > cos_c]
            n = fn[sel].sum(axis=0); l = np.linalg.norm(n)
            if l > 1e-12: out[f, k] = n / l
    return out

AC2THREE = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], dtype=np.float64)   # (x aft, y up, z left) -> (x left, y up, z fwd)

def convert(ac_paths, out_path, *, scale=0.335, exclude=None, include=None, tex_dir=None, tex_max=2048, tex_override=None, tex_paint=None,
            ground=True, center=True, extra_rot=None, jpeg_quality=86, report=True, keep_alpha=None, decimate=None, offsets=None, tint=None,
            gear_rx=r'gear|wheel|strut|tyre|tire|NLG|MLG|compressor|torque|axle|bogie', cabin_rx=r'windows-bright', glass_rx=r'/Window$|/Windows$|windshield|windsheild|/windows$|windows\.front|canopy|glass', ground_ignore=None):
    mats_all, objs = [], []
    items = ac_paths if isinstance(ac_paths, list) else [ac_paths]
    for k, it in enumerate(items):
        p, off_item = (it if isinstance(it, tuple) else (it, None))
        mats, roots = parse_ac(p)
        base = len(mats_all); mats_all += mats
        fl = []
        for r in roots: flatten(r, out=fl)
        off = off_item if off_item is not None else (offsets or {}).get(os.path.basename(p))
        for o in fl:
            o['mbase'] = base; o['dir'] = os.path.dirname(p)
            if off is not None: o['v'] = o['v'] + np.array(off)
        objs += fl
    keep = []
    for o in objs:
        nm = o['name']
        if exclude and re.search(exclude, nm, re.I): continue
        if include and not re.search(include, nm, re.I): continue
        keep.append(o)
    groups = {}
    stats = {}
    for o in keep:
        idx, uv, sm, mi, ds = tris_of(o, mats_all)
        if not len(idx): continue
        if decimate:
            ratio = next((r for rx, r in decimate if re.search(rx, o['name'], re.I)), None)
            if ratio and len(idx) > 200:
                import fast_simplification
                from scipy.spatial import cKDTree
                used, inv = np.unique(idx.reshape(-1), return_inverse=True)
                pts = o['v'][used].astype(np.float32); fac = inv.reshape(-1, 3)
                vuv = np.zeros((len(used), 2)); vuv[inv] = uv.reshape(-1, 2)
                p2, f2 = fast_simplification.simplify(pts, fac, target_reduction=ratio)
                if len(f2):
                    near = cKDTree(pts).query(p2)[1]
                    o = dict(o); o['v'] = p2.astype(np.float64)
                    idx = f2.astype(np.int64); uv = vuv[near][idx]; sm = np.ones(len(idx), bool); mi = np.full(len(idx), mi[0]); ds = np.full(len(idx), ds[0])
        nrm = smooth_normals(o['v'], idx, sm, o['crease'])
        pos = o['v'][idx]
        tex = o['texture']
        if tex and tex_override and tex in tex_override: tex = tex_override[tex]
        texp = os.path.join(tex_dir or o['dir'], tex) if tex else None
        stats[o['name']] = len(idx)
        part = 'cabin' if re.search(cabin_rx, o['name'], re.I) else ('glass' if re.search(glass_rx, o['name'], re.I) else ('gear' if re.search(gear_rx, o['name'], re.I) else 'body'))
        for f in range(len(idx)):
            key = (texp, int(mi[f]) + o['mbase'], bool(ds[f]), part)
            g = groups.setdefault(key, {'p': [], 'n': [], 'uv': [], 'names': set()})
            g['p'].append(pos[f]); g['n'].append(nrm[f]); g['uv'].append(uv[f]); g['names'].add(o['leaf'])
    if report:
        top = sorted(stats.items(), key=lambda x: -x[1])[:25]
        print('objects kept', len(keep), 'tris', sum(stats.values()))
        for n, c in top: print('  ', c, n)
    # transform
    allp = np.concatenate([np.array(g['p']).reshape(-1, 3) for g in groups.values()])
    R = AC2THREE.copy()
    if extra_rot is not None: R = extra_rot @ R
    allp3 = allp @ R.T * scale
    mn, mx = allp3.min(0), allp3.max(0)
    shift = np.zeros(3)
    if center: shift[0] = -(mn[0] + mx[0]) / 2; shift[2] = -(mn[2] + mx[2]) / 2
    if ground: shift[1] = -mn[1]
    meshes = []
    for (texp, mi, ds, part), g in groups.items():
        p = (np.array(g['p']).reshape(-1, 3) @ R.T) * scale + shift
        n = np.array(g['n']).reshape(-1, 3) @ R.T
        uv = np.array(g['uv']).reshape(-1, 2).copy(); uv[:, 1] = 1 - uv[:, 1]
        # dedupe
        key = np.concatenate([np.round(p * 2000), np.round(n * 300), np.round(uv * 8000)], axis=1).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        meshes.append({'part': part, 'tex': texp, 'mat': mats_all[mi], 'ds': ds, 'p': p[first].astype(np.float32), 'n': n[first].astype(np.float32), 'uv': uv[first].astype(np.float32), 'i': inv.astype(np.uint32), 'names': sorted(g['names'])})
    write_glb(meshes, out_path, tex_max=tex_max, tex_paint=tex_paint, jpeg_quality=jpeg_quality, keep_alpha=keep_alpha, tint=tint)
    bb = (mx + shift) - (mn + shift)
    print('wrote', out_path, os.path.getsize(out_path), 'bytes; size (x,y,z) =', np.round(bb, 2), 'tris', sum(len(m['i']) // 3 for m in meshes))
    return meshes

def load_tex(path):
    im = Image.open(path)
    im.load()
    return im.convert('RGBA')

def write_glb(meshes, out_path, *, tex_max, tex_paint, jpeg_quality, keep_alpha, tint=None):
    bin_ = bytearray(); bviews = []; accessors = []; images = []; textures = []; materials = []; prims = []
    def add_view(data, target=None):
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); bin_.extend(data)
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: bv['target'] = target
        bviews.append(bv); return len(bviews) - 1
    def add_acc(arr, typ, comp, target):
        v = add_view(arr.tobytes(), target)
        acc = {'bufferView': v, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if typ == 'VEC3' and comp == 5126: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc); return len(accessors) - 1
    tex_index = {}
    for m in meshes:
        ti = None
        if m['tex'] and os.path.exists(m['tex']):
            if m['tex'] not in tex_index:
                im = load_tex(m['tex'])
                if tex_paint and os.path.basename(m['tex']) in tex_paint: im = tex_paint[os.path.basename(m['tex'])](im)
                if max(im.size) > tex_max: s = tex_max / max(im.size); im = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.LANCZOS)
                a = np.array(im)[:, :, 3]
                use_alpha = (keep_alpha(m['tex']) if keep_alpha else (a.min() < 250))
                buf = io.BytesIO()
                if use_alpha: im.save(buf, 'PNG', optimize=True); mime = 'image/png'
                else: im.convert('RGB').save(buf, 'JPEG', quality=jpeg_quality, optimize=True); mime = 'image/jpeg'
                v = add_view(buf.getvalue())
                images.append({'bufferView': v, 'mimeType': mime}); textures.append({'source': len(images) - 1})
                tex_index[m['tex']] = (len(textures) - 1, use_alpha)
            ti = tex_index[m['tex']]
        mat = m['mat']; rgb = list(mat['rgb'])
        if m['part'] in ('glass', 'cabin') or mat['trans'] > 0.5:
            gm = {'pbrMetallicRoughness': {'baseColorFactor': [0.05, 0.07, 0.1, 0.78], 'metallicFactor': 0.4, 'roughnessFactor': 0.05}, 'doubleSided': True, 'alphaMode': 'BLEND',
                  'extras': {'part': 'cabin' if m['part'] == 'cabin' else 'glass', 'names': m['names'][:40], 'tex': None}}
            materials.append(gm)
            attrs = {'POSITION': add_acc(m['p'], 'VEC3', 5126, 34962), 'NORMAL': add_acc(m['n'], 'VEC3', 5126, 34962)}
            idx = m['i'].astype(np.uint16) if len(m['p']) < 65536 else m['i']
            prims.append({'attributes': attrs, 'indices': add_acc(idx, 'SCALAR', 5123 if idx.dtype == np.uint16 else 5125, 34963), 'material': len(materials) - 1})
            continue
        if tint and m['tex'] is None: rgb = tint(rgb, m)
        rough = max(0.18, min(0.95, 1 - (mat['shi'] / 128.0) * 0.9))
        gm = {'pbrMetallicRoughness': {'baseColorFactor': [*([1, 1, 1] if ti else rgb), 1 - mat['trans']], 'metallicFactor': 0.0, 'roughnessFactor': rough}, 'doubleSided': bool(m['ds'])}
        if ti: gm['pbrMetallicRoughness']['baseColorTexture'] = {'index': ti[0]}
        if (ti and ti[1]) or mat['trans'] > 0.02: gm['alphaMode'] = 'MASK' if (ti and ti[1] and mat['trans'] <= 0.02) else 'BLEND'
        if gm.get('alphaMode') == 'MASK': gm['alphaCutoff'] = 0.5
        if max(mat['emis']) > 0.05: gm['emissiveFactor'] = list(mat['emis'])
        gm['extras'] = {'part': m['part'], 'names': m['names'][:40], 'tex': os.path.basename(m['tex']) if m['tex'] else None}
        materials.append(gm)
        attrs = {'POSITION': add_acc(m['p'], 'VEC3', 5126, 34962), 'NORMAL': add_acc(m['n'], 'VEC3', 5126, 34962)}
        if ti: attrs['TEXCOORD_0'] = add_acc(m['uv'], 'VEC2', 5126, 34962)
        idx = m['i'].astype(np.uint16) if len(m['p']) < 65536 else m['i']
        prims.append({'attributes': attrs, 'indices': add_acc(idx, 'SCALAR', 5123 if idx.dtype == np.uint16 else 5125, 34963), 'material': len(materials) - 1})
    gltf = {'asset': {'version': '2.0', 'generator': 'ac2glb (ops-airport)'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
            'meshes': [{'primitives': prims}], 'materials': materials, 'accessors': accessors, 'bufferViews': bviews, 'buffers': [{'byteLength': len(bin_)}]}
    if images: gltf['images'] = images; gltf['textures'] = textures
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    while len(bin_) % 4: bin_.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(out_path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)

if __name__ == '__main__':
    convert(sys.argv[1:-1], sys.argv[-1])
