from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GEN = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9"
BG = GEN / "ig_0007963843fc09c0016a258cf3b9c481918283b64e85a7b483.png"
SCREEN = ROOT / "mkt/pre-score-creatives/images/16x9-screenshots/source-screens/source_2.jpg"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"
OUT_DIR = ROOT / "mkt/pre-score-creatives/images/square-overlay-card"

W = H = 800
FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")


def cover_resize(img: Image.Image, size: tuple[int, int], focus: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    max_left = resized.width - target_w
    max_top = resized.height - target_h
    left = round(max_left * focus[0]) if max_left > 0 else 0
    top = round(max_top * focus[1]) if max_top > 0 else 0
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def apply_background() -> Image.Image:
    bg = cover_resize(Image.open(BG).convert("RGB"), (W, H), focus=(0.36, 0.52)).convert("RGBA")
    bg = bg.filter(ImageFilter.GaussianBlur(2.0))
    canvas = Image.alpha_composite(bg, Image.new("RGBA", (W, H), (255, 255, 255, 78)))

    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = wash.load()
    for x in range(W):
        left_alpha = int(max(0, 218 * (1 - x / 520)))
        right_alpha = int(max(0, 164 * ((x - 390) / 330)))
        alpha = max(46, left_alpha, min(164, right_alpha))
        for y in range(H):
            px[x, y] = (255, 255, 255, alpha)
    return Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(20)))


def paste_logo(canvas: Image.Image) -> None:
    logo = Image.open(LOGO).convert("RGBA").resize((64, 64), Image.Resampling.LANCZOS)
    badge = Image.new("RGBA", (98, 98), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((0, 0, 97, 97), radius=25, fill=(255, 255, 255, 236))
    draw.rounded_rectangle((2, 2, 95, 95), radius=24, outline=(226, 232, 240, 230), width=2)
    badge.paste(logo, (17, 17), rounded_mask((64, 64), 16))
    canvas.alpha_composite(badge, (54, 50))


def make_phone(inner_h: int = 468) -> Image.Image:
    screen_src = Image.open(SCREEN).convert("RGB")
    inner_w = round(inner_h * screen_src.width / screen_src.height)
    border = 16
    pad = 36
    outer_w = inner_w + border * 2
    outer_h = inner_h + border * 2
    layer = Image.new("RGBA", (outer_w + pad * 2, outer_h + pad * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((pad + 12, pad + 18, pad + outer_w + 14, pad + outer_h + 22), radius=48, fill=(24, 38, 68, 92))
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(layer)

    body_box = (pad, pad, pad + outer_w, pad + outer_h)
    screen_box = (pad + border, pad + border, pad + border + inner_w, pad + border + inner_h)
    draw.rounded_rectangle(body_box, radius=48, fill=(14, 17, 22, 255))
    draw.rounded_rectangle((pad + 3, pad + 3, pad + outer_w - 3, pad + outer_h - 3), radius=45, outline=(128, 136, 148, 150), width=2)
    draw.rounded_rectangle((pad + outer_w - 2, pad + 120, pad + outer_w + 6, pad + 190), radius=4, fill=(88, 93, 105, 210))
    draw.rounded_rectangle((pad - 6, pad + 145, pad + 1, pad + 205), radius=4, fill=(70, 76, 88, 180))

    screen = screen_src.resize((inner_w, inner_h), Image.Resampling.LANCZOS).convert("RGBA")
    screen_mask = rounded_mask((inner_w, inner_h), 28)
    layer.paste(screen, (screen_box[0], screen_box[1]), screen_mask)
    draw.rounded_rectangle(screen_box, radius=28, outline=(255, 255, 255, 210), width=2)
    return layer


def draw_text(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    small = ImageFont.truetype(str(FONT_LIGHT), 34)
    title = ImageFont.truetype(str(FONT_BOLD), 88)
    desc = ImageFont.truetype(str(FONT_LIGHT), 34)

    draw.text((172, 74), "赛博张老师知识库", font=small, fill="#312e81", stroke_width=1, stroke_fill=(255, 255, 255, 210))
    y = 164
    draw.text((54, y), "打破信息差", font=title, fill="#130f2f", stroke_width=2, stroke_fill=(255, 255, 255, 226))
    y += text_size(draw, "打破信息差", title)[1] + 22
    draw.text((54, y), "志愿填报", font=title, fill="#130f2f", stroke_width=2, stroke_fill=(255, 255, 255, 226))
    y += text_size(draw, "志愿填报", title)[1] + 22
    draw.text((54, y), "不迷茫", font=title, fill="#130f2f", stroke_width=2, stroke_fill=(255, 255, 255, 226))
    draw.text((58, 514), "出分前先准备，出分后少走弯路", font=desc, fill="#4b587c", stroke_width=1, stroke_fill=(255, 255, 255, 210))


def compose() -> Path:
    canvas = apply_background()
    paste_logo(canvas)
    draw_text(canvas)
    phone = make_phone()
    canvas.alpha_composite(phone, (526, 250))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "800x800_浮层卡片_打破信息差.jpg"
    canvas.convert("RGB").save(out, quality=95, subsampling=0, optimize=True)
    return out


def main() -> None:
    print(compose())


if __name__ == "__main__":
    main()
