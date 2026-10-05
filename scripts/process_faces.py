#!/usr/bin/env python3
"""把 AI 生成的臉部原圖處理成遊戲貼圖與頭型資料。

每張圖做的事：
  1. 去掉綠幕，裁到頭部外框，縮成 384x384
  2. 量出每一列的頭部寬度 → 頭型輪廓（耳朵那段用上下內插去掉），3D 頭直接照這個輪廓建
  3. 找眼白位置 → 眼睛高度與兩眼間距，用來擺放立體的鼻子、眉骨
  4. 取樣額頭膚色、每一列邊緣的顏色（鬍子會延伸到頭的側面）
  5. 把外框以外的像素用邊緣顏色補滿，輸出不透明貼圖

用法：python3 scripts/process_faces.py [--debug]   （--debug 會把標示輪廓與眼睛的檢查圖存到 assets_src/faces_debug/）
輸入：assets_src/faces_raw/<id>.png
輸出：assets/faces/<id>.webp、assets/faces/faces.json
"""
import colorsys
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageStat, features

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets_src' / 'faces_raw'
OUT = ROOT / 'assets' / 'faces'
SIZE = 384
N = 41  # 輪廓取樣點數（由頭頂到下巴）
EXT = 'webp' if features.check('webp') else 'png'
DEBUG = '--debug' in sys.argv


def is_bg(px, bg):
    r, g, b = px
    if g > r + 45 and g > b + 45:
        return True
    return abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 90


def foreground(rgb):
    """從四邊往內淹沒綠幕，回傳前景遮罩（頭部內部的綠色不會被吃掉）"""
    w, h = rgb.size
    px = rgb.load()
    k = 12
    corners = [rgb.crop(b) for b in [(0, 0, k, k), (w - k, 0, w, k), (0, h - k, k, h), (w - k, h - k, w, h)]]
    bg = tuple(int(sorted(ImageStat.Stat(c).median[i] for c in corners)[1]) for i in range(3))
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not is_bg(px[x, y], bg):
            continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    mask = Image.frombytes('L', (w, h), bytes(0 if s else 255 for s in seen))
    return mask.filter(ImageFilter.MinFilter(3))  # 內縮一圈去掉綠邊


def find_eyes(rgb):
    """眼白是臉上唯一接近純白的區域：找左右兩側都有白色像素的那一列"""
    px = rgb.load()
    rows = []
    for y in range(int(SIZE * 0.12), int(SIZE * 0.8)):
        left, right = [], []
        for x in range(int(SIZE * 0.18), int(SIZE * 0.82)):
            r, g, b = px[x, y]
            _h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v > 0.8 and s < 0.2:
                (left if x < SIZE / 2 else right).append(x)
        rows.append((y, left, right))
    best = None
    for i in range(2, len(rows) - 2):
        band = rows[i - 2:i + 3]
        score = min(sum(len(r[1]) for r in band), sum(len(r[2]) for r in band))
        if best is None or score > best[0]:
            best = (score, i)
    if not best or best[0] < 12:
        return None
    band = rows[best[1] - 2:best[1] + 3]
    lx = [x for r in band for x in r[1]]
    rx = [x for r in band for x in r[2]]
    eye = rows[best[1]][0] / SIZE
    ipd = (sum(rx) / len(rx) - sum(lx) / len(lx)) / SIZE
    return (eye, ipd) if 0.2 < ipd < 0.62 else None


