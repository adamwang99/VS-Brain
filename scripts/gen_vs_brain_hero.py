#!/usr/bin/env python3
"""VS Brain hero illustration generator (dark, glass, branded)."""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1600, 900
LOGO = "/home/phuong/.openclaw/workspace/projects/crosscritic/apps/extension/icons/vs-brain.png"
OUT = "/home/phuong/.openclaw/workspace/projects/crosscritic/assets/vs-brain-hero.png"

# ---- palette ----
BG_TOP = (11, 16, 32)
BG_BOT = (6, 10, 22)
ACCENT = (99, 132, 255)      # indigo
ACCENT2 = (56, 224, 201)     # teal
GPT_C = (16, 163, 127)       # chatgpt green
GEM_C = (110, 132, 255)      # gemini blue/violet
TEXT = (232, 236, 243)
MUTED = (150, 162, 186)
CARD = (20, 27, 46)
CARD_EDGE = (54, 66, 102)

def font(sz, bold=True):
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else "")
    return ImageFont.truetype(p, sz)

img = Image.new("RGB", (W, H), BG_TOP)
px = img.load()
for y in range(H):
    t = y / H
    r = int(BG_TOP[0] + (BG_BOT[0]-BG_TOP[0])*t)
    g = int(BG_TOP[1] + (BG_BOT[1]-BG_TOP[1])*t)
    b = int(BG_TOP[2] + (BG_BOT[2]-BG_TOP[2])*t)
    for x in range(W):
        px[x, y] = (r, g, b)

# ---- soft glow blobs ----
glow = Image.new("RGBA", (W, H), (0,0,0,0))
gd = ImageDraw.Draw(glow)
def blob(cx, cy, rad, color, a):
    gd.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], fill=color+(a,))
blob(280, 240, 260, ACCENT, 60)
blob(1330, 250, 240, ACCENT2, 55)
blob(800, 760, 320, (120, 90, 220), 45)
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.alpha_composite(img.convert("RGBA"), glow)
d = ImageDraw.Draw(img)

# ---- subtle grid dots ----
for gy in range(60, H, 54):
    for gx in range(60, W, 54):
        d.ellipse([gx-1, gy-1, gx+1, gy+1], fill=(255,255,255,12))

def rrect(draw, box, rad, fill, edge=None, ew=2):
    draw.rounded_rectangle(box, radius=rad, fill=fill, outline=edge, width=ew)

def glass_card(cx, cy, w, h, title, sub, dot):
    box = [cx-w//2, cy-h//2, cx+w//2, cy+h//2]
    shadow = Image.new("RGBA", img.size, (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([box[0]+6, box[1]+12, box[2]+6, box[3]+12], radius=26, fill=(0,0,0,120))
    shadow_b = shadow.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(shadow_b)
    d2 = ImageDraw.Draw(img)
    rrect(d2, box, 26, CARD+(255,), CARD_EDGE+(255,), 2)
    d2.ellipse([cx-w//2+26, cy-h//2+24, cx-w//2+50, cy-h//2+48], fill=dot+(255,))
    d2.text((cx-w//2+64, cy-h//2+24), title, font=font(34), fill=TEXT)
    d2.text((cx-w//2+28, cy-h//2+74), sub, font=font(22, False), fill=MUTED)

img = img.convert("RGBA")

# ---- title block ----
d = ImageDraw.Draw(img)
# logo
logo = Image.open(LOGO).convert("RGBA")
ls = 118
logo_r = logo.resize((ls, ls), Image.LANCZOS)
img.alpha_composite(logo_r, (96, 70))
d.text((232, 78), "VS Brain", font=font(72), fill=TEXT)
d.text((236, 158), "AI-to-AI critique relay · agreement loop · blueprint export",
       font=font(26, False), fill=MUTED)

# ---- nodes ----
gpt_c = (360, 470)
gem_c = (1240, 470)
hub_c = (800, 470)

# connection arcs
arc = Image.new("RGBA", img.size, (0,0,0,0))
ad = ImageDraw.Draw(arc)
def beam(p1, p2, color, width=10):
    ad.line([p1, p2], fill=color+(180,), width=width)
beam((gpt_c[0]+150, gpt_c[1]-30), (hub_c[0]-150, hub_c[1]-30), GPT_C, 8)
beam((hub_c[0]+150, hub_c[1]+30), (gem_c[0]-150, gem_c[1]+30), GEM_C, 8)
arc = arc.filter(ImageFilter.GaussianBlur(2))
img.alpha_composite(arc)

glass_card(*gpt_c, 300, 150, "ChatGPT", "Source critique", GPT_C)
glass_card(*gem_c, 300, 150, "Gemini", "Counter-critique", GEM_C)

# central hub
d = ImageDraw.Draw(img)
hb = [hub_c[0]-170, hub_c[1]-110, hub_c[0]+170, hub_c[1]+110]
halo = Image.new("RGBA", img.size, (0,0,0,0))
hd = ImageDraw.Draw(halo)
hd.rounded_rectangle([hb[0]-8,hb[1]-8,hb[2]+8,hb[3]+8], radius=34, fill=ACCENT+(70,))
halo = halo.filter(ImageFilter.GaussianBlur(26))
img.alpha_composite(halo)
d = ImageDraw.Draw(img)
rrect(d, hb, 30, (24,32,56,255), ACCENT+(255,), 3)
logo_h = logo.resize((76,76), Image.LANCZOS)
img.alpha_composite(logo_h, (hub_c[0]-38, hub_c[1]-86))
d.text((hub_c[0]-92, hub_c[1]+2), "Relay Engine", font=font(34), fill=TEXT)
d.text((hub_c[0]-150, hub_c[1]+48), "stop on real consensus", font=font(22, False), fill=ACCENT2)

# ---- bottom pipeline ----
steps = ["Relay", "Debate", "Consensus", "Finalize", "Blueprint"]
n = len(steps)
y0 = 730
x0, x1 = 200, 1400
gap = (x1-x0)//(n-1)
for i in range(n-1):
    d.line([(x0+gap*i+70, y0), (x0+gap*(i+1)-70, y0)], fill=CARD_EDGE+(255,), width=4)
for i, s in enumerate(steps):
    cx = x0 + gap*i
    col = ACCENT2 if i == n-1 else ACCENT
    d.ellipse([cx-26, y0-26, cx+26, y0+26], fill=(20,27,46,255), outline=col+(255,), width=4)
    d.ellipse([cx-7, y0-7, cx+7, y0+7], fill=col+(255,))
    tw = d.textlength(s, font=font(24))
    d.text((cx-tw/2, y0+40), s, font=font(24), fill=TEXT)

# footer tag
d.text((96, 838), "v0.8.44 · Chrome side-panel · ChatGPT + Gemini", font=font(20, False), fill=MUTED)

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.convert("RGB").save(OUT, quality=95)
print("saved", OUT, img.size)
