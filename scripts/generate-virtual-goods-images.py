#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "mkt" / "virtual-payment-goods"
LOGO_PATH = ROOT / "miniprogram" / "src" / "static" / "images" / "brand-logo.png"

SIZE = 800


@dataclass(frozen=True)
class Package:
    product_id: str
    total_points: int
    base_points: int
    bonus_points: int
    price: str
    price_cents: int
    badge: str
    scene: str
    detail: str
    palette: tuple[str, str, str, str]


PACKAGES = [
    Package(
        "pkg_120",
        120,
        120,
        0,
        "29.90",
        2990,
        "首充体验包",
        "适合出分前先准备",
        "生成报告后继续追问",
        ("#10B981", "#0F766E", "#E9FFF8", "#F59E0B"),
    ),
    Package(
        "pkg_280",
        280,
        240,
        40,
        "59.90",
        5990,
        "推荐套餐",
        "志愿季集中使用",
        "院校专业多轮对比",
        ("#2563EB", "#1D4ED8", "#EEF5FF", "#22C55E"),
    ),
    Package(
        "pkg_560",
        560,
        480,
        80,
        "99.90",
        9990,
        "志愿季热选",
        "多省多校反复比较",
        "高频咨询更从容",
        ("#F59E0B", "#B45309", "#FFF8E7", "#EF4444"),
    ),
    Package(
        "pkg_1000",
        1000,
        800,
        200,
        "169.90",
        16990,
        "家庭规划包",
        "长期升学咨询规划",
        "全家一起少走弯路",
        ("#E11D48", "#9F1239", "#FFF1F4", "#0EA5E9"),
    ),
]


FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size, index=index)
    return ImageFont.load_default()


F_BRAND = font(30)
F_BADGE = font(30)
F_POINTS = font(152)
F_UNIT = font(50)
F_TITLE = font(44)
F_MED = font(34)
F_PRICE = font(64)
F_PRICE_SMALL = font(34)
F_FOOT = font(24)
F_ID = font(22)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def vertical_gradient(width: int, height: int, top: str, bottom: str) -> Image.Image:
    top_rgb = hex_to_rgb(top)
    bottom_rgb = hex_to_rgb(bottom)
    img = Image.new("RGB", (width, height), top_rgb)
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(1, height - 1)
        rgb = tuple(lerp(top_rgb[i], bottom_rgb[i], t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=rgb)
    return img.convert("RGBA")


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: str | tuple[int, int, int, int],
    outline: str | tuple[int, int, int, int] | None = None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def paste_rounded(base: Image.Image, src: Image.Image, xy: tuple[int, int], size: tuple[int, int], radius: int) -> None:
    src = src.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *size), radius=radius, fill=255)
    src.putalpha(ImageChops.multiply(src.getchannel("A"), mask))
    base.alpha_composite(src, xy)


def text_width(draw: ImageDraw.ImageDraw, text: str, font_obj: ImageFont.ImageFont) -> int:
    box = draw.textbbox((0, 0), text, font=font_obj)
    return box[2] - box[0]


def center_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font_obj: ImageFont.ImageFont,
    fill: str | tuple[int, int, int, int],
    x_center: int = SIZE // 2,
) -> None:
    box = draw.textbbox((0, 0), text, font=font_obj)
    draw.text((x_center - (box[2] - box[0]) / 2, y), text, font=font_obj, fill=fill)


def draw_soft_circle(
    layer: Image.Image,
    center: tuple[int, int],
    radius: int,
    color: tuple[int, int, int, int],
    blur: int = 26,
) -> None:
    circle = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(circle)
    x, y = center
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    layer.alpha_composite(circle.filter(ImageFilter.GaussianBlur(blur)))


def draw_logo_header(img: Image.Image, draw: ImageDraw.ImageDraw) -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    paste_rounded(img, logo, (64, 60), (74, 74), 18)
    draw.text((154, 70), "涨识", font=font(40), fill="#111827")
    draw.text((154, 112), "赛博张老师知识库", font=F_BRAND, fill="#475569")


def draw_price(draw: ImageDraw.ImageDraw, price: str, accent: str, y: int) -> None:
    prefix = "¥"
    price_x = SIZE // 2 - (text_width(draw, prefix, F_PRICE_SMALL) + text_width(draw, price, F_PRICE)) // 2
    draw.text((price_x, y + 18), prefix, font=F_PRICE_SMALL, fill=accent)
    draw.text((price_x + text_width(draw, prefix, F_PRICE_SMALL) + 4, y), price, font=F_PRICE, fill=accent)


