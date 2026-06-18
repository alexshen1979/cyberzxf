import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mkt/materials/videos/dbfb674028eed08cb9de463589fa7671.mp4"
LOGO = ROOT / "miniprogram/src/static/images/brand-logo.png"
TEACHER = ROOT / "mkt/pre-score-creatives/videos/_premium-remotion-assets/images/digital-teacher-zhang.png"

PREMIUM_ASSETS = ROOT / "mkt/pre-score-creatives/videos/_premium-remotion-assets"
PUBLIC_ASSETS = ROOT / "mkt/remotion-premium/public/assets"


CREATIVES = [
    {
        "id": "01",
        "slug": "pre_score_plan",
        "segments": [(0, 12, 1.45), (22, 8, 16.0), (30, 7, 1.65)],
        "voice": "出分前别只等分数。先做一版志愿预案，把专业方向、院校层次和风险点提前看清。",
    },
    {
        "id": "02",
        "slug": "info_gap_qa",
        "segments": [(80, 3, 1.2), (83, 9, 12.0), (92, 18, 1.85)],
        "voice": "志愿填报最怕信息差。不懂学校和专业，就直接问，院校层次、城市资源、风险点一次讲清。",
    },
    {
        "id": "03",
        "slug": "save_report",
        "segments": [(143, 10, 1.0), (153, 5, 1.75)],
        "voice": "现在先把分析报告和候选池存好。等分数出来，再按位次快速调整，填报节奏会稳很多。",
    },
]


TARGET_DURATION = 15.0


def run(command: list[str]) -> None:
    print(" ".join(command))
    subprocess.run(command, cwd=ROOT, check=True)


def ensure_dirs() -> None:
    for path in [
        PREMIUM_ASSETS / "product-clips",
        PREMIUM_ASSETS / "audio",
        PREMIUM_ASSETS / "images",
        PUBLIC_ASSETS / "product",
        PUBLIC_ASSETS / "audio",
    ]:
        path.mkdir(parents=True, exist_ok=True)


def make_product_clip(creative: dict) -> Path:
    out = PREMIUM_ASSETS / "product-clips" / f"{creative['id']}_{creative['slug']}.mp4"
    filters = []
    labels = []
    total = 0.0
    for index, (start, duration, speed) in enumerate(creative["segments"]):
        label = f"seg{index}"
        filters.append(
            f"[0:v]trim=start={start}:duration={duration},setpts=(PTS-STARTPTS)/{speed},"
            f"scale=448:960,setsar=1,fps=30,format=yuv420p[{label}]"
        )
        labels.append(f"[{label}]")
        total += duration / speed

    if len(labels) == 1:
        chain = f"{labels[0]}copy[screen0]"
    else:
        chain = f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0[screen0]"

    hold = max(0.0, TARGET_DURATION - total)
    chain += f";[screen0]tpad=stop_mode=clone:stop_duration={hold:.3f}[outv]"

    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(SOURCE),
            "-filter_complex",
            ";".join(filters + [chain]),
            "-map",
            "[outv]",
            "-t",
            f"{TARGET_DURATION:.3f}",
            "-r",
            "30",
            "-an",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-preset",
            "medium",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out),
        ]
    )
    return out


def make_voice(creative: dict) -> Path:
    aiff = PREMIUM_ASSETS / "audio" / f"{creative['id']}_{creative['slug']}.aiff"
    out = PREMIUM_ASSETS / "audio" / f"{creative['id']}_{creative['slug']}.m4a"
    voice_text = creative["voice"]

    try:
        run(["say", "-v", "Tingting", "-r", "176", voice_text, "-o", str(aiff)])
    except subprocess.CalledProcessError:
        run(["say", "-r", "176", voice_text, "-o", str(aiff)])

    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(aiff),
            "-af",
            "apad=whole_dur=15,atrim=0:15,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(out),
        ]
    )
    return out


def copy_public_assets(product_clip: Path, voice: Path, creative: dict) -> None:
    shutil.copy2(product_clip, PUBLIC_ASSETS / "product" / f"{creative['id']}.mp4")
    shutil.copy2(voice, PUBLIC_ASSETS / "audio" / f"{creative['id']}.m4a")
    shutil.copy2(LOGO, PUBLIC_ASSETS / "brand-logo.png")
    shutil.copy2(TEACHER, PUBLIC_ASSETS / "digital-teacher-zhang.png")


def main() -> None:
    ensure_dirs()
    for creative in CREATIVES:
        product_clip = make_product_clip(creative)
        voice = make_voice(creative)
        copy_public_assets(product_clip, voice, creative)

    print("Premium Remotion assets prepared.")


if __name__ == "__main__":
    main()
