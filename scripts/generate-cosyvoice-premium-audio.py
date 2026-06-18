import argparse
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "mkt/pre-score-creatives/videos/_premium-remotion-assets"
PUBLIC_AUDIO = ROOT / "mkt/remotion-premium/public/assets/audio"

CREATIVES = [
    {
        "id": "01",
        "slug": "pre_score_plan",
        "text": "出分前，别只等分数。先做一版志愿预案，把专业方向、院校层次和风险点提前看清。",
    },
    {
        "id": "02",
        "slug": "info_gap_qa",
        "text": "志愿填报，最怕信息差。不懂学校和专业，就直接问。院校层次、城市资源、风险点，一次讲清。",
    },
    {
        "id": "03",
        "slug": "save_report",
        "text": "现在先把分析报告和候选池存好。等分数出来，再按位次快速调整，填报节奏会稳很多。",
    },
]


def request_tts(text: str, api_key: str, voice: str, model: str, rate: float, pitch: float) -> str:
    payload = {
        "model": model,
        "input": {
            "text": text,
            "voice": voice,
            "format": "wav",
            "sample_rate": 24000,
            "volume": 65,
            "rate": rate,
            "pitch": pitch,
            "language_hints": ["zh"],
            "instruction": "用自然、可信赖的教育咨询口吻朗读，语气温和从容，不要像促销叫卖。",
        },
    }
    req = urllib.request.Request(
        "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"CosyVoice request failed: HTTP {exc.code}: {body}") from exc

    audio = data.get("output", {}).get("audio", {})
    url = audio.get("url")
    if not url:
        raise RuntimeError(f"CosyVoice response did not include an audio URL: {data}")
    return url


def download(url: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp:
        out.write_bytes(resp.read())


def normalize_audio(src: Path, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(src),
            "-af",
            "apad=whole_dur=15,atrim=0:15,loudnorm=I=-16:TP=-1.5:LRA=10",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(out),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate natural CosyVoice narration for the premium Remotion ads.")
    parser.add_argument("--voice", default="longanwen_v3", help="CosyVoice system voice. Default: longanwen_v3")
    parser.add_argument("--model", default="cosyvoice-v3-flash", help="CosyVoice model. Default: cosyvoice-v3-flash")
    parser.add_argument("--rate", type=float, default=0.93, help="Speech rate. Default: 0.93")
    parser.add_argument("--pitch", type=float, default=1.0, help="Pitch. Default: 1.0")
    args = parser.parse_args()

    api_key = os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("BAILIAN_API_KEY")
    if not api_key:
        raise SystemExit("Please set DASHSCOPE_API_KEY or BAILIAN_API_KEY in the shell. Do not write the key into this script.")

    raw_dir = ASSETS / "audio-cosyvoice-raw"
    final_dir = ASSETS / "audio-cosyvoice"
    for creative in CREATIVES:
        audio_url = request_tts(creative["text"], api_key, args.voice, args.model, args.rate, args.pitch)
        raw = raw_dir / f"{creative['id']}_{creative['slug']}_{args.voice}.wav"
        final = final_dir / f"{creative['id']}_{creative['slug']}_{args.voice}.m4a"
        download(audio_url, raw)
        normalize_audio(raw, final)
        shutil.copy2(final, PUBLIC_AUDIO / f"{creative['id']}.m4a")
        print(final)


if __name__ == "__main__":
    main()
