from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GEN = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9"
OUT_DIR = ROOT / "mkt/pre-score-creatives/images/16x9-screenshots"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"

W, H = 1920, 1080
FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")

SOURCES = [
    ("01_志愿分析页", GEN / "ig_0007963843fc09c0016a258cf3b9c481918283b64e85a7b483.png"),
    ("02_报告页", GEN / "ig_0007963843fc09c0016a258d98b3b0819192606470fd8d491d.png"),
    ("03_AI追问页", GEN / "ig_0007963843fc09c0016a2590368b1c8191813e8b7c7df5f25d.png"),
]


def cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_multiline(draw: ImageDraw.ImageDraw, xy: tuple[int, int], lines: list[str], fonts: list[ImageFont.FreeTypeFont], fills: list[str], spacing: int) -> int:
    x, y = xy
    for line, font, fill in zip(lines, fonts, fills):
        draw.text((x, y), line, font=font, fill=fill)
        _, h = text_size(draw, line, font)
        y += h + spacing
    return y


def apply_left_wash(canvas: Image.Image) -> Image.Image:
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = wash.load()
    for x in range(W):
        alpha = int(max(0, 202 * (1 - x / 1040)))
        for y in range(H):
            px[x, y] = (255, 255, 255, alpha)
    return Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(22)))


def paste_logo(canvas: Image.Image, draw: ImageDraw.ImageDraw) -> None:
    logo = Image.open(LOGO).convert("RGBA").resize((78, 78), Image.Resampling.LANCZOS)
    badge = Image.new("RGBA", (380, 112), (255, 255, 255, 0))
    badge_draw = ImageDraw.Draw(badge)
    badge_draw.rounded_rectangle((0, 0, 380, 112), radius=34, fill=(255, 255, 255, 226))
    badge_draw.rounded_rectangle((1, 1, 379, 111), radius=34, outline=(226, 232, 240, 210), width=2)
    badge.alpha_composite(logo, (24, 17))
    brand_font = ImageFont.truetype(str(FONT_BOLD), 42)
    badge_draw.text((118, 32), "赛博张老师", font=brand_font, fill="#17112f")
    canvas.alpha_composite(badge, (120, 92))


def draw_accent(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rounded_rectangle((x, y, x + 112, y + 13), radius=6, fill="#7c3aed")
    draw.rounded_rectangle((x + 124, y, x + 226, y + 13), radius=6, fill="#14b8a6")
    draw.rounded_rectangle((x + 238, y, x + 318, y + 13), radius=6, fill="#f59e0b")


def compose(src: Path, name: str, variant: int) -> Path:
    bg = cover_resize(Image.open(src).convert("RGB"), (W, H)).convert("RGBA")
    canvas = apply_left_wash(bg)
    draw = ImageDraw.Draw(canvas)
    paste_logo(canvas, draw)

    title_font = ImageFont.truetype(str(FONT_BOLD), 118)
    title_font_big = ImageFont.truetype(str(FONT_BOLD), 136)
    pre_font = ImageFont.truetype(str(FONT_LIGHT), 58)
    small_font = ImageFont.truetype(str(FONT_LIGHT), 42)

    draw_accent(draw, 128, 274 if variant == 1 else 302)

    if variant == 1:
        lines = [
            "赛博张老师知识库，",
            "助你",
            "打破信息差，",
            "志愿填报不迷茫",
        ]
        fonts = [pre_font, pre_font, title_font, title_font]
        fills = ["#312e81", "#312e81", "#17112f", "#17112f"]
        y_end = draw_multiline(draw, (126, 330), lines, fonts, fills, spacing=20)
        draw.text((130, min(930, y_end + 16)), "出分前先准备  出分后少走弯路", font=small_font, fill="#4b587c")
        out = OUT_DIR / f"{name}_版本1_知识库助你.jpg"
    else:
        lines = ["打破信息差，", "志愿填报不迷茫"]
        fonts = [title_font_big, title_font_big]
        fills = ["#17112f", "#17112f"]
        y_end = draw_multiline(draw, (126, 370), lines, fonts, fills, spacing=32)
        draw.text((132, y_end + 26), "高考志愿先做预案", font=small_font, fill="#4b587c")
        out = OUT_DIR / f"{name}_版本2_主标题.jpg"

    canvas.convert("RGB").save(out, quality=95, subsampling=0, optimize=True)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES:
        for variant in (1, 2):
            print(compose(src, name, variant))


if __name__ == "__main__":
    main()
