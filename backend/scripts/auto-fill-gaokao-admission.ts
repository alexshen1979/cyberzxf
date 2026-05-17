import { PrismaClient } from '@prisma/client';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

const YEAR = Number(process.env.YEAR || 2025);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 25);
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS || 999);
const TARGET_API_COVERAGE = Number(process.env.TARGET_API_COVERAGE || 600);
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 15000);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 1500);
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 25000);
const RETRIES = Number(process.env.RETRIES || 8);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 2500);
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.RATE_LIMIT_COOLDOWN_MS || 300000);
const IMPORT_ROUND_TIMEOUT_MS = Number(process.env.IMPORT_ROUND_TIMEOUT_MS || 10 * 60 * 1000);
const DEDUPE_INTERVAL_ROUNDS = Number(process.env.DEDUPE_INTERVAL_ROUNDS || 0);
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const PRIORITY_ONLY = process.env.PRIORITY_ONLY === 'true';
const USE_JINA_PROXY = process.env.USE_JINA_PROXY || 'false';
const USE_CURL = process.env.USE_CURL || 'false';
const RESET_ATTEMPTED = process.env.RESET_ATTEMPTED === 'true';
const REFRESH_EXISTING = process.env.REFRESH_EXISTING === 'true';
const LOG_DIR = process.env.LOG_DIR || '/tmp';

const statePath = path.join(process.cwd(), '.cache', 'gaokao-auto-fill-state.json');
const attemptedPath = path.join(process.cwd(), '.cache', `gaokao-auto-fill-attempted-${YEAR}.json`);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizedName(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '').trim();
}

function coveredUniversityKeys(rows: Array<{ universityId: string | null; universityName: string }>) {
  const ids = new Set<string>();
  const namesWithoutId = new Set<string>();
  for (const row of rows) {
    if (row.universityId) ids.add(row.universityId);
    else {
      const name = normalizedName(row.universityName);
      if (name) namesWithoutId.add(name);
    }
  }
  return { ids, namesWithoutId, count: ids.size + namesWithoutId.size };
}

async function getStats() {
  const [total, api, coveredRows, apiCoveredRows, bad] = await Promise.all([
    prisma.admissionScore.count({ where: { year: YEAR } }),
    prisma.admissionScore.count({ where: { year: YEAR, sourceType: 'gaokao_cn_api_by_school' } }),
    prisma.admissionScore.findMany({
      where: { year: YEAR },
      select: { universityId: true, universityName: true },
      distinct: ['universityId', 'universityName'],
    }),
    prisma.admissionScore.findMany({
      where: { year: YEAR, sourceType: 'gaokao_cn_api_by_school' },
      select: { universityId: true, universityName: true },
      distinct: ['universityId', 'universityName'],
    }),
    prisma.admissionScore.count({
      where: {
        year: YEAR,
        OR: [
          { universityName: '' },
          { province: '' },
          { subjectType: '' },
          { year: { lt: 2000 } },
          { minScore: null },
        ],
      },
    }),
  ]);
  return {
    total,
    api,
    covered: coveredUniversityKeys(coveredRows).count,
    apiCovered: coveredUniversityKeys(apiCoveredRows).count,
    bad,
  };
}

async function loadAttempted() {
  if (RESET_ATTEMPTED) return new Set<string>();
  try {
    const text = await readFile(attemptedPath, 'utf8');
    const data = JSON.parse(text);
    return new Set<string>(Array.isArray(data.schoolIds) ? data.schoolIds : []);
  } catch {
    return new Set<string>();
  }
}

async function saveAttempted(attemptedSchoolIds: Set<string>) {
  await mkdir(path.dirname(attemptedPath), { recursive: true });
  await writeFile(attemptedPath, JSON.stringify({
    year: YEAR,
    updatedAt: new Date().toISOString(),
    schoolIds: [...attemptedSchoolIds],
  }));
}

async function selectBatch(attemptedSchoolIds: Set<string>) {
  const covered = await prisma.admissionScore.findMany({
    where: {
      year: YEAR,
      ...(REFRESH_EXISTING ? { sourceType: 'gaokao_cn_api_by_school' } : {}),
    },
    select: { universityId: true, universityName: true },
    distinct: ['universityId', 'universityName'],
  });
  const coveredKeys = coveredUniversityKeys(covered);

  const where = PRIORITY_ONLY
    ? {
        level: { contains: '本科' },
        OR: [{ is985: true }, { is211: true }, { isDoubleFirst: true }],
      }
    : { level: { contains: '本科' } };

  const universities = await prisma.university.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      province: true,
      is985: true,
      is211: true,
      isDoubleFirst: true,
    },
    orderBy: [
      { is985: 'desc' },
      { is211: 'desc' },
      { isDoubleFirst: 'desc' },
      { province: 'asc' },
      { name: 'asc' },
    ],
    take: 3000,
  });

  return universities
    .filter(item => !coveredKeys.ids.has(item.id))
    .filter(item => !coveredKeys.namesWithoutId.has(normalizedName(item.name)))
    .map(item => ({ ...item, schoolId: Number(item.code) }))
    .filter(item => Number.isFinite(item.schoolId) && item.schoolId > 0)
    .filter(item => !attemptedSchoolIds.has(String(item.schoolId)))
    .slice(0, BATCH_SIZE);
}

