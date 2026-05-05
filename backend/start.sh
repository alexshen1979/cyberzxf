#!/bin/sh
set -e
echo "📦 运行数据库迁移..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
echo "🌱 检查种子数据..."
npx tsx prisma/seed.ts 2>/dev/null || echo "⚠️  种子数据可能已存在"
echo "🚀 启动服务..."
exec node dist/app.js
