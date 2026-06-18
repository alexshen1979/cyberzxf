from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GEN = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9"
SCREEN_DIR = ROOT / "mkt/pre-score-creatives/images/16x9-screenshots/source-screens"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"

FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")

ARTBOARDS = [
    {
        "name": "01_AI志愿分析",
        "bg": GEN / "ig_0007963843fc09c0016a258cf3b9c481918283b64e85a7b483.png",
        "screen": SCREEN_DIR / "source_2.jpg",
    },
    {
        "name": "02_志愿分析报告",
        "bg": GEN / "ig_0007963843fc09c0016a258d98b3b0819192606470fd8d491d.png",
        "screen": SCREEN_DIR / "source_3_report.jpg",
    },
    {
        "name": "03_AI追问",
        "bg": GEN / "ig_0007963843fc09c0016a2590368b1c8191813e8b7c7df5f25d.png",
        "screen": SCREEN_DIR / "source_1.jpg",
    },
]

LAYOUTS = {
    "9x16": {
        "size": (1080, 1920),
        "out_dir": ROOT / "mkt/pre-score-creatives/images/9x16-real-screens-clean",
    },
    "20x7": {
        "size": (2000, 700),
        "out_dir": ROOT / "mkt/pre-score-creatives/images/20x7-real-screens-clean",
    },
}


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


def draw_line(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    stroke_width: int,
) -> int:
    draw.text(
        xy,
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=(255, 255, 255, 224),
    )
    return text_size(draw, text, font)[1]


def apply_background(bg_path: Path, size: tuple[int, int], layout: str) -> Image.Image:
    w, h = size
    focus = (0.42, 0.5) if layout == "9x16" else (0.5, 0.56)
    bg = cover_resize(Image.open(bg_path).convert("RGB"), size, focus=focus).convert("RGBA")
    bg = bg.filter(ImageFilter.GaussianBlur(1.2 if layout == "20x7" else 1.8))
    canvas = Image.alpha_composite(bg, Image.new("RGBA", size, (255, 255, 255, 48)))

    wash = Image.new("RGBA", size, (0, 0, 0, 0))
    px = wash.load()
    if layout == "9x16":
        for y in range(h):
            top_alpha = int(max(0, 230 * (1 - y / 880)))
            bottom_alpha = int(max(0, 128 * ((y - 980) / 760)))
            alpha = max(42, top_alpha, min(128, bottom_alpha))
            for x in range(w):
                px[x, y] = (255, 255, 255, alpha)
    else:
        for x in range(w):
            left_alpha = int(max(0, 218 * (1 - x / 1040)))
            right_alpha = int(max(0, 244 * ((x - 1220) / 430)))
            alpha = max(32, left_alpha, min(244, right_alpha))
            for y in range(h):
                px[x, y] = (255, 255, 255, alpha)

    return Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(22)))


