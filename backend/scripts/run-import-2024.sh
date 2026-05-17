#!/bin/bash
set -e
cd /Users/alexshen/00-Zhangshi/backend

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export YEAR=2024
export CONCURRENCY=1
export REQUEST_DELAY_MS=800
export RETRIES=6
export RETRY_DELAY_MS=3000
export RATE_LIMIT_COOLDOWN_MS=300000
export LOG_PROGRESS_EVERY=25
export RESUME=true

LOG_FILE="/tmp/gaokao-2024-import-$(date +%Y%m%d-%H%M%S).log"

echo "=== Starting 2024 admission scores import at $(date) ===" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE"

npx tsx scripts/import-gaokao-api-by-school.ts >> "$LOG_FILE" 2>&1

echo "=== Import finished at $(date) ===" | tee -a "$LOG_FILE"