async function dedupeScores() {
  const rows = await prisma.admissionScore.findMany({
    orderBy: { createdAt: 'asc' },
  });
  const seen = new Set<string>();
  const remove: string[] = [];

  for (const row of rows) {
    const key = [
      row.year,
      row.universityId || '',
      row.province,
      row.subjectType,
      row.batch || '',
      row.lineType,
      row.groupName || '',
      row.majorName || '',
      row.minScore ?? '',
      row.sourceType || '',
    ].join('|');

    if (seen.has(key)) remove.push(row.id);
    else seen.add(key);
  }

  if (remove.length) {
    await prisma.admissionScore.deleteMany({ where: { id: { in: remove } } });
  }
  return remove.length;
}

function runImport(ids: string, round: number) {
  return new Promise<number>((resolve, reject) => {
    const logPath = path.join(LOG_DIR, `gaokao-auto-fill-${YEAR}-round-${String(round).padStart(3, '0')}.log`);
    const log = createWriteStream(logPath, { flags: 'a' });
    let settled = false;
    const child = spawn('npx', ['tsx', 'scripts/import-gaokao-api-by-school.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        YEARS: String(YEAR),
        ONLY_SCHOOL_IDS: ids,
        CONCURRENCY: String(CONCURRENCY),
        REQUEST_DELAY_MS: String(REQUEST_DELAY_MS),
        REQUEST_TIMEOUT: String(REQUEST_TIMEOUT),
        RETRIES: String(RETRIES),
        RETRY_DELAY_MS: String(RETRY_DELAY_MS),
        RATE_LIMIT_COOLDOWN_MS: String(RATE_LIMIT_COOLDOWN_MS),
        LOG_PROGRESS_EVERY: String(process.env.LOG_PROGRESS_EVERY || 25),
        USE_JINA_PROXY,
        USE_CURL,
        RESUME: 'false',
      },
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      const message = `[auto-fill] round ${round} import timeout after ${IMPORT_ROUND_TIMEOUT_MS}ms`;
      console.warn(message);
      log.write(`${message}\n`);
      try {
        child.kill('SIGTERM');
      } catch {
        // Process already exited.
      }
      setTimeout(() => {
        if (!settled) {
          try {
            child.kill('SIGKILL');
          } catch {
            // Process already exited.
          }
        }
      }, 5000).unref();
    }, IMPORT_ROUND_TIMEOUT_MS);
    timeout.unref();

    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', err => {
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
    child.on('close', code => {
      settled = true;
      clearTimeout(timeout);
      log.end();
      resolve(code ?? 0);
    });
  });
}

async function writeState(round: number, batch: Array<{ name: string; schoolId: number }>, stats: any) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    round,
    options: {
      year: YEAR,
      targetApiCoverage: TARGET_API_COVERAGE,
      batchSize: BATCH_SIZE,
      concurrency: CONCURRENCY,
      requestDelayMs: REQUEST_DELAY_MS,
      cooldownMs: COOLDOWN_MS,
      dedupeIntervalRounds: DEDUPE_INTERVAL_ROUNDS,
      priorityOnly: PRIORITY_ONLY,
      refreshExisting: REFRESH_EXISTING,
    },
    batch: batch.map(item => ({ name: item.name, schoolId: item.schoolId })),
    stats,
  }, null, 2));
}

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const attemptedSchoolIds = await loadAttempted();

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const before = await getStats();
    console.log(`[auto-fill] round ${round} before`, before);

    if (before.covered >= TARGET_API_COVERAGE) {
      console.log(`[auto-fill] target reached: ${before.covered}/${TARGET_API_COVERAGE}`);
      break;
    }

    const batch = await selectBatch(attemptedSchoolIds);
    if (!batch.length) {
      console.log('[auto-fill] no uncovered universities left for current scope');
      break;
    }

    const ids = batch.map(item => String(item.schoolId)).join(',');
    console.log(`[auto-fill] selected ${batch.length}: ${batch.map(item => `${item.name}:${item.schoolId}`).join(', ')}`);
    await writeState(round, batch, before);

    const code = await runImport(ids, round);
    if (code === 0) {
      for (const item of batch) attemptedSchoolIds.add(String(item.schoolId));
      await saveAttempted(attemptedSchoolIds);
    }
    const removed = DEDUPE_INTERVAL_ROUNDS > 0 && round % DEDUPE_INTERVAL_ROUNDS === 0
      ? await dedupeScores()
      : 0;
    const after = await getStats();
    console.log(`[auto-fill] round ${round} done`, { code, removed, attempted: attemptedSchoolIds.size, after });
    await writeState(round, batch, after);

    if (round < MAX_ROUNDS) await sleep(COOLDOWN_MS);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
