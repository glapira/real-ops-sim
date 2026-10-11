"""Crawl a FlightGear FGAddon folder on SourceForge and download matching files."""
import re, sys, os, urllib.request, html
BASE = 'https://sourceforge.net/p/flightgear/fgaddon/HEAD/tree/trunk/Aircraft/'
import subprocess
def get(url):
    return subprocess.run(['curl', '-sS', '-f', '-m', '120', '-L', url], capture_output=True, check=True).stdout
def listdir(path):
    s = get(BASE + path).decode('utf8', 'replace')
    dirs = re.findall(r'<a class="icon" href="([^"]+)" rel="nofollow" title="\1"><i class="fa fa-folder">', s)
    files = re.findall(r'<a class="icon" href="([^"]+)" rel="nofollow" title="\1"><i class="fa fa-file', s)
    return [html.unescape(d) for d in dirs], [html.unescape(f) for f in files]
def crawl(path, out, pat, skip, depth=4):
    dirs, files = listdir(path)
    for f in files:
        if re.search(pat, f, re.I) and not re.search(skip, path + f, re.I):
            dst = os.path.join(out, path, f)
            if os.path.exists(dst): continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            data = get(BASE + path + urllib.request.quote(f) + '?format=raw')
            open(dst, 'wb').write(data); print(len(data), path + f, flush=True)
    if depth:
        for d in dirs:
            if re.search(skip, path + d + '/', re.I): continue
            crawl(path + d + '/', out, pat, skip, depth - 1)
if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    pat = sys.argv[3] if len(sys.argv) > 3 else r'\.(ac|png|rgb|xml|txt)$|COPYING|LICEN'
    skip = sys.argv[4] if len(sys.argv) > 4 else r'Sounds|Nasal|Systems|Instruments|Panels|Cockpit|Flightdeck|FlightDeck|Interior|Splash|thumbnail|Docs|Effects|gui|Dialogs|Huds'
    crawl(path, out, pat, skip, int(sys.argv[5]) if len(sys.argv) > 5 else 4)
