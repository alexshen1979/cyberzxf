from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import random


ROOT = Path(__file__).resolve().parents[1]
BG = Path.home() / ".codex/generated_images/019e3fc7-2ca3-73f2-975f-41675222cc3c/ig_0b844f31e0324a82016a2114ab34188191a88dfd873e31ca10.png"
LOGO = ROOT / "backend/src/assets/brand-logo.png"
OUT_DIR = ROOT / "mkt/materials/images/posters"
OUT = OUT_DIR / "04_parent_user_高三家长AI志愿分析海报.png"
BG_COPY = OUT_DIR / "04_parent_user_高三家长AI志愿分析海报_bg.png"

FONT_REGULAR = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_MEDIUM = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"

W, H = 1080, 1440


def font(path, size):
    return ImageFont.truetype(path, size)


def cover_crop(img, width, height):
    src_w, src_h = img.size
    scale = max(width / src_w, height / src_h)
    resized = img.resize((math.ceil(src_w * scale), math.ceil(src_h * scale)), Image.Resampling.LANCZOS)
    x = (resized.width - width) // 2
    y = (resized.height - height) // 2
    return resized.crop((x, y, x + width, y + height))


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paste_round(base, img, box, radius):
    x1, y1, x2, y2 = box
    img = img.resize((x2 - x1, y2 - y1), Image.Resampling.LANCZOS)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width, img.height), radius=radius, fill=255)
    base.paste(img.convert("RGBA"), (x1, y1), mask)


def draw_text(draw, xy, text, ft, fill, spacing=8, anchor=None):
    draw.text(xy, text, font=ft, fill=fill, spacing=spacing, anchor=anchor)


def draw_wrapped(draw, text, x, y, max_width, ft, fill, line_gap=12):
    lines = []
    current = ""
    for ch in text:
        trial = current + ch
        if draw.textlength(trial, font=ft) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = ch
    if current:
        lines.append(current)
    line_h = ft.getbbox("高")[3] - ft.getbbox("高")[1] + line_gap
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=ft, fill=fill)
    return y + len(lines) * line_h


