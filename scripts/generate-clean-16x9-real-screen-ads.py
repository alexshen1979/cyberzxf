from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GEN = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9"
OUT_DIR = ROOT / "mkt/pre-score-creatives/images/16x9-real-screens-clean"
SCREEN_DIR = ROOT / "mkt/pre-score-creatives/images/16x9-screenshots/source-screens"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"

W, H = 1920, 1080
FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")

ARTBOARDS = [
    {
        "name": "01_AI志愿分析",
        "bg": GEN / "ig_0007963843fc09c0016a258cf3b9c481918283b64e85a7b483.png",
        "screen": SCREEN_DIR / "source_2.jpg",
        "phone_xy": (1290, 70),
    },
    {
        "name": "02_志愿分析报告",
        "bg": GEN / "ig_0007963843fc09c0016a258d98b3b0819192606470fd8d491d.png",
        "screen": SCREEN_DIR / "source_3_report.jpg",
        "phone_xy": (1288, 70),
    },
    {
        "name": "03_AI追问",
        "bg": GEN / "ig_0007963843fc09c0016a2590368b1c8191813e8b7c7df5f25d.png",
        "screen": SCREEN_DIR / "source_1.jpg",
        "phone_xy": (1294, 70),
    },
]


def cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def text_metrics(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_line(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    stroke_width: int = 3,
) -> int:
    draw.text(
        xy,
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=(255, 255, 255, 220),
    )
    return text_metrics(draw, text, font)[1]


def apply_background_treatment(bg_path: Path) -> Image.Image:
    bg = cover_resize(Image.open(bg_path).convert("RGB"), (W, H)).convert("RGBA")
    bg = bg.filter(ImageFilter.GaussianBlur(1.0))

    canvas = Image.alpha_composite(bg, Image.new("RGBA", (W, H), (255, 255, 255, 34)))

    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = wash.load()
    for x in range(W):
        left_alpha = int(max(0, 232 * (1 - x / 1050)))
        right_alpha = int(max(0, 238 * ((x - 940) / 420)))
        alpha = max(left_alpha, min(238, right_alpha))
        for y in range(H):
            px[x, y] = (255, 255, 255, alpha)
    return Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(22)))


def paste_logo(canvas: Image.Image) -> None:
    logo = Image.open(LOGO).convert("RGBA").resize((78, 78), Image.Resampling.LANCZOS)
    badge = Image.new("RGBA", (118, 118), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((0, 0, 118, 118), radius=30, fill=(255, 255, 255, 232))
    draw.rounded_rectangle((2, 2, 116, 116), radius=29, outline=(226, 232, 240, 230), width=2)
    icon_mask = rounded_mask((78, 78), 20)
    badge.paste(logo, (20, 20), Image.composite(logo.getchannel("A"), icon_mask, icon_mask))
    canvas.alpha_composite(badge, (118, 86))


def make_phone(screen_path: Path, inner_h: int = 904) -> Image.Image:
    screen_src = Image.open(screen_path).convert("RGB")
    inner_w = round(inner_h * screen_src.width / screen_src.height)
    border = 24
    outer_w = inner_w + border * 2
    outer_h = inner_h + border * 2
    pad = 62
    layer = Image.new("RGBA", (outer_w + pad * 2, outer_h + pad * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    body_box = (pad, pad, pad + outer_w, pad + outer_h)

    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (pad + 16, pad + 22, pad + outer_w + 18, pad + outer_h + 26),
        radius=76,
        fill=(24, 38, 68, 86),
    )
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(24)))
    draw = ImageDraw.Draw(layer)

    draw.rounded_rectangle(body_box, radius=72, fill=(14, 17, 22, 255))
    draw.rounded_rectangle((pad + 3, pad + 3, pad + outer_w - 3, pad + outer_h - 3), radius=69, outline=(120, 128, 140, 150), width=3)
    draw.rounded_rectangle((pad + outer_w - 3, pad + 182, pad + outer_w + 8, pad + 294), radius=5, fill=(88, 93, 105, 210))
    draw.rounded_rectangle((pad - 8, pad + 214, pad + 2, pad + 304), radius=5, fill=(70, 76, 88, 180))

    screen_box = (pad + border, pad + border, pad + border + inner_w, pad + border + inner_h)
    screen = screen_src.resize((inner_w, inner_h), Image.Resampling.LANCZOS).convert("RGBA")
    screen_mask = rounded_mask((inner_w, inner_h), 48)
    layer.paste(screen, (screen_box[0], screen_box[1]), screen_mask)
    draw.rounded_rectangle(screen_box, radius=48, outline=(255, 255, 255, 210), width=2)

    return layer


def paste_phone(canvas: Image.Image, screen_path: Path, xy: tuple[int, int]) -> None:
    phone = make_phone(screen_path)
    canvas.alpha_composite(phone, (xy[0] - 62, xy[1] - 62))


def draw_copy(canvas: Image.Image, variant: int) -> None:
    draw = ImageDraw.Draw(canvas)
    x = 122

    brand_font = ImageFont.truetype(str(FONT_LIGHT), 76)
    title_font = ImageFont.truetype(str(FONT_BOLD), 120)
    title_font_big = ImageFont.truetype(str(FONT_BOLD), 142)

    if variant == 1:
        y = 268
        y += draw_line(draw, (x, y), "赛博张老师知识库，", brand_font, "#312e81", stroke_width=3) + 22
        y += draw_line(draw, (x, y), "助你", brand_font, "#312e81", stroke_width=3) + 42
        y += draw_line(draw, (x, y), "打破信息差，", title_font, "#130f2f", stroke_width=4) + 24
        draw_line(draw, (x, y), "志愿填报不迷茫", title_font, "#130f2f", stroke_width=4)
    else:
        y = 368
        y += draw_line(draw, (x, y), "打破信息差，", title_font_big, "#130f2f", stroke_width=4) + 34
        draw_line(draw, (x, y), "志愿填报不迷茫", title_font_big, "#130f2f", stroke_width=4)


def compose(artboard: dict[str, object], variant: int) -> Path:
    canvas = apply_background_treatment(artboard["bg"])
    paste_logo(canvas)
    draw_copy(canvas, variant)
    paste_phone(canvas, artboard["screen"], artboard["phone_xy"])

    variant_name = "版本1_知识库助你" if variant == 1 else "版本2_主标题"
    out = OUT_DIR / f"{artboard['name']}_{variant_name}.jpg"
    canvas.convert("RGB").save(out, quality=95, subsampling=0, optimize=True)
    return out


def make_preview(outputs: list[Path]) -> Path:
    thumb_w, thumb_h = 640, 360
    margin = 18
    label_h = 42
    font = ImageFont.truetype(str(FONT_BOLD), 22)
    sheet = Image.new("RGB", (thumb_w * 2 + margin * 3, (thumb_h + label_h) * 3 + margin * 4), "#f3f4f6")
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(outputs):
        col = index % 2
        row = index // 2
        x = margin + col * (thumb_w + margin)
        y = margin + row * (thumb_h + label_h + margin)
        img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(img, (x, y))
        draw.text((x, y + thumb_h + 10), path.stem, font=font, fill="#111827")

    out = OUT_DIR / "00_六张预览.jpg"
    sheet.save(out, quality=94, subsampling=0, optimize=True)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for artboard in ARTBOARDS:
        for variant in (1, 2):
            outputs.append(compose(artboard, variant))
    outputs.insert(0, make_preview(outputs))
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
