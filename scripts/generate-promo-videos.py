import subprocess
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mkt/materials/videos/dbfb674028eed08cb9de463589fa7671.mp4"
GEN = Path.home() / ".codex/generated_images/019ea08f-f549-72c1-992f-217a064099b9"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"
ASSET_DIR = ROOT / "mkt/pre-score-creatives/videos/_assets"
OUT_DIRS = {
    "16x9": ROOT / "mkt/pre-score-creatives/videos/16x9-real-screen-promos",
    "9x16": ROOT / "mkt/pre-score-creatives/videos/9x16-real-screen-promos",
}

FONT_BOLD = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT = Path("/System/Library/Fonts/STHeiti Light.ttc")

CREATIVES = [
    {
        "slug": "01_出分前先做预案",
        "bg": GEN / "ig_0007963843fc09c0016a258cf3b9c481918283b64e85a7b483.png",
        "segments": [(0, 18, 1.8), (22, 8, 16.0), (30, 6, 1.2)],
        "hold": 2.3,
        "title": ["出分前", "先做预案"],
        "subtitle": ["输入分数和位次", "先看范围与风险"],
        "cta": "打开小程序 先准备",
        "callouts": ["分数位次", "一键生成", "冲稳保预案"],
    },
    {
        "slug": "02_AI追问一次讲清",
        "bg": GEN / "ig_0007963843fc09c0016a2590368b1c8191813e8b7c7df5f25d.png",
        "segments": [(80, 3, 1.1), (83, 9, 10.0), (92, 24, 1.8)],
        "hold": 0.4,
        "title": ["不懂就问", "一次讲清"],
        "subtitle": ["院校层次 城市资源", "专业方向 风险点"],
        "cta": "AI追问 帮你理清",
        "callouts": ["院校层次", "城市资源", "风险讲清"],
    },
    {
        "slug": "03_报告先存好出分再调整",
        "bg": GEN / "ig_0007963843fc09c0016a258d98b3b0819192606470fd8d491d.png",
        "segments": [(143, 11, 0.85)],
        "hold": 3.0,
        "title": ["报告先存好", "出分再调整"],
        "subtitle": ["冲稳保 候选池", "专业风险一屏查看"],
        "cta": "提前收藏 少走弯路",
        "callouts": ["冲稳保", "候选池", "先收藏"],
    },
]

LAYOUTS = {
    "16x9": {
        "size": (1920, 1080),
        "phone_inner_h": 878,
        "phone_xy": (1272, 72),
    },
    "9x16": {
        "size": (1080, 1920),
        "phone_inner_h": 980,
        "phone_xy": None,
    },
}


def even(value: int) -> int:
    return value if value % 2 == 0 else value + 1