def paste_logo(canvas: Image.Image, xy: tuple[int, int], logo_size: int) -> None:
    badge_size = round(logo_size * 1.52)
    radius = round(badge_size * 0.25)
    logo = Image.open(LOGO).convert("RGBA").resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    badge = Image.new("RGBA", (badge_size, badge_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle((0, 0, badge_size - 1, badge_size - 1), radius=radius, fill=(255, 255, 255, 234))
    draw.rounded_rectangle((2, 2, badge_size - 3, badge_size - 3), radius=radius - 1, outline=(226, 232, 240, 230), width=2)

    logo_mask = rounded_mask((logo_size, logo_size), round(logo_size * 0.25))
    offset = (badge_size - logo_size) // 2
    badge.paste(logo, (offset, offset), logo_mask)
    canvas.alpha_composite(badge, xy)


def make_phone(screen_path: Path, inner_h: int) -> Image.Image:
    screen_src = Image.open(screen_path).convert("RGB")
    inner_w = round(inner_h * screen_src.width / screen_src.height)
    border = max(14, round(inner_h * 0.027))
    pad = max(38, round(inner_h * 0.068))
    outer_w = inner_w + border * 2
    outer_h = inner_h + border * 2
    layer = Image.new("RGBA", (outer_w + pad * 2, outer_h + pad * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    body_box = (pad, pad, pad + outer_w, pad + outer_h)
    radius = max(42, round(inner_h * 0.08))
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (pad + 14, pad + 20, pad + outer_w + 16, pad + outer_h + 24),
        radius=radius,
        fill=(24, 38, 68, 90),
    )
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(max(18, round(inner_h * 0.026)))))
    draw = ImageDraw.Draw(layer)

    draw.rounded_rectangle(body_box, radius=radius, fill=(14, 17, 22, 255))
    draw.rounded_rectangle(
        (pad + 3, pad + 3, pad + outer_w - 3, pad + outer_h - 3),
        radius=radius - 3,
        outline=(126, 134, 146, 150),
        width=3,
    )
    side_w = max(8, round(inner_h * 0.012))
    draw.rounded_rectangle(
        (pad + outer_w - 2, pad + round(inner_h * 0.2), pad + outer_w + side_w, pad + round(inner_h * 0.33)),
        radius=5,
        fill=(88, 93, 105, 210),
    )
    draw.rounded_rectangle(
        (pad - side_w, pad + round(inner_h * 0.24), pad + 2, pad + round(inner_h * 0.34)),
        radius=5,
        fill=(70, 76, 88, 180),
    )

    screen_box = (pad + border, pad + border, pad + border + inner_w, pad + border + inner_h)
    screen = screen_src.resize((inner_w, inner_h), Image.Resampling.LANCZOS).convert("RGBA")
    screen_mask = rounded_mask((inner_w, inner_h), max(28, round(inner_h * 0.052)))
    layer.paste(screen, (screen_box[0], screen_box[1]), screen_mask)
    draw.rounded_rectangle(
        screen_box,
        radius=max(28, round(inner_h * 0.052)),
        outline=(255, 255, 255, 208),
        width=2,
    )
    return layer


def draw_copy_9x16(canvas: Image.Image, variant: int) -> None:
    draw = ImageDraw.Draw(canvas)
    x = 82
    paste_logo(canvas, (78, 78), 86)

    brand_font = ImageFont.truetype(str(FONT_LIGHT), 66)
    title_font = ImageFont.truetype(str(FONT_BOLD), 114)
    title_font_big = ImageFont.truetype(str(FONT_BOLD), 132)

    if variant == 1:
        y = 272
        y += draw_line(draw, (x, y), "赛博张老师知识库，", brand_font, "#312e81", stroke_width=2) + 18
        y += draw_line(draw, (x, y), "助你", brand_font, "#312e81", stroke_width=2) + 44
        y += draw_line(draw, (x, y), "打破信息差，", title_font, "#130f2f", stroke_width=3) + 24
        draw_line(draw, (x, y), "志愿填报不迷茫", title_font, "#130f2f", stroke_width=3)
    else:
        y = 316
        y += draw_line(draw, (x, y), "打破信息差，", title_font_big, "#130f2f", stroke_width=3) + 34
        draw_line(draw, (x, y), "志愿填报不迷茫", title_font_big, "#130f2f", stroke_width=3)


def draw_copy_20x7(canvas: Image.Image, variant: int) -> None:
    draw = ImageDraw.Draw(canvas)
    paste_logo(canvas, (80, 64), 62)

    brand_font = ImageFont.truetype(str(FONT_LIGHT), 54)
    title_font = ImageFont.truetype(str(FONT_BOLD), 94)
    title_font_big = ImageFont.truetype(str(FONT_BOLD), 108)

    if variant == 1:
        x = 210
        y = 82
        y += draw_line(draw, (x, y), "赛博张老师知识库，", brand_font, "#312e81", stroke_width=2) + 12
        draw_line(draw, (x, y), "助你", brand_font, "#312e81", stroke_width=2)
        draw_line(draw, (92, 292), "打破信息差，志愿填报不迷茫", title_font, "#130f2f", stroke_width=3)
    else:
        draw_line(draw, (92, 266), "打破信息差，志愿填报不迷茫", title_font_big, "#130f2f", stroke_width=3)


def paste_phone_for_layout(canvas: Image.Image, screen_path: Path, layout: str) -> None:
    w, h = canvas.size
    if layout == "9x16":
        phone = make_phone(screen_path, inner_h=930)
        canvas.alpha_composite(phone, ((w - phone.width) // 2, 790))
    else:
        phone = make_phone(screen_path, inner_h=568)
        canvas.alpha_composite(phone, (1586, (h - phone.height) // 2))


def compose(artboard: dict[str, Path], variant: int, layout: str) -> Path:
    size = LAYOUTS[layout]["size"]
    out_dir = LAYOUTS[layout]["out_dir"]
    canvas = apply_background(artboard["bg"], size, layout)
    if layout == "9x16":
        draw_copy_9x16(canvas, variant)
    else:
        draw_copy_20x7(canvas, variant)
    paste_phone_for_layout(canvas, artboard["screen"], layout)

    variant_name = "版本1_知识库助你" if variant == 1 else "版本2_主标题"
    out = out_dir / f"{artboard['name']}_{variant_name}.jpg"
    canvas.convert("RGB").save(out, quality=95, subsampling=0, optimize=True)
    return out


def make_preview(outputs: list[Path], layout: str) -> Path:
    out_dir = LAYOUTS[layout]["out_dir"]
    margin = 18
    label_h = 38
    font = ImageFont.truetype(str(FONT_BOLD), 20)

    if layout == "9x16":
        thumb_w, thumb_h = 270, 480
        cols = 3
    else:
        thumb_w, thumb_h = 500, 175
        cols = 2

    rows = (len(outputs) + cols - 1) // cols
    sheet_w = thumb_w * cols + margin * (cols + 1)
    sheet_h = rows * (thumb_h + label_h) + margin * (rows + 1)
    sheet = Image.new("RGB", (sheet_w, sheet_h), "#f3f4f6")
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(outputs):
        col = index % cols
        row = index // cols
        x = margin + col * (thumb_w + margin)
        y = margin + row * (thumb_h + label_h + margin)
        img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(img, (x, y))
        draw.text((x, y + thumb_h + 9), path.stem, font=font, fill="#111827")

    out = out_dir / "00_六张预览.jpg"
    sheet.save(out, quality=94, subsampling=0, optimize=True)
    return out


def main() -> None:
    for layout in LAYOUTS:
        LAYOUTS[layout]["out_dir"].mkdir(parents=True, exist_ok=True)
        outputs: list[Path] = []
        for artboard in ARTBOARDS:
            for variant in (1, 2):
                outputs.append(compose(artboard, variant, layout))
        preview = make_preview(outputs, layout)
        print(preview)
        for output in outputs:
            print(output)


if __name__ == "__main__":
    main()
