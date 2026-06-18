#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 "$ROOT/scripts/generate-cosyvoice-premium-audio.py" \
  --voice longanwen_v3 \
  --model cosyvoice-v3-flash \
  --rate 0.93 \
  --pitch 1.0

"$ROOT/scripts/render-premium-no-digital-videos.sh"
