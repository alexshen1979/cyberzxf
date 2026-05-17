import { spawn, execFile } from 'node:child_process';
import { createReadStream, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { prisma } from '../utils/prisma';

const backendRoot = path.resolve(__dirname, '../..');
const cacheDir = path.join(backendRoot, '.cache');
const pidPath = path.join(cacheDir, 'gaokao-auto-fill.pid');
const managedLogPath = path.join(cacheDir, 'gaokao-auto-fill-managed.log');
const statePath = path.join(cacheDir, 'gaokao-auto-fill-state.json');

type AutoFillOptions = {
  year?: number;
  targetApiCoverage?: number;
  batchSize?: number;
  maxRounds?: number;
  cooldownMs?: number;
  requestDelayMs?: number;
  requestTimeout?: number;
  retries?: number;
  retryDelayMs?: number;
  rateLimitCooldownMs?: number;
  dedupeIntervalRounds?: number;
  concurrency?: number;
  priorityOnly?: boolean;
  useJinaProxy?: boolean;
  useCurl?: boolean;
  resetAttempted?: boolean;
  refreshExisting?: boolean;
};

function readPid() {
  if (!existsSync(pidPath)) return null;
  const pid = Number(readFileSync(pidPath, 'utf8').trim());
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findAutoFillPids() {
  return new Promise<number[]>((resolve) => {
    execFile('pgrep', ['-f', 'scripts/auto-fill-gaokao-admission.ts'], (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      const currentPid = process.pid;
      const pids = stdout
        .split('\n')
        .map(item => Number(item.trim()))
        .filter(pid => Number.isFinite(pid) && pid > 0 && pid !== currentPid);
      resolve([...new Set(pids)]);
    });
  });
}

async function tailFile(filePath: string, maxLines = 80) {
  if (!existsSync(filePath)) return '';
  const lines: string[] = [];
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    lines.push(line);
    if (lines.length > maxLines) lines.shift();
  }
  return lines.join('\n');
}

function normalizedName(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '').trim();
}

function coveredUniversityCount(rows: Array<{ universityId: string | null; universityName: string }>) {
  const ids = new Set<string>();
  const namesWithoutId = new Set<string>();
  for (const row of rows) {
    if (row.universityId) ids.add(row.universityId);
    else {
      const name = normalizedName(row.universityName);
      if (name) namesWithoutId.add(name);
    }
  }
  return ids.size + namesWithoutId.size;
}

async function getScoreStats(year = 2025) {
  const yearWhere = { year };
  const [total, api, coveredRows, apiCoveredRows, undergraduateCoveredRows, bad, universities, undergraduate] = await Promise.all([
    prisma.admissionScore.count({ where: yearWhere }),
    prisma.admissionScore.count({ where: { ...yearWhere, sourceType: 'gaokao_cn_api_by_school' } }),
    prisma.admissionScore.findMany({
      where: yearWhere,
      select: { universityId: true, universityName: true },
      distinct: ['universityId', 'universityName'],
    }),
    prisma.admissionScore.findMany({
      where: { ...yearWhere, sourceType: 'gaokao_cn_api_by_school' },
      select: { universityId: true, universityName: true },
      distinct: ['universityId', 'universityName'],
    }),
    prisma.admissionScore.findMany({
      where: {
        ...yearWhere,
        university: { level: { contains: '本科' } },
      },
      select: { universityId: true, universityName: true },
      distinct: ['universityId', 'universityName'],
    }),
    prisma.admissionScore.count({
      where: {
        ...yearWhere,
        OR: [
          { universityName: '' },
          { province: '' },
          { subjectType: '' },
          { year: { lt: 2000 } },
          { AND: [{ minScore: null }, { minRank: null }] },
        ],
      },
    }),
    prisma.university.count(),
    prisma.university.count({ where: { level: { contains: '本科' } } }),
  ]);
  return {
    year,
    total,
    api,
    covered: coveredUniversityCount(coveredRows),
    apiCovered: coveredUniversityCount(apiCoveredRows),
    undergraduateCovered: coveredUniversityCount(undergraduateCoveredRows),
    bad,
    universities,
    undergraduate,
  };
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function getAdmissionAutoFillStatus() {
  const managedPid = readPid();
  const managedRunning = !!managedPid && isAlive(managedPid);
  if (managedPid && !managedRunning) rmSync(pidPath, { force: true });

  const pids = await findAutoFillPids();
  const running = managedRunning || pids.length > 0;
  const state = await readState();
  const year = Number(state?.options?.year) || 2025;
  return {
    running,
    managed: managedRunning,
    pid: managedRunning ? managedPid : null,
    pids,
    logPath: managedLogPath,
    statePath,
    stats: await getScoreStats(year),
    state,
    logTail: await tailFile(managedLogPath, 80),
  };
}

export async function startAdmissionAutoFill(options: AutoFillOptions = {}) {
  const status = await getAdmissionAutoFillStatus();
  if (status.running) return { started: false, status };

  await mkdir(cacheDir, { recursive: true });
  const out = openSync(managedLogPath, 'a');
  const err = openSync(managedLogPath, 'a');
  const env = {
    ...process.env,
    YEAR: String(options.year || 2025),
    TARGET_API_COVERAGE: String(options.targetApiCoverage || 1450),
    BATCH_SIZE: String(options.batchSize || 80),
    MAX_ROUNDS: String(options.maxRounds || 200),
    COOLDOWN_MS: String(options.cooldownMs ?? 10000),
    REQUEST_DELAY_MS: String(options.requestDelayMs ?? 800),
    REQUEST_TIMEOUT: String(options.requestTimeout || 15000),
    RETRIES: String(options.retries || 4),
    RETRY_DELAY_MS: String(options.retryDelayMs || 2000),
    RATE_LIMIT_COOLDOWN_MS: String(options.rateLimitCooldownMs || 90000),
    DEDUPE_INTERVAL_ROUNDS: String(options.dedupeIntervalRounds ?? 0),
    CONCURRENCY: String(options.concurrency || 4),
    USE_JINA_PROXY: String(options.useJinaProxy || false),
    USE_CURL: String(options.useCurl || false),
    PRIORITY_ONLY: String(options.priorityOnly || false),
    RESET_ATTEMPTED: String(options.resetAttempted || false),
    REFRESH_EXISTING: String(options.refreshExisting || false),
  };

  const child = spawn('npx', ['tsx', 'scripts/auto-fill-gaokao-admission.ts'], {
    cwd: backendRoot,
    env,
    detached: true,
    stdio: ['ignore', out, err],
  });
  child.unref();
  writeFileSync(pidPath, String(child.pid));

  return { started: true, status: await getAdmissionAutoFillStatus() };
}

export async function stopAdmissionAutoFill() {
  const managedPid = readPid();
  const pids = new Set<number>(await findAutoFillPids());
  if (managedPid) pids.add(managedPid);

  for (const pid of pids) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process already exited.
      }
    }
  }
  rmSync(pidPath, { force: true });
  return { stopped: pids.size, status: await getAdmissionAutoFillStatus() };
}
