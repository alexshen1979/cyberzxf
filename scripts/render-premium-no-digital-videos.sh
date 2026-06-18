#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTION_DIR="$ROOT/mkt/remotion-premium"

cd "$REMOTION_DIR"

npx remotion render src/index.ts 01-pre-score-plan-16x9-premium ../pre-score-creatives/videos/16x9-premium-no-digital-cosyvoice/01_出分前先做预案_no_digital_cosyvoice_16x9.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4
npx remotion render src/index.ts 02-info-gap-qa-16x9-premium ../pre-score-creatives/videos/16x9-premium-no-digital-cosyvoice/02_打破信息差AI追问_no_digital_cosyvoice_16x9.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4
npx remotion render src/index.ts 03-save-report-16x9-premium ../pre-score-creatives/videos/16x9-premium-no-digital-cosyvoice/03_报告先存好出分再调整_no_digital_cosyvoice_16x9.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4

npx remotion render src/index.ts 01-pre-score-plan-9x16-premium ../pre-score-creatives/videos/9x16-premium-no-digital-cosyvoice/01_出分前先做预案_no_digital_cosyvoice_9x16.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4
npx remotion render src/index.ts 02-info-gap-qa-9x16-premium ../pre-score-creatives/videos/9x16-premium-no-digital-cosyvoice/02_打破信息差AI追问_no_digital_cosyvoice_9x16.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4
npx remotion render src/index.ts 03-save-report-9x16-premium ../pre-score-creatives/videos/9x16-premium-no-digital-cosyvoice/03_报告先存好出分再调整_no_digital_cosyvoice_9x16.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --concurrency=4
