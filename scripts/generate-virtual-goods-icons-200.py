#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "mkt" / "virtual-payment-goods" / "compact-200"
LOGO_PATH = ROOT / "miniprogram" / "src" / "static" / "images" / "brand-logo.png"
SIZE = 200


@dataclass(frozen=True)
class Package:
    product_id: str
    points: str
    accent: str
    dark: str
    pale: str


PACKAGES = [
    Package("pkg_120", "120", "#12B981", "#0F766E", "#E9FFF8"),
    Package("pkg_280", "280", "#2563EB", "#1D4ED8", "#EEF5FF"),
    Package("pkg_560", "560", "#F59E0B", "#B45309", "#FFF7E6"),
    Package("pkg_1000", "1000", "#E11D48", "#9F1239", "#FFF1F4"),
]


FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


F_NUM = font(58)
F_NUM_LONG = font(44)
F_UNIT = font(18)
F_LABEL = font(17)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def gradient(top: str, bottom: str) -> Image.Image:
    top_rgb = hex_to_rgb(top)
    bottom_rgb = hex_to_rgb(bottom)
    img = Image.new("RGB", (SIZE, SIZE), top_rgb)
    draw = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        rgb = tuple(lerp(top_rgb[i], bottom_rgb[i], t) for i in range(3))
        draw.line([(0, y), (SIZE, y)], fill=rgb)
    return img.convert("RGBA")


def text_size(draw: ImageDraw.ImageDraw, text: str, font_obj: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font_obj)
    return box[2] - box[0], box[3] - box[1]


def paste_logo(img: Image.Image) -> None:
    logo_size = 34
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (logo_size, logo_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, logo_size, logo_size), radius=8, fill=255)
    logo.putalpha(ImageChops.multiply(logo.getchannel("A"), mask))
    img.alpha_composite(logo, (18, 18))


def draw_book(draw: ImageDraw.ImageDraw, accent: str) -> None:
    rgb = hex_to_rgb(accent)
    line = (*rgb, 165)
    fill = (*rgb, 20)
    draw.rounded_rectangle((58, 54, 142, 104), radius=12, fill=fill, outline=line, width=3)
    draw.line((100, 59, 100, 101), fill=line, width=2)
    draw.arc((42, 32, 158, 142), 204, 336, fill=(*rgb, 45), width=7)
    draw.arc((50, 40, 150, 132), 204, 336, fill=(*rgb, 55), width=3)
    for x, y, r in [(154, 42, 3), (42, 128, 3), (155, 144, 2)]:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*rgb, 120))


def draw_icon(pkg: Package) -> Image.Image:
    img = gradient("#FFFFFF", pkg.pale)
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((104, -34, 254, 116), fill=(*hex_to_rgb(pkg.accent), 26))
    gd.ellipse((-50, 118, 102, 270), fill=(*hex_to_rgb(pkg.accent), 18))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((7, 7, 193, 193), radius=26, fill=(255, 255, 255, 224), outline=(226, 232, 240, 230), width=2)
    paste_logo(img)
    draw_book(draw, pkg.accent)

    num_font = F_NUM_LONG if len(pkg.points) >= 4 else F_NUM
    num_w, num_h = text_size(draw, pkg.points, num_font)
    unit_w, unit_h = text_size(draw, "点", F_UNIT)
    unit_gap = 7 if len(pkg.points) >= 4 else 4
    total_w = num_w + unit_w + unit_gap
    x = (SIZE - total_w) / 2
    y = 104 if len(pkg.points) >= 4 else 100
    draw.text((x, y), pkg.points, font=num_font, fill=pkg.dark)
    draw.text((x + num_w + unit_gap, y + num_h - unit_h - 6), "点", font=F_UNIT, fill=pkg.dark)

    label = "知识道具"
    label_w, _ = text_size(draw, label, F_LABEL)
    draw.rounded_rectangle((50, 160, 150, 184), radius=12, fill=(*hex_to_rgb(pkg.dark), 232))
    draw.text(((SIZE - label_w) / 2, 162), label, font=F_LABEL, fill="white")
    return img.convert("RGB")


def save_preview(paths: list[Path]) -> Path:
    gap = 14
    preview = Image.new("RGB", (SIZE * 2 + gap * 3, SIZE * 2 + gap * 3), "#F8FAFC")
    for idx, path in enumerate(paths):
        x = gap + (idx % 2) * (SIZE + gap)
        y = gap + (idx // 2) * (SIZE + gap)
        preview.paste(Image.open(path).convert("RGB"), (x, y))
    out = OUT_DIR / "00_goods_icons_200_preview.jpg"
    preview.save(out, quality=94, optimize=True)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for pkg in PACKAGES:
        out = OUT_DIR / f"{pkg.product_id}_knowledge_prop_200.png"
        draw_icon(pkg).save(out, optimize=True)
        paths.append(out)
        print(out.relative_to(ROOT))
    print(save_preview(paths).relative_to(ROOT))


if __name__ == "__main__":
    main()
