"""Generate the LINE rich menu images (run: python assets/make_richmenu.py)."""
from PIL import Image, ImageDraw, ImageFont
import os
HERE = os.path.dirname(os.path.abspath(__file__))
BOLD = "C:/Windows/Fonts/LeelaUIb.ttf"
REG = "C:/Windows/Fonts/LeelawUI.ttf"
BG = (12, 74, 52); TILE = (255, 255, 255); ACCENT = (6, 199, 85); SUB = (82, 96, 109)

def icon(d, kind, cx, cy, r, color):
    w = max(8, r // 6)
    if kind == "people":
        d.ellipse([cx - r*0.9, cy - r, cx - r*0.1, cy - r*0.2], fill=color)
        d.ellipse([cx + r*0.1, cy - r, cx + r*0.9, cy - r*0.2], fill=color)
        d.rounded_rectangle([cx - r*1.2, cy, cx, cy + r], r//3, fill=color)
        d.rounded_rectangle([cx, cy, cx + r*1.2, cy + r], r//3, fill=color)
    elif kind == "calendar":
        d.rounded_rectangle([cx - r, cy - r*0.8, cx + r, cy + r], r//5, outline=color, width=w)
        d.rectangle([cx - r, cy - r*0.8, cx + r, cy - r*0.35], fill=color)
        for i in range(3):
            for j in range(2):
                x = cx - r*0.6 + i*r*0.6; y = cy + j*r*0.5
                d.rectangle([x - r*0.15, y - r*0.1, x + r*0.15, y + r*0.2], fill=color)
    elif kind == "ai":
        d.rounded_rectangle([cx - r, cy - r*0.7, cx + r, cy + r*0.6], r//3, outline=color, width=w)
        d.polygon([(cx - r*0.3, cy + r*0.6), (cx - r*0.7, cy + r), (cx, cy + r*0.6)], fill=color)
        for k in (-0.45, 0, 0.45):
            d.ellipse([cx + k*r - r*0.12, cy - r*0.17, cx + k*r + r*0.12, cy + r*0.07], fill=color)
    elif kind == "folder":
        d.polygon([(cx - r, cy - r*0.6), (cx - r*0.3, cy - r*0.6), (cx - r*0.1, cy - r*0.35), (cx + r, cy - r*0.35), (cx + r, cy + r*0.8), (cx - r, cy + r*0.8)], fill=color)
    elif kind == "today":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=w)
        d.line([cx, cy, cx, cy - r*0.6], fill=color, width=w)
        d.line([cx, cy, cx + r*0.45, cy + r*0.3], fill=color, width=w)
    elif kind == "plus":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
        d.rectangle([cx - r*0.12, cy - r*0.6, cx + r*0.12, cy + r*0.6], fill=(255, 255, 255))
        d.rectangle([cx - r*0.6, cy - r*0.12, cx + r*0.6, cy + r*0.12], fill=(255, 255, 255))
    elif kind == "send":
        d.polygon([(cx - r, cy - r*0.1), (cx + r, cy - r*0.9), (cx + r*0.35, cy + r)], fill=color)
        d.polygon([(cx - r*0.15, cy + r*0.1), (cx + r, cy - r*0.9), (cx + r*0.05, cy + r*0.75)], fill=(255, 255, 255))
    elif kind == "upload":
        d.polygon([(cx, cy - r), (cx - r*0.7, cy - r*0.2), (cx - r*0.25, cy - r*0.2), (cx - r*0.25, cy + r*0.4), (cx + r*0.25, cy + r*0.4), (cx + r*0.25, cy - r*0.2), (cx + r*0.7, cy - r*0.2)], fill=color)
        d.rounded_rectangle([cx - r, cy + r*0.6, cx + r, cy + r], r//8, fill=color)
    elif kind == "mine":
        d.rounded_rectangle([cx - r*0.75, cy - r, cx + r*0.75, cy + r], r//6, outline=color, width=w)
        d.line([cx - r*0.4, cy + r*0.05, cx - r*0.1, cy + r*0.35, cx + r*0.45, cy - r*0.3], fill=color, width=w)

def draw(path, size, cols, rows, tiles):
    W, H = size
    im = Image.new("RGB", size, BG); d = ImageDraw.Draw(im)
    gap = 24; tw = (W - gap*(cols+1)) / cols; th = (H - gap*(rows+1)) / rows
    fb = ImageFont.truetype(BOLD, int(th*0.17)); fs = ImageFont.truetype(REG, int(th*0.095))
    for idx, (title, sub, kind) in enumerate(tiles):
        c, r = idx % cols, idx // cols
        x0 = gap + c*(tw + gap); y0 = gap + r*(th + gap)
        d.rounded_rectangle([x0, y0, x0 + tw, y0 + th], 40, fill=TILE)
        cx = x0 + tw/2
        d.ellipse([cx - th*0.17, y0 + th*0.1, cx + th*0.17, y0 + th*0.44], fill=(230, 249, 238))
        icon(d, kind, cx, y0 + th*0.27, int(th*0.1), ACCENT)
        # Pillow (no raqm) cannot stack an upper vowel + tone mark, e.g. "เพิ่ม": draw the tone mark by hand.
        mark_at = None
        for v in ("ิ่", "ี่", "ิ้", "ี้"):
            if v in title:
                mark_at = title.index(v); tone = v[1]; title = title.replace(v, v[0], 1); break
        d.text((cx, y0 + th*0.62), title, font=fb, fill=BG, anchor="mm")
        if mark_at is not None:
            left = cx - fb.getlength(title) / 2
            x = left + fb.getlength(title[:mark_at + 1])
            d.text((x - fb.size*0.06, y0 + th*0.62 - fb.size*0.27), tone, font=fb, fill=BG, anchor="rm")
        d.text((cx, y0 + th*0.82), sub, font=fs, fill=SUB, anchor="mm")
    im.save(path, "JPEG", quality=88, optimize=True)
    print(path, os.path.getsize(path))

draw(os.path.join(HERE, "richmenu-owner.jpg"), (2500, 1686), 3, 2, [
    ("เพิ่มงาน", "สร้างหัวข้องานใหม่", "plus"),
    ("ปฏิทินส่งงาน", "ดูเป็นรายวัน", "calendar"),
    ("ถาม AI", "ถามเรื่องการส่งงาน", "ai"),
    ("หัวข้องาน", "งานเปิดรับไฟล์", "folder"),
    ("ส่งงาน", "รูป / ไฟล์ / zip", "send"),
    ("วิธีส่งงาน", "ส่งไฟล์ แล้วเลือกหัวข้อ", "upload"),
])
draw(os.path.join(HERE, "richmenu-user.jpg"), (2500, 843), 3, 1, [
    ("วิธีส่งงาน", "ส่งไฟล์ แล้วเลือกหัวข้อ", "upload"),
    ("หัวข้องาน", "งานเปิดรับไฟล์", "folder"),
    ("ไฟล์ของฉัน", "เช็กว่าเข้าระบบแล้ว", "mine"),
])
