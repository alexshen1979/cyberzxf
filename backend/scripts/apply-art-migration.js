const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const sql = fs.readFileSync('prisma/migrations/20260519093000_art_admission/migration.sql', 'utf8')
  .replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ')
  .replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
  .replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ')
  .split(';')
  .map(stmt => stmt.trim())
  .filter(Boolean);

(async () => {
  for (const stmt of sql) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log(`art tables ready: ${sql.length}`);
})()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
