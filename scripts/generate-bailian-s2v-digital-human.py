import argparse
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "mkt/pre-score-creatives/videos/_premium-remotion-assets"


def run_json_request(url: str, headers: dict[str, str], payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def upload_file(path: Path, api_key: str) -> str:
    # DashScope/Bailian can parse local resources when they are uploaded as
    # temporary OSS files. Keep the key in memory only.
    command = [
        "curl",
        "-sS",
        "-X",
        "POST",
        "https://dashscope.aliyuncs.com/api/v1/files",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-F",
        f"file=@{path}",
        "-F",
        "purpose=file-extract",
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    response = json.loads(result.stdout)
    if "data" in response and isinstance(response["data"], dict):
        for key in ("url", "oss_url", "file_url"):
            if response["data"].get(key):
                return response["data"][key]
    for key in ("url", "oss_url", "file_url"):
        if response.get(key):
            return response[key]
    raise RuntimeError(f"Could not find uploaded file URL in response: {response}")


def submit_task(image_url: str, audio_url: str, api_key: str) -> str:
    payload = {
        "model": "wan2.2-s2v",
        "input": {
            "image_url": image_url,
            "audio_url": audio_url,
            "prompt": "A warm Chinese education consultant speaks naturally to camera. Stable face, natural lip sync, subtle head movement, premium commercial lighting.",
        },
        "parameters": {
            "resolution": "720P",
            "prompt_extend": True,
        },
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
        "X-DashScope-OssResourceResolve": "enable",
    }
    response = run_json_request("https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis", headers, payload)
    task_id = response.get("output", {}).get("task_id") or response.get("task_id")
    if not task_id:
        raise RuntimeError(f"Could not find task_id in response: {response}")
    return task_id


def wait_for_task(task_id: str, api_key: str) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-DashScope-OssResourceResolve": "enable",
    }
    url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
    for _ in range(120):
        response = run_json_request(url, headers)
        output = response.get("output", {})
        status = output.get("task_status") or response.get("task_status")
        if status in {"SUCCEEDED", "SUCCESS"}:
            results = output.get("results") or output.get("video_url") or response.get("video_url")
            if isinstance(results, str):
                return results
            if isinstance(results, list) and results:
                first = results[0]
                if isinstance(first, dict):
                    return first.get("url") or first.get("video_url")
            if isinstance(results, dict):
                return results.get("url") or results.get("video_url")
            raise RuntimeError(f"Task succeeded but video URL was not found: {response}")
        if status in {"FAILED", "CANCELED", "UNKNOWN"}:
            raise RuntimeError(f"Task failed: {response}")
        time.sleep(10)
    raise TimeoutError(f"Task did not finish in time: {task_id}")


def download(url: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp:
        out.write_bytes(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Bailian wan2.2-s2v digital-human clip for one premium ad.")
    parser.add_argument("--creative", choices=["01", "02", "03"], required=True)
    args = parser.parse_args()

    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise SystemExit("Please set DASHSCOPE_API_KEY in the shell. Do not write it into this script.")

    teacher = ASSETS / "images/digital-teacher-zhang.png"
    audio_candidates = sorted((ASSETS / "audio").glob(f"{args.creative}_*.m4a"))
    if not audio_candidates:
        raise SystemExit(f"Missing audio for creative {args.creative}. Run prepare-premium-remotion-assets.py first.")

    image_url = upload_file(teacher, api_key)
    audio_url = upload_file(audio_candidates[0], api_key)
    task_id = submit_task(image_url, audio_url, api_key)
    print(f"task_id={task_id}")
    video_url = wait_for_task(task_id, api_key)
    out = ASSETS / "digital-human" / f"{args.creative}.mp4"
    download(video_url, out)
    print(out)


if __name__ == "__main__":
    main()