def cover_resize(img: Image.Image, size: tuple[int, int], focus: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    max_left = max(0, resized.width - target_w)
    max_top = max(0, resized.height - target_h)
    left = round(max_left * focus[0])
    top = round(max_top * focus[1])
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_mask(size: tuple[int, int], radius: int, fill: int = 255) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    return mask


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_text(
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
        stroke_fill=(255, 255, 255, 226),
    )
    return text_size(draw, text, font)[1]


def draw_chip(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font: ImageFont.FreeTypeFont, accent: str) -> None:
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=(255, 255, 255, 232), outline=(226, 232, 240, 230), width=2)
    dot_x = box[0] + 30
    dot_y = (box[1] + box[3]) // 2
    draw.ellipse((dot_x - 7, dot_y - 7, dot_x + 7, dot_y + 7), fill=accent)
    tw, th = text_size(draw, text, font)
    draw.text((box[0] + 52, box[1] + (box[3] - box[1] - th) // 2 - 1), text, font=font, fill="#130f2f")


def paste_logo(canvas: Image.Image, xy: tuple[int, int], logo_size: int) -> None:
    badge_size = round(logo_size * 1.54)
    badge = Image.new("RGBA", (badge_size, badge_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    radius = round(badge_size * 0.26)
    draw.rounded_rectangle((0, 0, badge_size - 1, badge_size - 1), radius=radius, fill=(255, 255, 255, 236))
    draw.rounded_rectangle((2, 2, badge_size - 3, badge_size - 3), radius=radius - 1, outline=(226, 232, 240, 230), width=2)

    logo = Image.open(LOGO).convert("RGBA").resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    logo_mask = rounded_mask((logo_size, logo_size), round(logo_size * 0.25))
    offset = (badge_size - logo_size) // 2
    badge.paste(logo, (offset, offset), logo_mask)
    canvas.alpha_composite(badge, xy)


def make_background(bg_path: Path, layout: str, out: Path) -> Path:
    w, h = LAYOUTS[layout]["size"]
    focus = (0.45, 0.54) if layout == "16x9" else (0.38, 0.52)
    bg = cover_resize(Image.open(bg_path).convert("RGB"), (w, h), focus=focus).convert("RGBA")
    bg = bg.filter(ImageFilter.GaussianBlur(1.4 if layout == "16x9" else 2.0))
    canvas = Image.alpha_composite(bg, Image.new("RGBA", (w, h), (255, 255, 255, 48 if layout == "16x9" else 66)))

    wash = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = wash.load()
    if layout == "16x9":
        for x in range(w):
            left_alpha = int(max(0, 224 * (1 - x / 1040)))
            right_alpha = int(max(0, 226 * ((x - 1100) / 520)))
            alpha = max(30, left_alpha, min(226, right_alpha))
            for y in range(h):
                px[x, y] = (255, 255, 255, alpha)
    else:
        for y in range(h):
            top_alpha = int(max(0, 234 * (1 - y / 720)))
            bottom_alpha = int(max(0, 156 * ((y - 980) / 680)))
            alpha = max(46, top_alpha, min(156, bottom_alpha))
            for x in range(w):
                px[x, y] = (255, 255, 255, alpha)

    canvas = Image.alpha_composite(canvas, wash.filter(ImageFilter.GaussianBlur(24)))
    canvas.convert("RGB").save(out, quality=94, subsampling=0)
    return out


def make_phone_frame(inner_h: int, out: Path) -> dict[str, Any]:
    inner_w = even(round(inner_h * 448 / 960))
    border = max(18, round(inner_h * 0.027))
    pad = max(44, round(inner_h * 0.068))
    outer_w = inner_w + border * 2
    outer_h = inner_h + border * 2
    frame_w = outer_w + pad * 2
    frame_h = outer_h + pad * 2

    layer = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    radius = max(44, round(inner_h * 0.079))
    shadow_draw.rounded_rectangle(
        (pad + 14, pad + 20, pad + outer_w + 16, pad + outer_h + 24),
        radius=radius,
        fill=(24, 38, 68, 94),
    )
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(max(18, round(inner_h * 0.028)))))
    draw = ImageDraw.Draw(layer)

    body_box = (pad, pad, pad + outer_w, pad + outer_h)
    screen_box = (pad + border, pad + border, pad + border + inner_w, pad + border + inner_h)
    draw.rounded_rectangle(body_box, radius=radius, fill=(14, 17, 22, 255))
    draw.rounded_rectangle((pad + 3, pad + 3, pad + outer_w - 3, pad + outer_h - 3), radius=radius - 3, outline=(128, 136, 148, 156), width=3)
    side_w = max(8, round(inner_h * 0.012))
    draw.rounded_rectangle((pad + outer_w - 2, pad + round(inner_h * 0.2), pad + outer_w + side_w, pad + round(inner_h * 0.33)), radius=5, fill=(88, 93, 105, 214))
    draw.rounded_rectangle((pad - side_w, pad + round(inner_h * 0.24), pad + 2, pad + round(inner_h * 0.34)), radius=5, fill=(70, 76, 88, 184))

    # Clear the rounded screen hole so the real recording shows through.
    alpha = layer.getchannel("A")
    hole = Image.new("L", (frame_w, frame_h), 0)
    hole_draw = ImageDraw.Draw(hole)
    hole_draw.rounded_rectangle(screen_box, radius=max(28, round(inner_h * 0.052)), fill=255)
    alpha.paste(0, (0, 0), hole)
    layer.putalpha(alpha)

    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(screen_box, radius=max(28, round(inner_h * 0.052)), outline=(255, 255, 255, 216), width=2)
    layer.save(out)
    return {
        "path": out,
        "frame_w": frame_w,
        "frame_h": frame_h,
        "screen_x": pad + border,
        "screen_y": pad + border,
        "screen_w": inner_w,
        "screen_h": inner_h,
    }


def make_text_overlay(creative: dict, layout: str, out: Path) -> Path:
    w, h = LAYOUTS[layout]["size"]
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if layout == "16x9":
        paste_logo(canvas, (118, 86), 76)
        brand = ImageFont.truetype(str(FONT_LIGHT), 50)
        title = ImageFont.truetype(str(FONT_BOLD), 128)
        sub = ImageFont.truetype(str(FONT_LIGHT), 48)
        cta_font = ImageFont.truetype(str(FONT_BOLD), 42)

        draw_text(draw, (250, 116), "赛博张老师知识库", brand, "#312e81", 2)
        y = 278
        for line in creative["title"]:
            y += draw_text(draw, (122, y), line, title, "#130f2f", 4) + 24
        draw.rounded_rectangle((126, y - 8, 252, y + 6), radius=7, fill="#7c3aed")
        draw.rounded_rectangle((270, y - 8, 384, y + 6), radius=7, fill="#14b8a6")
        draw.rounded_rectangle((402, y - 8, 500, y + 6), radius=7, fill="#f59e0b")
        y += 8
        for line in creative["subtitle"]:
            y += draw_text(draw, (128, y), line, sub, "#4b587c", 2) + 16

        pill = Image.new("RGBA", (456, 86), (0, 0, 0, 0))
        pill_draw = ImageDraw.Draw(pill)
        pill_draw.rounded_rectangle((0, 0, 455, 85), radius=43, fill=(19, 15, 47, 236))
        pill_draw.text((36, 21), creative["cta"], font=cta_font, fill="#ffffff")
        canvas.alpha_composite(pill, (122, 842))
    else:
        paste_logo(canvas, (78, 76), 82)
        brand = ImageFont.truetype(str(FONT_LIGHT), 42)
        title = ImageFont.truetype(str(FONT_BOLD), 116)
        sub = ImageFont.truetype(str(FONT_LIGHT), 43)
        cta_font = ImageFont.truetype(str(FONT_BOLD), 39)

        draw_text(draw, (205, 98), "赛博张老师知识库", brand, "#312e81", 2)
        y = 218
        for line in creative["title"]:
            y += draw_text(draw, (76, y), line, title, "#130f2f", 4) + 22
        draw.rounded_rectangle((80, y - 4, 206, y + 10), radius=7, fill="#7c3aed")
        draw.rounded_rectangle((224, y - 4, 338, y + 10), radius=7, fill="#14b8a6")
        draw.rounded_rectangle((356, y - 4, 454, y + 10), radius=7, fill="#f59e0b")
        y += 4
        for line in creative["subtitle"]:
            y += draw_text(draw, (82, y), line, sub, "#4b587c", 2) + 14

        pill_w = 460
        pill = Image.new("RGBA", (pill_w, 78), (0, 0, 0, 0))
        pill_draw = ImageDraw.Draw(pill)
        pill_draw.rounded_rectangle((0, 0, pill_w - 1, 77), radius=39, fill=(19, 15, 47, 236))
        tw, _ = text_size(pill_draw, creative["cta"], cta_font)
        pill_draw.text(((pill_w - tw) // 2, 19), creative["cta"], font=cta_font, fill="#ffffff")
        canvas.alpha_composite(pill, (76, 604))

    canvas.save(out)
    return out


def make_callout_overlay(text: str, layout: str, index: int, out: Path) -> Path:
    w, h = LAYOUTS[layout]["size"]
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    accents = ["#7c3aed", "#14b8a6", "#f59e0b"]

    if layout == "16x9":
        font = ImageFont.truetype(str(FONT_BOLD), 34)
        positions = [(122, 742), (366, 742), (610, 742)]
        chip_w, chip_h = 208, 64
    else:
        font = ImageFont.truetype(str(FONT_BOLD), 34)
        positions = [(74, 690), (350, 690), (626, 690)]
        chip_w, chip_h = 228, 62

    x, y = positions[index]
    draw_chip(draw, (x, y, x + chip_w, y + chip_h), text, font, accents[index % len(accents)])

    # A soft glow behind each pop-up makes the timeline feel less static.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle((x - 8, y - 8, x + chip_w + 8, y + chip_h + 8), radius=chip_h // 2 + 8, fill=(255, 255, 255, 112))
    canvas = Image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)), canvas)

    canvas.save(out)
    return out


def run_ffmpeg(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def compose_video(creative: dict, layout: str, bg_path: Path, frame_info: dict, text_path: Path, callout_paths: list[Path]) -> Path:
    w, h = LAYOUTS[layout]["size"]
    duration = sum(seg_duration / speed for _, seg_duration, speed in creative["segments"]) + creative.get("hold", 0)
    out_dir = OUT_DIRS[layout]
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{creative['slug']}_{layout}.mp4"

    if layout == "16x9":
        frame_x, frame_y = LAYOUTS[layout]["phone_xy"]
    else:
        frame_x = (w - int(frame_info["frame_w"])) // 2
        frame_y = 710

    screen_x = frame_x + int(frame_info["screen_x"])
    screen_y = frame_y + int(frame_info["screen_y"])
    sw = int(frame_info["screen_w"])
    sh = int(frame_info["screen_h"])

    segment_filters = []
    segment_labels = []
    for index, (start, seg_duration, speed) in enumerate(creative["segments"]):
        label = f"seg{index}"
        segment_filters.append(
            f"[0:v]trim=start={start}:duration={seg_duration},setpts=(PTS-STARTPTS)/{speed},"
            f"scale={sw}:{sh},setsar=1[{label}]"
        )
        segment_labels.append(f"[{label}]")

    if len(segment_labels) == 1:
        screen_chain = f"{segment_labels[0]}copy[screen0]"
    else:
        screen_chain = f"{''.join(segment_labels)}concat=n={len(segment_labels)}:v=1:a=0[screen0]"

    hold = creative.get("hold", 0)
    if hold:
        screen_chain += f";[screen0]tpad=stop_mode=clone:stop_duration={hold}[screen]"
    else:
        screen_chain += ";[screen0]copy[screen]"

    if layout == "16x9":
        bg_motion = (
            f"[1:v]scale={even(round(w * 1.045))}:{even(round(h * 1.045))},"
            f"crop={w}:{h}:x='(iw-{w})/2+12*sin(t*0.35)':y='(ih-{h})/2+8*cos(t*0.28)',format=rgba[bg]"
        )
        phone_x_expr = f"if(lt(t,0.45),{screen_x}+110*(1-t/0.45),{screen_x})"
        frame_x_expr = f"if(lt(t,0.45),{frame_x}+110*(1-t/0.45),{frame_x})"
        phone_y_expr = str(screen_y)
        frame_y_expr = str(frame_y)
        text_x_expr = "'if(lt(t,0.45),-44+44*t/0.45,0)'"
        text_y_expr = "0"
    else:
        bg_motion = (
            f"[1:v]scale={even(round(w * 1.045))}:{even(round(h * 1.045))},"
            f"crop={w}:{h}:x='(iw-{w})/2+8*sin(t*0.32)':y='(ih-{h})/2+14*cos(t*0.24)',format=rgba[bg]"
        )
        phone_x_expr = str(screen_x)
        frame_x_expr = str(frame_x)
        phone_y_expr = f"if(lt(t,0.45),{screen_y}+120*(1-t/0.45),{screen_y})"
        frame_y_expr = f"if(lt(t,0.45),{frame_y}+120*(1-t/0.45),{frame_y})"
        text_x_expr = "0"
        text_y_expr = "'if(lt(t,0.45),-36+36*t/0.45,0)'"

    filter_parts = [
        *segment_filters,
        screen_chain,
        bg_motion,
        f"[2:v]format=rgba[frame];"
        f"[3:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[text]"
    ]

    callout_labels = []
    callout_starts = [2.2, 5.6, 9.2]
    for i, _ in enumerate(callout_paths):
        st = callout_starts[i]
        end = min(duration - 0.35, st + 2.8)
        label = f"callout{i}"
        filter_parts.append(
            f"[{4 + i}:v]format=rgba,fade=t=in:st={st}:d=0.22:alpha=1,"
            f"fade=t=out:st={end}:d=0.22:alpha=1[{label}]"
        )
        callout_labels.append(label)

    compose_parts = [
        f"[bg][screen]overlay=x='{phone_x_expr}':y='{phone_y_expr}':eof_action=pass[tmp1]",
        f"[tmp1][frame]overlay=x='{frame_x_expr}':y='{frame_y_expr}':format=auto[tmp2]",
        f"[tmp2][text]overlay=x={text_x_expr}:y={text_y_expr}:format=auto[tmp3]",
    ]
    last_label = "tmp3"
    for i, label in enumerate(callout_labels):
        next_label = f"tmp_callout_{i}"
        compose_parts.append(f"[{last_label}][{label}]overlay=x=0:y=0:format=auto[{next_label}]")
        last_label = next_label
    compose_parts.append(f"[{last_label}]copy[outv]")

    filter_complex = ";".join(filter_parts + compose_parts)

    audio_input_index = 4 + len(callout_paths)

    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(SOURCE),
        "-loop",
        "1",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(bg_path),
        "-loop",
        "1",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(frame_info["path"]),
        "-loop",
        "1",
        "-t",
        f"{duration:.3f}",
        "-i",
        str(text_path),
    ]
    for path in callout_paths:
        command.extend([
            "-loop",
            "1",
            "-t",
            f"{duration:.3f}",
            "-i",
            str(path),
        ])
    command.extend([
        "-f",
        "lavfi",
        "-t",
        f"{duration:.3f}",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-filter_complex",
        filter_complex,
        "-map",
        "[outv]",
        "-map",
        f"{audio_input_index}:a",
        "-t",
        f"{duration:.3f}",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-crf",
        "21",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        str(out),
    ])
    run_ffmpeg(command)
    return out


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for out_dir in OUT_DIRS.values():
        out_dir.mkdir(parents=True, exist_ok=True)

    frame_infos = {}
    for layout, cfg in LAYOUTS.items():
        frame_infos[layout] = make_phone_frame(cfg["phone_inner_h"], ASSET_DIR / f"phone_frame_{layout}.png")

    outputs = []
    for creative in CREATIVES:
        for layout in ("16x9", "9x16"):
            bg = make_background(creative["bg"], layout, ASSET_DIR / f"{creative['slug']}_{layout}_bg.jpg")
            text = make_text_overlay(creative, layout, ASSET_DIR / f"{creative['slug']}_{layout}_text.png")
            callouts = [
                make_callout_overlay(label, layout, index, ASSET_DIR / f"{creative['slug']}_{layout}_callout_{index}.png")
                for index, label in enumerate(creative["callouts"])
            ]
            outputs.append(compose_video(creative, layout, bg, frame_infos[layout], text, callouts))

    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
