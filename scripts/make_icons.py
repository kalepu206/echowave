"""Generates EchoWave app icons and Play Store graphics into public/icons and android/store-graphics.
Run: python3 scripts/make_icons.py   (needs Pillow: pip install pillow)"""
import math, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "public", "icons")
STORE = os.path.join(ROOT, "android", "store-graphics")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(STORE, exist_ok=True)

BG = (63, 81, 181)       # #3f51b5 indigo
BG2 = (92, 107, 192)     # #5c6bc0
ACCENT = (240, 173, 78)  # #f0ad4e
WHITE = (255, 255, 255)

def wave_points(x0, x1, y, amp, periods):
    pts = []
    n = 200
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        pts.append((x, y - amp * math.sin(t * periods * 2 * math.pi)))
    return pts

def draw_waves(d, cx, cy, size, color1=WHITE, color2=ACCENT):
    w = size
    lw = max(2, int(size * 0.085))
    x0, x1 = cx - w / 2, cx + w / 2
    for (dy, col) in ((-size * 0.13, color1), (size * 0.13, color2)):
        pts = wave_points(x0, x1, cy + dy, size * 0.11, 1.5)
        r = lw / 2
        # stamp circles along the curve: smooth thick stroke with round ends
        for i in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            steps = max(1, int(math.hypot(bx - ax, by - ay) / 2))
            for k in range(steps + 1):
                px, py = ax + (bx - ax) * k / steps, ay + (by - ay) * k / steps
                d.ellipse([px - r, py - r, px + r, py + r], fill=col)

def gradient(size, c1, c2):
    img = Image.new("RGB", (size, size), c1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img

def icon(size, maskable=False, rounded=True):
    S = size * 4  # supersample
    base = gradient(S, BG, BG2).convert("RGBA")
    if rounded and not maskable:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=255)
        out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        out.paste(base, (0, 0), mask)
        base = out
    d = ImageDraw.Draw(base)
    draw_waves(d, S / 2, S / 2, S * (0.5 if maskable else 0.62))
    return base.resize((size, size), Image.LANCZOS)

icon(192).save(os.path.join(ICONS, "icon-192.png"))
icon(512).save(os.path.join(ICONS, "icon-512.png"))
icon(512, maskable=True).save(os.path.join(ICONS, "icon-maskable-512.png"))
icon(192, maskable=True).save(os.path.join(ICONS, "icon-maskable-192.png"))
icon(180, rounded=False).convert("RGB").save(os.path.join(ICONS, "apple-touch-icon.png"))
icon(32).save(os.path.join(ICONS, "favicon-32.png"))

# Play Store: 512x512 icon (no transparency needed but allowed) and 1024x500 feature graphic
icon(512, rounded=False).convert("RGB").save(os.path.join(STORE, "play-icon-512.png"))

def font(size, bold=True):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
              "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def banner(w, h, path):
    S = 2
    img = Image.new("RGB", (w * S, h * S), BG2)
    d = ImageDraw.Draw(img)
    ring = tuple(int(c + (255 - c) * 0.25) for c in BG2)
    cx, cy = w * S * 0.82, h * S * 0.5
    for r in (h * 0.3, h * 0.4):
        d.ellipse([cx - r * S, cy - r * S, cx + r * S, cy + r * S], outline=ring, width=2 * S)
    draw_waves(d, cx, cy, h * S * 0.5)
    d.text((w * S * 0.07, h * S * 0.24), "EchoWave", font=font(int(h * S * 0.2)), fill=WHITE)
    d.text((w * S * 0.07, h * S * 0.52), "What's happening near you,", font=font(int(h * S * 0.075), False), fill=WHITE)
    d.text((w * S * 0.07, h * S * 0.63), "live and AI-checked for safety.", font=font(int(h * S * 0.075), False), fill=ACCENT)
    img.resize((w, h), Image.LANCZOS).save(path)

banner(1024, 500, os.path.join(STORE, "feature-graphic-1024x500.png"))
banner(1200, 630, os.path.join(ICONS, "og-image.png"))
print("icons written")