def process(path):
    raw = Image.open(path).convert('RGB')
    box = foreground(raw.resize((512, 512), Image.BILINEAR)).getbbox()
    if not box:
        return None
    sc = raw.size[0] / 512
    box = tuple(int(v * sc) for v in box)
    head = raw.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    mask = foreground(head)
    mpx = mask.load()
    hpx = head.load()

    eyes = find_eyes(head)
    eye, ipd = eyes if eyes else (0.44, 0.36)

    # 每一列的左右邊界
    edges = []
    for y in range(SIZE):
        xs = [x for x in range(SIZE) if mpx[x, y]]
        edges.append((xs[0], xs[-1]) if xs else None)
    for y in range(SIZE):  # 補空列
        if edges[y] is None:
            near = [edges[j] for j in range(max(0, y - 6), min(SIZE, y + 7)) if edges[j]]
            edges[y] = near[0] if near else (SIZE // 2 - 2, SIZE // 2 + 2)

    # 半寬輪廓（以圖寬的一半為 1），去耳朵：眉毛到鼻底之間用直線內插後取較小值
    hw = [(r - l) / SIZE for (l, r) in edges]
    y0 = int(max(0.05, eye - 0.11) * SIZE)
    y1 = int(min(0.95, eye + 0.24) * SIZE)
    for y in range(y0, y1):
        t = (y - y0) / (y1 - y0)
        hw[y] = min(hw[y], hw[y0] + (hw[y1] - hw[y0]) * t + 0.012 * (4 * t * (1 - t)))
    sm = []
    for y in range(SIZE):
        seg = hw[max(0, y - 5):y + 6]
        sm.append(sum(seg) / len(seg))
    profile = [round(sm[min(SIZE - 1, int(i / (N - 1) * (SIZE - 1)))], 4) for i in range(N)]
    profile[0] = min(profile[0], 0.3)

    # 每一列邊緣內側的顏色，上下平滑後當作頭部側面與後腦的顏色
    # 取樣位置用去掉耳朵後的輪廓往內縮，才不會取到耳朵的陰影或墨線
    inset = SIZE * 0.09
    rows = []
    for y in range(SIZE):
        half = max(inset + 4, sm[y] * SIZE / 2)
        xl = int(min(SIZE - 1, max(0, SIZE / 2 - half + inset)))
        xr = int(min(SIZE - 1, max(0, SIZE / 2 + half - inset)))
        cs = [hpx[xl, y], hpx[xr, y]]
        rows.append(tuple((cs[0][k] + cs[1][k]) / 2 for k in range(3)))
    side = []
    for y in range(SIZE):
        seg = rows[max(0, y - 12):y + 13]
        side.append(tuple(int(sum(c[k] for c in seg) / len(seg)) for k in range(3)))

    fh = head.crop((int(SIZE * 0.40), int(SIZE * 0.13), int(SIZE * 0.60), int(SIZE * 0.23)))
    skin = '#%02x%02x%02x' % tuple(int(v) for v in ImageStat.Stat(fh).median)

    # 外框以外與最左右兩條邊帶填上側面顏色：3D 頭的後半圈取樣這裡，不會露出綠幕或墨線
    out = head.copy()
    opx = out.load()
    band = 6
    for y in range(SIZE):
        l, r = edges[y]
        for x in range(0, max(band, min(SIZE, l + 3))):
            opx[x, y] = side[y]
        for x in range(min(SIZE - band, max(0, r - 2)), SIZE):
            opx[x, y] = side[y]
        # 鬍鬚髮絲間殘留的綠幕
        for x in range(l, r + 1):
            pr, pg, pb = opx[x, y]
            if pg > pr + 45 and pg > pb + 45:
                opx[x, y] = side[y]

    name = f'{path.stem}.{EXT}'
    if EXT == 'webp':
        out.save(OUT / name, 'WEBP', quality=90, method=6)
    else:
        out.save(OUT / name, 'PNG', optimize=True)

    if DEBUG:
        dbg = out.copy()
        d = ImageDraw.Draw(dbg)
        d.line((0, eye * SIZE, SIZE, eye * SIZE), fill=(0, 255, 255), width=2)
        for sx in (-1, 1):
            cx = SIZE / 2 + sx * ipd * SIZE / 2
            d.ellipse((cx - 5, eye * SIZE - 5, cx + 5, eye * SIZE + 5), outline=(255, 0, 255), width=2)
        pts_l = [(SIZE / 2 - profile[i] * SIZE / 2, i / (N - 1) * (SIZE - 1)) for i in range(N)]
        pts_r = [(SIZE / 2 + profile[i] * SIZE / 2, i / (N - 1) * (SIZE - 1)) for i in range(N)]
        d.line(pts_l, fill=(255, 255, 0), width=2)
        d.line(pts_r, fill=(255, 255, 0), width=2)
        dbg_dir = ROOT / 'assets_src' / 'faces_debug'
        dbg_dir.mkdir(parents=True, exist_ok=True)
        dbg.save(dbg_dir / f'{path.stem}.png')

    return {
        'file': name, 'skin': skin, 'aspect': round((box[2] - box[0]) / (box[3] - box[1]), 3),
        'eye': round(eye, 3), 'ipd': round(ipd, 3), 'eyesFound': bool(eyes), 'profile': profile,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    db = {}
    for p in sorted(RAW.glob('*.png')):
        info = process(p)
        if info:
            db[p.stem] = info
            flag = '' if info['eyesFound'] else '  ⚠ 找不到眼白，用預設位置'
            print(f"[ok] {p.stem}  skin={info['skin']}  aspect={info['aspect']}  eye={info['eye']}  ipd={info['ipd']}{flag}")
        else:
            print(f'[skip] {p.stem} — 找不到頭部範圍')
    (OUT / 'faces.json').write_text(json.dumps(db, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'=== {len(db)} 張 → {OUT} ===')


if __name__ == '__main__':
    main()