def make_qr_placeholder(size=198):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=20, fill=(255, 255, 255, 255), outline=(221, 232, 226, 255), width=3)
    rng = random.Random(20260604)
    cell = 10
    margin = 22

    def finder(x, y):
        d.rounded_rectangle((x, y, x + 48, y + 48), radius=7, fill=(19, 45, 36, 255))
        d.rounded_rectangle((x + 10, y + 10, x + 38, y + 38), radius=4, fill=(255, 255, 255, 255))
        d.rounded_rectangle((x + 19, y + 19, x + 29, y + 29), radius=2, fill=(19, 45, 36, 255))

    finder(margin, margin)
    finder(size - margin - 48, margin)
    finder(margin, size - margin - 48)

    for r in range(13):
        for c in range(13):
            x = margin + c * cell
            y = margin + r * cell
            in_finder = (c < 6 and r < 6) or (c > 7 and r < 6) or (c < 6 and r > 7)
            if in_finder:
                continue
            if rng.random() > 0.55:
                color = (19, 45, 36, 255) if rng.random() > 0.12 else (56, 128, 105, 255)
                d.rounded_rectangle((x, y, x + 7, y + 7), radius=2, fill=color)

    logo = Image.open(LOGO).convert("RGBA")
    logo_box = Image.new("RGBA", (48, 48), (255, 255, 255, 255))
    paste_round(logo_box, logo, (5, 5, 43, 43), 8)
    img.alpha_composite(logo_box, ((size - 48) // 2, (size - 48) // 2))
    return img


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bg = cover_crop(Image.open(BG).convert("RGB"), W, H)
    bg.save(BG_COPY)

    canvas = bg.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # Legibility gradients.
    for y in range(H):
        top_alpha = max(0, int(188 * (1 - y / 920)))
        bottom_alpha = max(0, int(95 * ((y - 940) / 500)))
        alpha = max(top_alpha, bottom_alpha)
        if alpha:
            od.line((0, y, W, y), fill=(248, 250, 244, alpha))
    for x in range(W):
        alpha = 12 + int(126 * ((1 - x / W) ** 1.9))
        od.line((x, 0, x, H), fill=(248, 250, 244, alpha))
    canvas.alpha_composite(overlay)

    # Accent shapes.
    shape = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shape)
    sd.ellipse((-250, -240, 350, 350), fill=(255, 191, 103, 55))
    sd.ellipse((780, -140, 1240, 320), outline=(15, 118, 110, 58), width=24)
    sd.rounded_rectangle((64, 1050, 1016, 1318), radius=34, fill=(255, 255, 255, 224), outline=(255, 255, 255, 160), width=2)
    shape = shape.filter(ImageFilter.GaussianBlur(0.3))
    canvas.alpha_composite(shape)

    d = ImageDraw.Draw(canvas)
    dark = (19, 45, 36, 255)
    teal = (15, 118, 110, 255)
    green = (37, 99, 73, 255)
    muted = (84, 101, 91, 255)
    amber = (217, 119, 6, 255)

    # Brand.
    logo = Image.open(LOGO).convert("RGBA")
    logo_card = Image.new("RGBA", (72, 72), (255, 255, 255, 235))
    paste_round(logo_card, logo, (8, 8, 64, 64), 13)
    paste_round(canvas, logo_card, (70, 70, 142, 142), 18)
    draw_text(d, (160, 76), "涨识", font(FONT_MEDIUM, 42), dark)
    draw_text(d, (160, 125), "AI 高考志愿分析", font(FONT_REGULAR, 24), muted)

    rounded_rect(d, (70, 190, 348, 244), 27, (255, 255, 255, 210), outline=(15, 118, 110, 65), width=2)
    draw_text(d, (96, 205), "给高三家长的志愿第一步", font(FONT_MEDIUM, 24), teal)

    # Main slogan.
    draw_text(d, (70, 295), "填志愿前，", font(FONT_MEDIUM, 72), dark)
    draw_text(d, (70, 385), "先做一次", font(FONT_MEDIUM, 72), dark)
    draw_text(d, (70, 475), "AI 风险体检", font(FONT_MEDIUM, 90), teal)
    d.rounded_rectangle((72, 585, 452, 596), radius=6, fill=(244, 180, 74, 255))

    sub = "输入省份、科类、分数，先看冲稳保、专业适配和退档风险。"
    draw_wrapped(d, sub, 72, 625, 620, font(FONT_MEDIUM, 34), (47, 67, 58, 255), line_gap=14)

    # Benefit chips.
    chips = [
        ("冲稳保参考", 72, 780),
        ("专业方向提示", 286, 780),
        ("风险点提醒", 548, 780),
    ]
    for text, x, y in chips:
        w = int(d.textlength(text, font=font(FONT_MEDIUM, 24))) + 54
        rounded_rect(d, (x, y, x + w, y + 52), 26, (255, 255, 255, 222), outline=(15, 118, 110, 60), width=2)
        d.ellipse((x + 18, y + 18, x + 28, y + 28), fill=teal)
        draw_text(d, (x + 38, y + 12), text, font(FONT_MEDIUM, 24), green)

    # Small trust note.
    rounded_rect(d, (72, 860, 612, 934), 20, (15, 118, 110, 220))
    draw_text(d, (104, 880), "先用 AI 做初筛，再和孩子一起核对选择", font(FONT_MEDIUM, 26), (255, 255, 255, 255))

    # CTA card.
    qr = make_qr_placeholder(206)
    canvas.alpha_composite(qr, (106, 1084))
    draw_text(d, (344, 1088), "现在扫码", font(FONT_MEDIUM, 58), dark)
    draw_text(d, (344, 1160), "生成你的 AI 志愿分析报告", font(FONT_MEDIUM, 38), teal)
    draw_text(d, (344, 1222), "适合：高三家长 / 刚出分家庭 / 专业方向不确定", font(FONT_REGULAR, 24), muted)
    rounded_rect(d, (344, 1268, 872, 1330), 31, (15, 118, 110, 255))
    draw_text(d, (608, 1281), "扫码进入小程序，先看风险", font(FONT_MEDIUM, 29), (255, 255, 255, 255), anchor="ma")
    draw_text(d, (106, 1302), "小程序码位", font(FONT_MEDIUM, 24), muted)

    # Footer.
    draw_text(d, (70, 1370), "不承诺录取结果，不替代官方数据核对；用于志愿方案初筛与风险提示。", font(FONT_REGULAR, 20), (87, 101, 93, 210))

    canvas.convert("RGB").save(OUT, quality=96)
    print(OUT)
    print(BG_COPY)


if __name__ == "__main__":
    main()