def draw_package(pkg: Package) -> Image.Image:
    accent, dark, pale, secondary = pkg.palette
    img = vertical_gradient(SIZE, SIZE, "#FFFFFF", pale)
    decor = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_soft_circle(decor, (650, 150), 170, (*hex_to_rgb(accent), 30))
    draw_soft_circle(decor, (115, 625), 210, (*hex_to_rgb(secondary), 22))
    img.alpha_composite(decor)

    draw = ImageDraw.Draw(img)
    rounded_rect(draw, (48, 48, 752, 752), 44, (255, 255, 255, 222), (226, 232, 240, 220), 2)

    for offset, alpha in [(0, 34), (18, 22), (36, 14)]:
        draw.arc(
            (520 + offset, 86 + offset, 825 + offset, 391 + offset),
            start=185,
            end=292,
            fill=(*hex_to_rgb(accent), alpha),
            width=18,
        )

    draw_logo_header(img, draw)

    badge_text = pkg.badge
    badge_w = text_width(draw, badge_text, F_BADGE) + 46
    rounded_rect(draw, (SIZE - 64 - badge_w, 70, SIZE - 64, 122), 26, accent)
    draw.text((SIZE - 64 - badge_w + 23, 78), badge_text, font=F_BADGE, fill="white")

    center_text(draw, 186, "咨询点数", F_TITLE, "#334155")

    points_text = str(pkg.total_points)
    points_w = text_width(draw, points_text, F_POINTS)
    unit_w = text_width(draw, "点", F_UNIT)
    start_x = SIZE // 2 - (points_w + unit_w + 10) // 2
    draw.text((start_x, 232), points_text, font=F_POINTS, fill=dark)
    draw.text((start_x + points_w + 10, 321), "点", font=F_UNIT, fill=dark)

    if pkg.bonus_points:
        sub = f"{pkg.base_points}点 + 赠{pkg.bonus_points}点"
    else:
        sub = "首充即得 120 点"
    center_text(draw, 404, sub, F_MED, "#64748B")

    draw_price(draw, pkg.price, dark, 466)

    info_y = 568
    rounded_rect(draw, (98, info_y, 702, info_y + 88), 28, (248, 250, 252, 244), (226, 232, 240, 255), 1)
    center_text(draw, info_y + 12, pkg.scene, F_MED, "#111827")
    center_text(draw, info_y + 50, pkg.detail, font(28), "#64748B")

    rounded_rect(draw, (132, 682, 668, 724), 21, (15, 23, 42, 232))
    center_text(draw, 689, "仅用于平台 AI 咨询服务  不可转让不可提现", F_FOOT, "white")

    draw.text((64, 728), pkg.product_id, font=F_ID, fill="#94A3B8")
    draw.text((SIZE - 64 - text_width(draw, "虚拟道具", F_ID), 728), "虚拟道具", font=F_ID, fill="#94A3B8")
    return img.convert("RGB")


def save_preview(paths: Iterable[Path]) -> Path:
    paths = list(paths)
    thumb_size = 330
    gap = 28
    label_h = 44
    preview = Image.new("RGB", (gap * 3 + thumb_size * 2, gap * 3 + (thumb_size + label_h) * 2), "#F8FAFC")
    draw = ImageDraw.Draw(preview)
    for idx, path in enumerate(paths):
        x = gap + (idx % 2) * (thumb_size + gap)
        y = gap + (idx // 2) * (thumb_size + label_h + gap)
        item = Image.open(path).convert("RGB").resize((thumb_size, thumb_size), Image.Resampling.LANCZOS)
        preview.paste(item, (x, y))
        draw.text((x, y + thumb_size + 10), path.name, font=font(20), fill="#334155")
    out = OUT_DIR / "00_goods_preview.jpg"
    preview.save(out, quality=94, optimize=True)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for pkg in PACKAGES:
        img = draw_package(pkg)
        filename = f"{pkg.product_id}_{pkg.total_points}咨询点数_{pkg.price_cents}.png"
        out = OUT_DIR / filename
        img.save(out, optimize=True)
        paths.append(out)
        print(out.relative_to(ROOT))
    preview = save_preview(paths)
    print(preview.relative_to(ROOT))


if __name__ == "__main__":
    main()
