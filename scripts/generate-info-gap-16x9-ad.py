from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SRC = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9/ig_0007963843fc09c0016a25884aea088191a9a8c0d0975946c1.png"
OUT_DIR = ROOT / "mkt/pre-score-creatives/images/16x9-info-gap"
BG_OUT = OUT_DIR / "打破信息差_16x9_背景.png"
FINAL_OUT = OUT_DIR / "打破信息差_志愿填报不迷茫_16x9.jpg"
CLEAN_OUT = OUT_DIR / "打破信息差_志愿填报不迷茫_16x9_纯标题.jpg"
EXACT_OUT = OUT_DIR / "打破信息差逗号版_志愿填报不迷茫_16x9.jpg"

W, H = 1920, 1080
FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")


def cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_rectangle_layer(size: tuple[int, int], xy: tuple[int, int, int, int], radius: int, fill: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(xy, radius=radius, fill=fill)
    return layer


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.FreeTypeFont, fill: str, spacing: int = 18) -> None:
    x, y = xy
    for line in text.split("\n"):
      draw.text((x, y), line, font=font, fill=fill)
      bbox = draw.textbbox((x, y), line, font=font)
      y += bbox[3] - bbox[1] + spacing


def compose_base(bg: Image.Image) -> Image.Image:
    canvas = bg.convert("RGBA")

    # Subtle left readability wash, kept broad so it does not look like a nested card.
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wash_px = wash.load()
    for x in range(W):
        alpha = int(max(0, 178 * (1 - x / 1180)))
        for y in range(H):
            wash_px[x, y] = (255, 255, 255, alpha)
    return Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(18)))


def draw_main_title(canvas: Image.Image, exact: bool = False) -> None:
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(str(FONT_BOLD), 104 if exact else 112)
    accent = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.rounded_rectangle((136, 238, 226, 250), radius=6, fill=(124, 58, 237, 255))
    accent_draw.rounded_rectangle((234, 238, 310, 250), radius=6, fill=(20, 184, 166, 255))
    accent_draw.rounded_rectangle((318, 238, 380, 250), radius=6, fill=(245, 158, 11, 255))
    canvas.alpha_composite(accent)
    draw_text(
        draw,
        (132, 294),
        "打破信息差，\n志愿填报不迷茫" if exact else "打破信息差\n志愿填报不迷茫",
        title_font,
        "#17112f",
        spacing=36 if exact else 34,
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bg = cover_resize(Image.open(SRC).convert("RGB"), (W, H))
    bg.save(BG_OUT)

    clean = compose_base(bg)
    draw_main_title(clean)
    clean.convert("RGB").save(CLEAN_OUT, quality=95, subsampling=0, optimize=True)

    exact = compose_base(bg)
    draw_main_title(exact, exact=True)
    exact.convert("RGB").save(EXACT_OUT, quality=95, subsampling=0, optimize=True)

    canvas = compose_base(bg)
    draw_main_title(canvas)

    # Quiet brand/CTA strip.
    canvas = Image.alpha_composite(
        canvas,
        rounded_rectangle_layer((W, H), (136, 825, 486, 900), 28, (35, 23, 72, 222)),
    )

    draw = ImageDraw.Draw(canvas)
    sub_font = ImageFont.truetype(str(FONT_LIGHT), 42)
    cta_font = ImageFont.truetype(str(FONT_BOLD), 38)

    draw.text((140, 842), "涨识 AI 志愿分析", font=cta_font, fill="#ffffff")
    draw.text((136, 930), "出分前先做预案  出分后少走弯路", font=sub_font, fill="#3a315f")

    final = canvas.convert("RGB")
    final.save(FINAL_OUT, quality=95, subsampling=0, optimize=True)
    print(FINAL_OUT)
    print(CLEAN_OUT)
    print(EXACT_OUT)
    print(BG_OUT)


if __name__ == "__main__":
    main()
