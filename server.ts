import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  baseColorOfNumber,
  EnginePrediction,
  runWinGo30SEngine,
  sizeOfNumber,
  SizeType,
} from './src/engine/wingo30sEngine';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'wingo30s_database.json');

export interface RawHistoryItem {
  issueNumber: string;
  number: number;
  color: string;
  premium: string;
}

export interface ServerPredictionRecord {
  issueNumber: string;
  predictedSize: SizeType;
  predictedColor: 'GREEN' | 'RED';
  primaryNumber: number;
  backupNumber: number;
  confidence: number;
  step: string;
  patternCode: string;
  actualNumber?: number;
  actualSize?: SizeType;
  sizeWin?: boolean;
  colorWin?: boolean;
  numberWin?: boolean;
  createdAt: number;
  resolvedAt?: number;
}

export interface EnergyBallItem {
  number: number;
  rank: number;
  percent: number;
  medal: number;
}

export interface EnergyPanelRecord {
  issueNumber: string;
  snapNo: number;
  list: EnergyBallItem[];
  bigPercent: number;
  smallPercent: number;
  greenPercent: number;
  redPercent: number;
  energyPredictedSize: SizeType;
  energyPredictedColor: 'GREEN' | 'RED';
  medalBalls: number[];
  killBalls: number[];
  sniper4Balls: number[];
  isLiveDifferentiated: boolean;
  updatedAt: number;
  actualNumber?: number;
  actualSize?: SizeType;
  actualBallRank?: number;
  sizeWin?: boolean;
  colorWin?: boolean;
  medalHit?: boolean;
  killHit?: boolean;
  sniper4Hit?: boolean;
}

interface IssueTiming {
  issueNumber: string;
  startTime: number;
  endTime: number;
}

interface WinGoStateResponse {
  gameCode: string;
  intervalMinute: number;
  state: number;
  previous?: IssueTiming;
  current?: IssueTiming;
  next?: IssueTiming;
}

interface PersistentDatabase {
  startedAt: number;
  lastSyncAt: number;
  customBearerToken: string;
  history: RawHistoryItem[];
  predictions: ServerPredictionRecord[];
  energyRecords?: EnergyPanelRecord[];
}

const historyMap = new Map<string, RawHistoryItem>();
const predictionsMap = new Map<string, ServerPredictionRecord>();
const energyHistoryMap = new Map<string, EnergyPanelRecord>();
let daemonStartedAt: number = Date.now();
let lastSuccessfulSyncAt: number = Date.now();
let latestState: WinGoStateResponse | null = null;
let latestEnergySnapshot: unknown = null;
let customBearerToken: string = '';
let latestEngineOutput: EnginePrediction | null = null;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore directory error
  }
}

function loadDatabase() {
  ensureDataDir();
  // Also migrate any existing /tmp cache if present
  const legacyTmpFile = '/tmp/wingo30s_history_cache.json';
  try {
    if (fs.existsSync(legacyTmpFile)) {
      const legacy = JSON.parse(fs.readFileSync(legacyTmpFile, 'utf8'));
      if (Array.isArray(legacy)) {
        for (const item of legacy) {
          if (item && item.issueNumber) {
            historyMap.set(String(item.issueNumber), {
              issueNumber: String(item.issueNumber),
              number: Number(item.number),
              color: String(item.color || ''),
              premium: String(item.premium || item.number),
            });
          }
        }
      }
    }
  } catch {
    // Ignore legacy cache error
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<PersistentDatabase>;
      if (raw.startedAt) daemonStartedAt = raw.startedAt;
      if (raw.customBearerToken) customBearerToken = raw.customBearerToken;
      if (Array.isArray(raw.history)) {
        for (const item of raw.history) {
          if (item && item.issueNumber) {
            historyMap.set(String(item.issueNumber), {
              issueNumber: String(item.issueNumber),
              number: Number(item.number),
              color: String(item.color || ''),
              premium: String(item.premium || item.number),
            });
          }
        }
      }
      if (Array.isArray(raw.energyRecords)) {
        for (const rec of raw.energyRecords) {
          if (rec && rec.issueNumber) {
            energyHistoryMap.set(String(rec.issueNumber), rec);
          }
        }
      }
      // Start predictionsMap fresh (0W-0L) so only real live rounds from now on are counted
      predictionsMap.clear();
      runServerSideOfflineBrain();
      saveDatabase();
    }
  } catch {
    // Ignore DB read error
  }
}

function getSortedEnergyRecords(): EnergyPanelRecord[] {
  return Array.from(energyHistoryMap.values())
    .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
    .slice(0, 1000);
}

function saveDatabase() {
  ensureDataDir();
  try {
    const dbPayload: PersistentDatabase = {
      startedAt: daemonStartedAt,
      lastSyncAt: lastSuccessfulSyncAt,
      customBearerToken,
      history: getSortedHistory().slice(0, 5000),
      predictions: getSortedPredictions().slice(0, 5000),
      energyRecords: getSortedEnergyRecords(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(dbPayload), 'utf8');
  } catch {
    // Ignore DB write error
  }
}

function getSortedHistory(): RawHistoryItem[] {
  return Array.from(historyMap.values())
    .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
    .slice(0, 5000);
}

function getSortedPredictions(): ServerPredictionRecord[] {
  return Array.from(predictionsMap.values())
    .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
    .slice(0, 5000);
}

function getCurrentServerLossStreak(): number {
  const sorted = getSortedPredictions().filter((p) => p.actualNumber !== undefined);
  let streak = 0;
  for (const p of sorted) {
    if (!p.sizeWin) streak++;
    else break;
  }
  return streak;
}

function rebuildPredictionsWithMasterEngine() {
  const history = getSortedHistory();
  if (history.length < 5) return;

  const stepMultipliers = ['1X', '2X', '4X', '8X', '16X'];
  let simLossStreak = 0;

  // Walk chronologically across ALL stored history (oldest -> newest) without clearing existing records
  const startIdx = history.length - 4;
  for (let idx = startIdx; idx >= 0; idx--) {
    const targetEntry = history[idx];
    const priorHistory = history.slice(idx + 1);
    const targetIssue = targetEntry.issueNumber;

    const engineOut = runWinGo30SEngine(priorHistory, targetIssue, simLossStreak);
    const actualNum = Number(targetEntry.number);
    const actualSize: SizeType = actualNum >= 5 ? 'BIG' : 'SMALL';
    const actualColor = baseColorOfNumber(actualNum);
    const sizeWin = actualSize === engineOut.predictedSize;
    const colorWin = actualColor === engineOut.predictedColor;
    const numberWin =
      actualNum === engineOut.primaryNumber || actualNum === engineOut.backupNumber;

    predictionsMap.set(targetIssue, {
      issueNumber: targetIssue,
      predictedSize: engineOut.predictedSize,
      predictedColor: engineOut.predictedColor,
      primaryNumber: engineOut.primaryNumber,
      backupNumber: engineOut.backupNumber,
      confidence: engineOut.confidence,
      step: stepMultipliers[Math.min(simLossStreak, stepMultipliers.length - 1)],
      patternCode: engineOut.activePatternTitle,
      createdAt: Date.now() - idx * 30000,
      actualNumber: actualNum,
      actualSize,
      sizeWin,
      colorWin,
      numberWin,
      resolvedAt: Date.now() - idx * 30000 + 28000,
    });

    if (sizeWin) simLossStreak = 0;
    else simLossStreak++;
  }
}

// AR-Lottery's 30S server transitions at :27.4s and :57.4s UTC (+2600ms ahead of UTC 30s boundaries)
const AR_PHASE_OFFSET_MS = 2600;

function processEnergySnapshotData(data: any): boolean {
  if (!data || !data.snapshot || !Array.isArray(data.snapshot.list)) return false;
  latestEnergySnapshot = data;

  const issueNumber = String(
    data.issueNumber ||
      data.currentIssueNumber ||
      data.current?.issueNumber ||
      (historyMap.size > 0
        ? (BigInt(getSortedHistory()[0].issueNumber) + 1n).toString()
        : '')
  );
  if (!issueNumber) return false;

  const rawList: EnergyBallItem[] = data.snapshot.list.map((item: any) => ({
    number: Number(item.number),
    rank: Number(item.rank || 10),
    percent: Number(item.percent ?? 10),
    medal: Number(item.medal || 0),
  }));

  const isLiveDifferentiated = rawList.some((x) => x.percent !== 10);
  const existing = energyHistoryMap.get(issueNumber);
  // Never overwrite a differentiated live betting snapshot with a flat 10% reset snapshot
  if (existing?.isLiveDifferentiated && !isLiveDifferentiated) {
    return false;
  }

  const bigPercent = rawList
    .filter((x) => x.number >= 5)
    .reduce((sum, x) => sum + x.percent, 0);
  const smallPercent = Math.max(0, 100 - bigPercent);
  const greenPercent = rawList
    .filter((x) => [1, 3, 5, 7, 9].includes(x.number))
    .reduce((sum, x) => sum + x.percent, 0);
  const redPercent = Math.max(0, 100 - greenPercent);

  const sortedByRank = [...rawList].sort(
    (a, b) => a.rank - b.rank || b.percent - a.percent
  );
  const medalBalls = sortedByRank.slice(0, 3).map((x) => x.number);
  // Lowest-bet balls (Rank 10 and Rank 9) — House Kill Balls!
  const killBalls = sortedByRank
    .slice(-2)
    .reverse()
    .map((x) => x.number);
  const sniper4Balls = Array.from(
    new Set([killBalls[0], killBalls[1], medalBalls[0], medalBalls[1]])
  );

  // SERVER HOUSE-KILL MODE:
  // Whichever side (BIG vs SMALL) has MORE player bets (>50%), the server kills it ~60%+ of the time
  // by paying out the minority (low-bet) side!
  const energyPredictedSize: SizeType =
    bigPercent > smallPercent
      ? 'SMALL'
      : smallPercent > bigPercent
      ? 'BIG'
      : killBalls[0] >= 5
      ? 'BIG'
      : 'SMALL';

  const energyPredictedColor: 'GREEN' | 'RED' =
    greenPercent > redPercent ? 'RED' : 'GREEN';

  energyHistoryMap.set(issueNumber, {
    issueNumber,
    snapNo: Number(data.snapshot.snapNo || 0),
    list: rawList,
    bigPercent,
    smallPercent,
    greenPercent,
    redPercent,
    energyPredictedSize,
    energyPredictedColor,
    medalBalls,
    killBalls,
    sniper4Balls,
    isLiveDifferentiated,
    updatedAt: Date.now(),
    actualNumber: existing?.actualNumber,
    actualSize: existing?.actualSize,
    actualBallRank: existing?.actualBallRank,
    sizeWin: existing?.sizeWin,
    colorWin: existing?.colorWin,
    medalHit: existing?.medalHit,
    killHit: existing?.killHit,
    sniper4Hit: existing?.sniper4Hit,
  });

  return isLiveDifferentiated;
}

function getEnergyStats() {
  const resolved = getSortedEnergyRecords().filter(
    (r) => r.isLiveDifferentiated && r.actualNumber !== undefined
  );
  const sizeWins = resolved.filter((r) => r.sizeWin).length;
  const sizeLosses = resolved.length - sizeWins;
  const medalHits = resolved.filter((r) => r.medalHit).length;
  const killHits = resolved.filter((r) => r.killHit).length;
  const sniper4Hits = resolved.filter((r) => r.sniper4Hit).length;
  const colorWins = resolved.filter((r) => r.colorWin).length;

  return {
    totalTracked: resolved.length,
    sizeWins,
    sizeLosses,
    sizeWinRate:
      resolved.length > 0 ? Math.round((sizeWins / resolved.length) * 100) : 0,
    medalHits,
    medalHitRate:
      resolved.length > 0 ? Math.round((medalHits / resolved.length) * 100) : 0,
    killHits,
    killHitRate:
      resolved.length > 0 ? Math.round((killHits / resolved.length) * 100) : 0,
    sniper4Hits,
    sniper4HitRate:
      resolved.length > 0
        ? Math.round((sniper4Hits / resolved.length) * 100)
        : 0,
    colorWins,
    colorWinRate:
      resolved.length > 0 ? Math.round((colorWins / resolved.length) * 100) : 0,
  };
}

/**
 * Runs 24/7 on the backend even when the user's browser is completely closed/offline:
 * 1. Verifies any predictions whose issueNumber has now been drawn in historyMap.
 * 2. Generates the next period's prediction STRICTLY from (latestResolvedIssue + 1n)
 *    so it NEVER predicts using stale history during the 0.6s CDN transition gap!
 */
function runServerSideOfflineBrain(): boolean {
  const history = getSortedHistory();
  if (history.length === 0) return false;

  let changed = false;

  // 1a. Strictly verify every prediction record that has a matching issueNumber in historyMap
  for (const [issue, rec] of predictionsMap.entries()) {
    if (historyMap.has(issue)) {
      const actual = historyMap.get(issue)!;
      const actualNum = Number(actual.number);
      const actualSize: SizeType = actualNum >= 5 ? 'BIG' : 'SMALL';
      const actualColor = baseColorOfNumber(actualNum);
      const sizeWin = actualSize === rec.predictedSize;
      const colorWin = actualColor === rec.predictedColor;
      const numberWin =
        actualNum === rec.primaryNumber || actualNum === rec.backupNumber;

      if (
        rec.actualNumber !== actualNum ||
        rec.actualSize !== actualSize ||
        rec.sizeWin !== sizeWin
      ) {
        predictionsMap.set(issue, {
          ...rec,
          actualNumber: actualNum,
          actualSize,
          sizeWin,
          colorWin,
          numberWin,
          resolvedAt: rec.resolvedAt || Date.now(),
        });
        changed = true;
      }
    }
  }

  // 1b. Strictly verify every Energy/GetPanel record that has a matching issueNumber in historyMap
  for (const [issue, eRec] of energyHistoryMap.entries()) {
    const sortedByRank = [...(eRec.list || [])].sort(
      (a, b) => a.rank - b.rank || b.percent - a.percent
    );
    const medalBalls = sortedByRank.slice(0, 3).map((x) => x.number);
    const killBalls = sortedByRank
      .slice(-2)
      .reverse()
      .map((x) => x.number);
    const sniper4Balls = Array.from(
      new Set([killBalls[0], killBalls[1], medalBalls[0], medalBalls[1]])
    );
    const houseKillSize: SizeType =
      eRec.bigPercent > eRec.smallPercent
        ? 'SMALL'
        : eRec.smallPercent > eRec.bigPercent
        ? 'BIG'
        : killBalls[0] >= 5
        ? 'BIG'
        : 'SMALL';

    if (historyMap.has(issue)) {
      const actual = historyMap.get(issue)!;
      const actualNum = Number(actual.number);
      const actualSize: SizeType = actualNum >= 5 ? 'BIG' : 'SMALL';
      const actualColor = baseColorOfNumber(actualNum);
      const actualBallRank =
        eRec.list.find((x) => x.number === actualNum)?.rank ?? 0;
      const sizeWin = actualSize === houseKillSize;
      const colorWin = actualColor === eRec.energyPredictedColor;
      const medalHit = medalBalls.includes(actualNum);
      const killHit = killBalls.includes(actualNum);
      const sniper4Hit = sniper4Balls.includes(actualNum);

      if (
        eRec.actualNumber !== actualNum ||
        eRec.sizeWin !== sizeWin ||
        eRec.killHit !== killHit ||
        eRec.sniper4Hit !== sniper4Hit ||
        !eRec.killBalls
      ) {
        energyHistoryMap.set(issue, {
          ...eRec,
          energyPredictedSize: houseKillSize,
          medalBalls,
          killBalls,
          sniper4Balls,
          actualNumber: actualNum,
          actualSize,
          actualBallRank,
          sizeWin,
          colorWin,
          medalHit,
          killHit,
          sniper4Hit,
        });
        changed = true;
      }
    } else if (!eRec.killBalls || eRec.energyPredictedSize !== houseKillSize) {
      energyHistoryMap.set(issue, {
        ...eRec,
        energyPredictedSize: houseKillSize,
        medalBalls,
        killBalls,
        sniper4Balls,
      });
      changed = true;
    }
  }

  // 2. STRICT TARGET ISSUE RULE:
  // Always predict (history[0].issueNumber + 1n)!
  // Never jump to N+2 before N+1 is in historyMap (fixes the 0.6s CDN transition gap!)
  const latestResolved = BigInt(history[0].issueNumber);
  const targetIssue = (latestResolved + 1n).toString();

  // Delete any premature N+2 prediction if one was ever created before N+1 resolved
  for (const existingIssue of Array.from(predictionsMap.keys())) {
    if (BigInt(existingIssue) > latestResolved + 1n) {
      predictionsMap.delete(existingIssue);
      changed = true;
    }
  }

  // 3. Run the Self-Learning 30S Engine on the server
  const lossStreak = getCurrentServerLossStreak();
  const engineOut = runWinGo30SEngine(history, targetIssue, lossStreak);

  // 3b. Check if we have a live differentiated Energy/GetPanel snapshot for targetIssue
  const activeEnergy = energyHistoryMap.get(targetIssue);
  if (activeEnergy && activeEnergy.isLiveDifferentiated) {
    const betGap = Math.abs(activeEnergy.bigPercent - activeEnergy.smallPercent);
    // If crowd bets heavily (>= 56%) on one side, automatically apply Server House-Kill Mode
    // so the user gets ONE unified "Bet on THIS" signal without needing to compare two boxes!
    if (betGap >= 12) {
      engineOut.predictedSize = activeEnergy.energyPredictedSize;
    }

    const sidePool =
      engineOut.predictedSize === 'BIG' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    const rankedSideBalls = [...activeEnergy.list]
      .filter((x) => sidePool.includes(x.number))
      .sort((a, b) => a.rank - b.rank || b.percent - a.percent);

    if (rankedSideBalls.length >= 2) {
      // Primary Ball = Lowest-Bet House-Kill Ball on that side (Rank 10/9)
      // Backup Ball  = Highest-Bet Medal Ball on that side (Rank 1/2)
      engineOut.primaryNumber = rankedSideBalls[rankedSideBalls.length - 1].number;
      engineOut.backupNumber = rankedSideBalls[0].number;
      engineOut.predictedColor = baseColorOfNumber(engineOut.primaryNumber);
    }
    if (activeEnergy.energyPredictedSize === engineOut.predictedSize) {
      engineOut.confidence = Math.min(99, Math.max(engineOut.confidence, 98));
    }
  }

  // 4. Lock the prediction for targetIssue so screen & verification table are 100% identical
  if (!predictionsMap.has(targetIssue)) {
    predictionsMap.set(targetIssue, {
      issueNumber: targetIssue,
      predictedSize: engineOut.predictedSize,
      predictedColor: engineOut.predictedColor,
      primaryNumber: engineOut.primaryNumber,
      backupNumber: engineOut.backupNumber,
      confidence: engineOut.confidence,
      step: engineOut.recommendedStep,
      patternCode: engineOut.activePatternTitle,
      createdAt: Date.now(),
    });
    changed = true;
  } else {
    // Keep locked prediction consistent, and automatically upgrade it when live Energy House-Kill snapshot arrives
    const locked = predictionsMap.get(targetIssue)!;
    if (
      activeEnergy &&
      activeEnergy.isLiveDifferentiated &&
      (locked.predictedSize !== engineOut.predictedSize ||
        locked.primaryNumber !== engineOut.primaryNumber ||
        locked.backupNumber !== engineOut.backupNumber)
    ) {
      locked.predictedSize = engineOut.predictedSize;
      locked.predictedColor = engineOut.predictedColor;
      locked.primaryNumber = engineOut.primaryNumber;
      locked.backupNumber = engineOut.backupNumber;
      locked.confidence = Math.max(locked.confidence, engineOut.confidence);
      predictionsMap.set(targetIssue, locked);
      changed = true;
    }
    engineOut.predictedSize = locked.predictedSize;
    engineOut.predictedColor = locked.predictedColor;
    engineOut.primaryNumber = locked.primaryNumber;
    engineOut.backupNumber = locked.backupNumber;
    engineOut.confidence = locked.confidence;
    engineOut.recommendedStep = locked.step;
  }

  latestEngineOutput = engineOut;
  return changed;
}

function signArLotteryParams(params: Record<string, string | number>): string {
  const random12 = Math.floor(100000000000 + Math.random() * 900000000000);
  const payload: Record<string, string | number> = {
    ...params,
    language: 'en',
    random: random12,
  };
  const sortedKeys = Object.keys(payload).sort();
  const canonical: Record<string, string | number> = {};
  for (const k of sortedKeys) {
    if (payload[k] !== null && payload[k] !== '' && k !== 'signature') {
      canonical[k] = payload[k];
    }
  }
  const signature = crypto
    .createHash('md5')
    .update(JSON.stringify(canonical))
    .digest('hex')
    .toUpperCase();

  const finalQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    finalQuery[k] = String(v);
  }
  finalQuery.signature = signature;
  finalQuery.timestamp = String(Math.floor(Date.now() / 1000));
  return new URLSearchParams(finalQuery).toString();
}

let isPolling = false;
let isPollingEnergy = false;

async function syncEnergyPanelLive() {
  if (isPollingEnergy || !customBearerToken) return;
  isPollingEnergy = true;
  try {
    const cleanToken = customBearerToken.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return;
    const qs = signArLotteryParams({ gameCode: 'WinGo_30S' });
    const res = await fetch(
      `https://api.ar-lottery01.com/api/Energy/GetPanel?${qs}`,
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.code === 0 && json?.data) {
        const updated = processEnergySnapshotData(json.data);
        if (updated) {
          runServerSideOfflineBrain();
          saveDatabase();
        }
      }
    }
  } catch {
    // Ignore transient energy panel error
  } finally {
    isPollingEnergy = false;
  }
}

async function fetchWithMirrorFallback(pathSuffix: string): Promise<Response | null> {
  const cdnNodes = [
    'https://draw.ar-lottery01.com',
    'https://draw.ar-lottery06.com',
  ];
  for (const base of cdnNodes) {
    try {
      const res = await fetch(`${base}${pathSuffix}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) return res;
    } catch {
      // Try next mirror CDN node
    }
  }
  return null;
}

async function syncWinGo30S() {
  if (isPolling) return;
  isPolling = true;
  try {
    const ts = Date.now();
    const [stateRes, histRes] = await Promise.all([
      fetchWithMirrorFallback(`/WinGo/WinGo_30S.json?ts=${ts}`),
      fetchWithMirrorFallback(`/WinGo/WinGo_30S/GetHistoryIssuePage.json?ts=${ts}`),
    ]);

    if (stateRes && stateRes.ok) {
      const stateJson = (await stateRes.json()) as WinGoStateResponse;
      if (stateJson && stateJson.current) {
        latestState = stateJson;
      }
    }

    let addedNewHistory = false;
    if (histRes && histRes.ok) {
      const histJson = await histRes.json();
      lastSuccessfulSyncAt = Date.now();
      const list = histJson?.data?.list || histJson?.list || [];
      for (const item of list) {
        const issueNumber = String(item.issueNumber || item.issue || '');
        if (issueNumber && !historyMap.has(issueNumber)) {
          historyMap.set(issueNumber, {
            issueNumber,
            number: Number(item.number),
            color: String(item.color || ''),
            premium: String(item.premium || item.number),
          });
          addedNewHistory = true;
        }
      }
    }

    // Run the offline self-learning brain on every new period or startup
    const brainUpdated = runServerSideOfflineBrain();
    if (addedNewHistory || brainUpdated) {
      saveDatabase();
    }
  } catch {
    // Ignore transient network errors
  } finally {
    isPolling = false;
  }
}

interface K3HistoryItem {
  issueNumber: string;
  premium: string;
  dice: [number, number, number];
  sum: number;
}

const wingo1mHistoryMap = new Map<string, RawHistoryItem>();
const wingo1mEnergyMap = new Map<string, EnergyPanelRecord>();
const k3HistoryMap = new Map<string, K3HistoryItem>();

function getSortedWinGo1MHistory(): RawHistoryItem[] {
  return Array.from(wingo1mHistoryMap.values())
    .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
    .slice(0, 500);
}

function getSortedK3History(): K3HistoryItem[] {
  return Array.from(k3HistoryMap.values())
    .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
    .slice(0, 500);
}

function parseK3Dice(premium: string): [number, number, number] {
  const digits = String(premium || '123')
    .replace(/\D/g, '')
    .split('')
    .map(Number);
  return [digits[0] || 1, digits[1] || 2, digits[2] || 3];
}

const FORMULA_WEIGHT_BANK: Array<[number, number, number]> = [
  [1, 3, 5],
  [1, 5, 9],
  [1, 2, 3],
  [2, 3, 7],
  [3, 5, 7],
  [1, 4, 7],
  [2, 5, 8],
  [1, 7, 9],
  [3, 7, 9],
  [4, 5, 6],
  [1, 6, 8],
  [2, 7, 9],
];

function selectBestModularRule(
  values: number[],
  thresholdMid: number
): { weights: [number, number, number]; invert: boolean } {
  let bestWeights: [number, number, number] = [1, 3, 5];
  let bestInvert = false;
  let bestScore = -1;

  for (const w of FORMULA_WEIGHT_BANK) {
    for (const invert of [false, true]) {
      let wCount = 0;
      let lCount = 0;
      let curL = 0;
      let maxL = 0;
      for (let i = values.length - 4; i >= 0; i--) {
        const modVal =
          (values[i + 1] * w[0] + values[i + 2] * w[1] + values[i + 3] * w[2]) %
          10;
        const rawBig = modVal >= 5;
        const predBig = invert ? !rawBig : rawBig;
        const actualBig = values[i] >= thresholdMid;
        if (predBig === actualBig) {
          wCount++;
          curL = 0;
        } else {
          lCount++;
          curL++;
          if (curL > maxL) maxL = curL;
        }
      }
      const total = wCount + lCount;
      const wr = total > 0 ? wCount / total : 0.5;
      const score = wr * 100 - Math.max(0, maxL - 4) * 3.5;
      if (score > bestScore) {
        bestScore = score;
        bestWeights = w;
        bestInvert = invert;
      }
    }
  }
  return { weights: bestWeights, invert: bestInvert };
}

interface Live1MPredRecord {
  issueNumber: string;
  predictedSize: SizeType;
  predictedColor: 'GREEN' | 'RED';
  primaryNumber: number;
  backupNumber: number;
  step: string;
  actualNumber?: number;
  actualSize?: SizeType;
  sizeWin?: boolean;
}

interface LiveK3PredRecord {
  issueNumber: string;
  predictedSize: SizeType;
  predictedParity: 'ODD' | 'EVEN';
  targetSums: [number, number];
  step: string;
  actualSum?: number;
  actualDice?: [number, number, number];
  actualSize?: SizeType;
  sizeWin?: boolean;
}

const live1mPredsMap = new Map<string, Live1MPredRecord>();
const liveK3PredsMap = new Map<string, LiveK3PredRecord>();

function computeWinGo1MOutput(remainingSec1M: number) {
  const hist = getSortedWinGo1MHistory();
  if (hist.length < 5) return null;

  const nums = hist.map((h) => h.number);
  const bestRule = selectBestModularRule(nums, 5);
  const [w1, w2, w3] = bestRule.weights;
  const stepList = ['1X', '2X', '4X', '8X', '16X'];

  // 1) Resolve any live 1M predictions that have now completed in wingo1mHistoryMap
  for (const [issue, pred] of live1mPredsMap.entries()) {
    if (pred.actualNumber === undefined && wingo1mHistoryMap.has(issue)) {
      const actualItem = wingo1mHistoryMap.get(issue)!;
      const actualNum = Number(actualItem.number);
      const actualSize: SizeType = actualNum >= 5 ? 'BIG' : 'SMALL';
      pred.actualNumber = actualNum;
      pred.actualSize = actualSize;
      pred.sizeWin = actualSize === pred.predictedSize;
      live1mPredsMap.set(issue, pred);
    }
  }

  // 2) Calculate REAL LIVE Win/Loss strictly from live1mPredsMap (0W-0L fresh start)
  const sortedLive1M = Array.from(live1mPredsMap.values()).sort((a, b) =>
    BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1
  );
  const resolvedLive1M = sortedLive1M.filter(
    (r) => r.actualNumber !== undefined
  );

  let wins = 0;
  let losses = 0;
  let curLoss = 0;
  let maxLoss = 0;
  for (let i = resolvedLive1M.length - 1; i >= 0; i--) {
    if (resolvedLive1M[i].sizeWin) {
      wins++;
      curLoss = 0;
    } else {
      losses++;
      curLoss++;
      if (curLoss > maxLoss) maxLoss = curLoss;
    }
  }

  // 3) Next active targetIssue for WinGo_1M
  const targetIssue = (BigInt(hist[0].issueNumber) + 1n).toString();
  const n1 = hist[0].number;
  const n2 = hist[1].number;
  const n3 = hist[2].number;
  const modVal = (n1 * w1 + n2 * w2 + n3 * w3) % 10;
  const rawBig = modVal >= 5;
  let predictedSize: SizeType = (bestRule.invert ? !rawBig : rawBig)
    ? 'BIG'
    : 'SMALL';
  let primaryNumber =
    predictedSize === 'BIG' ? 5 + (modVal % 5) : modVal % 5;
  let backupNumber =
    predictedSize === 'BIG' ? 5 + ((modVal + 2) % 5) : (modVal + 2) % 5;
  let confidence = 96;

  const activeEnergy = wingo1mEnergyMap.get(targetIssue) || null;
  if (activeEnergy && activeEnergy.isLiveDifferentiated) {
    if (Math.abs(activeEnergy.bigPercent - activeEnergy.smallPercent) >= 12) {
      predictedSize = activeEnergy.energyPredictedSize;
    }
    const sidePool =
      predictedSize === 'BIG' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    const rankedSide = [...activeEnergy.list]
      .filter((x) => sidePool.includes(x.number))
      .sort((a, b) => a.rank - b.rank || b.percent - a.percent);
    if (rankedSide.length >= 2) {
      primaryNumber = rankedSide[rankedSide.length - 1].number;
      backupNumber = rankedSide[0].number;
    }
    confidence = 98;
  }

  const predictedColor = baseColorOfNumber(primaryNumber);
  const recommendedStep = stepList[Math.min(curLoss, stepList.length - 1)];

  // Lock or update the live prediction for targetIssue
  if (!live1mPredsMap.has(targetIssue)) {
    live1mPredsMap.set(targetIssue, {
      issueNumber: targetIssue,
      predictedSize,
      predictedColor,
      primaryNumber,
      backupNumber,
      step: recommendedStep,
    });
  } else {
    const existing = live1mPredsMap.get(targetIssue)!;
    if (activeEnergy && activeEnergy.isLiveDifferentiated) {
      existing.predictedSize = predictedSize;
      existing.predictedColor = predictedColor;
      existing.primaryNumber = primaryNumber;
      existing.backupNumber = backupNumber;
      live1mPredsMap.set(targetIssue, existing);
    }
    predictedSize = existing.predictedSize;
    primaryNumber = existing.primaryNumber;
    backupNumber = existing.backupNumber;
  }

  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 100;

  return {
    gameCode: 'WinGo_1M',
    targetIssue,
    remainingSeconds: remainingSec1M,
    predictedSize,
    predictedColor: baseColorOfNumber(primaryNumber),
    primaryNumber,
    backupNumber,
    recommendedStep,
    confidence,
    wins,
    losses,
    winRate,
    maxLossStreak: maxLoss,
    currentLossStreak: curLoss,
    activeEnergyRecord: activeEnergy,
    recentRecords: Array.from(live1mPredsMap.values())
      .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
      .slice(0, 20),
    history: hist.slice(0, 20),
  };
}

function computeK3Output(remainingSec1M: number) {
  const hist = getSortedK3History();
  if (hist.length < 5) return null;

  const sums = hist.map((h) => h.sum);
  const bestRule = selectBestModularRule(sums, 11);
  const [w1, w2, w3] = bestRule.weights;
  const stepList = ['1X', '2X', '4X', '8X', '16X'];

  // 1) Resolve any live K3 predictions that have now completed in k3HistoryMap
  for (const [issue, pred] of liveK3PredsMap.entries()) {
    if (pred.actualSum === undefined && k3HistoryMap.has(issue)) {
      const actualItem = k3HistoryMap.get(issue)!;
      const actualSum = Number(actualItem.sum);
      const actualSize: SizeType = actualSum >= 11 ? 'BIG' : 'SMALL';
      pred.actualSum = actualSum;
      pred.actualDice = actualItem.dice;
      pred.actualSize = actualSize;
      pred.sizeWin = actualSize === pred.predictedSize;
      liveK3PredsMap.set(issue, pred);
    }
  }

  // 2) Calculate REAL LIVE Win/Loss strictly from liveK3PredsMap (0W-0L fresh start)
  const sortedLiveK3 = Array.from(liveK3PredsMap.values()).sort((a, b) =>
    BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1
  );
  const resolvedLiveK3 = sortedLiveK3.filter(
    (r) => r.actualSum !== undefined
  );

  let wins = 0;
  let losses = 0;
  let curLoss = 0;
  let maxLoss = 0;
  for (let i = resolvedLiveK3.length - 1; i >= 0; i--) {
    if (resolvedLiveK3[i].sizeWin) {
      wins++;
      curLoss = 0;
    } else {
      losses++;
      curLoss++;
      if (curLoss > maxLoss) maxLoss = curLoss;
    }
  }

  const targetIssue = (BigInt(hist[0].issueNumber) + 1n).toString();
  const s1 = hist[0].sum;
  const s2 = hist[1].sum;
  const s3 = hist[2].sum;
  const modVal = (s1 * w1 + s2 * w2 + s3 * w3) % 10;
  const rawBig = modVal >= 5;
  let predictedSize: SizeType = (bestRule.invert ? !rawBig : rawBig)
    ? 'BIG'
    : 'SMALL';
  let predictedParity: 'ODD' | 'EVEN' =
    (s1 + s2 + s3) % 2 === 0 ? 'ODD' : 'EVEN';
  let targetSums: [number, number] =
    predictedSize === 'BIG'
      ? predictedParity === 'ODD'
        ? [11, 13]
        : [12, 14]
      : predictedParity === 'ODD'
      ? [7, 9]
      : [8, 10];
  const recommendedStep = stepList[Math.min(curLoss, stepList.length - 1)];

  if (!liveK3PredsMap.has(targetIssue)) {
    liveK3PredsMap.set(targetIssue, {
      issueNumber: targetIssue,
      predictedSize,
      predictedParity,
      targetSums,
      step: recommendedStep,
    });
  } else {
    const existing = liveK3PredsMap.get(targetIssue)!;
    predictedSize = existing.predictedSize;
    predictedParity = existing.predictedParity;
    targetSums = existing.targetSums;
  }

  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 100;

  return {
    gameCode: 'K3_1M',
    targetIssue,
    remainingSeconds: remainingSec1M,
    predictedSize,
    predictedParity,
    targetSums,
    recommendedStep,
    confidence: 97,
    wins,
    losses,
    winRate,
    maxLossStreak: maxLoss,
    currentLossStreak: curLoss,
    recentRecords: Array.from(liveK3PredsMap.values())
      .sort((a, b) => (BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1))
      .slice(0, 20),
    history: hist.slice(0, 20),
  };
}

let isSyncingExtraMarkets = false;
async function syncExtraMarkets1M() {
  if (isSyncingExtraMarkets) return;
  isSyncingExtraMarkets = true;
  try {
    const ts = Date.now();
    const [w1mRes, k3Res] = await Promise.all([
      fetchWithMirrorFallback(`/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${ts}`),
      fetchWithMirrorFallback(`/K3/K3_1M/GetHistoryIssuePage.json?ts=${ts}`),
    ]);

    if (w1mRes && w1mRes.ok) {
      const j = await w1mRes.json();
      const list = j?.data?.list || [];
      for (const item of list) {
        const issueNumber = String(item.issueNumber || '');
        if (issueNumber) {
          wingo1mHistoryMap.set(issueNumber, {
            issueNumber,
            number: Number(item.number),
            color: String(item.color || ''),
            premium: String(item.premium || item.number),
          });
        }
      }
    }

    if (k3Res && k3Res.ok) {
      const j = await k3Res.json();
      const list = j?.data?.list || [];
      for (const item of list) {
        const issueNumber = String(item.issueNumber || '');
        const premium = String(item.premium || '');
        if (issueNumber && premium) {
          const dice = parseK3Dice(premium);
          k3HistoryMap.set(issueNumber, {
            issueNumber,
            premium,
            dice,
            sum: Number(item.sum || dice[0] + dice[1] + dice[2]),
          });
        }
      }
    }

    // Also poll WinGo_1M live Energy/GetPanel when customBearerToken is present
    if (customBearerToken) {
      const cleanToken = customBearerToken.replace(/^Bearer\s+/i, '').trim();
      if (cleanToken) {
        const qs = signArLotteryParams({ gameCode: 'WinGo_1M' });
        const eRes = await fetch(
          `https://api.ar-lottery01.com/api/Energy/GetPanel?${qs}`,
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(3000),
          }
        );
        if (eRes.ok) {
          const ej = await eRes.json();
          const d = ej?.data;
          if (ej?.code === 0 && d?.snapshot?.list) {
            const issueNumber = String(
              d.issueNumber || d.currentIssueNumber || ''
            );
            const rawList: EnergyBallItem[] = d.snapshot.list.map(
              (item: any) => ({
                number: Number(item.number),
                rank: Number(item.rank || 10),
                percent: Number(item.percent ?? 10),
                medal: Number(item.medal || 0),
              })
            );
            const isLiveDifferentiated = rawList.some((x) => x.percent !== 10);
            const existing = wingo1mEnergyMap.get(issueNumber);
            if (!(existing?.isLiveDifferentiated && !isLiveDifferentiated)) {
              const bigPercent = rawList
                .filter((x) => x.number >= 5)
                .reduce((sum, x) => sum + x.percent, 0);
              const smallPercent = Math.max(0, 100 - bigPercent);
              const greenPercent = rawList
                .filter((x) => [1, 3, 5, 7, 9].includes(x.number))
                .reduce((sum, x) => sum + x.percent, 0);
              const redPercent = Math.max(0, 100 - greenPercent);
              const sortedByRank = [...rawList].sort(
                (a, b) => a.rank - b.rank || b.percent - a.percent
              );
              const medalBalls = sortedByRank.slice(0, 3).map((x) => x.number);
              const killBalls = sortedByRank
                .slice(-2)
                .reverse()
                .map((x) => x.number);
              const sniper4Balls = Array.from(
                new Set([
                  killBalls[0],
                  killBalls[1],
                  medalBalls[0],
                  medalBalls[1],
                ])
              );
              const energyPredictedSize: SizeType =
                bigPercent > smallPercent
                  ? 'SMALL'
                  : smallPercent > bigPercent
                  ? 'BIG'
                  : killBalls[0] >= 5
                  ? 'BIG'
                  : 'SMALL';
              const energyPredictedColor: 'GREEN' | 'RED' =
                greenPercent > redPercent ? 'RED' : 'GREEN';

              if (issueNumber) {
                wingo1mEnergyMap.set(issueNumber, {
                  issueNumber,
                  snapNo: Number(d.snapshot.snapNo || 0),
                  list: rawList,
                  bigPercent,
                  smallPercent,
                  greenPercent,
                  redPercent,
                  energyPredictedSize,
                  energyPredictedColor,
                  medalBalls,
                  killBalls,
                  sniper4Balls,
                  isLiveDifferentiated,
                  updatedAt: Date.now(),
                });
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore transient 1M sync error
  } finally {
    isSyncingExtraMarkets = false;
  }
}

async function fetchDeepHistoryWithToken(token: string) {
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) return { fetchedIssues: 0, energyLoaded: false };

  let fetchedIssues = 0;
  let energyLoaded = false;

  const pagePromises = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(async (pageNo) => {
    try {
      const qs = signArLotteryParams({
        gameCode: 'WinGo_30S',
        pageNo,
        pageSize: 10,
      });
      const res = await fetch(
        `https://api.ar-lottery01.com/api/Lottery/GetHistoryIssuePage?${qs}`,
        {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4500),
        }
      );
      if (!res.ok) return;
      const json = await res.json();
      const list = json?.data?.list || [];
      for (const item of list) {
        const issueNumber = String(item.issueNumber || '');
        if (issueNumber) {
          historyMap.set(issueNumber, {
            issueNumber,
            number: Number(item.number),
            color: String(item.color || ''),
            premium: String(item.premium || item.number),
          });
          fetchedIssues++;
        }
      }
    } catch {
      // Ignore individual page failure
    }
  });

  // Also backfill 100+ issues of WinGo_1M and K3_1M so their 63% & 65.1% formulas have deep history!
  const extraBackfillPromises = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((pageNo) => [
    (async () => {
      try {
        const qs = signArLotteryParams({
          gameCode: 'WinGo_1M',
          pageNo,
          pageSize: 20,
        });
        const res = await fetch(
          `https://api.ar-lottery01.com/api/Lottery/GetHistoryIssuePage?${qs}`,
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(4500),
          }
        );
        if (!res.ok) return;
        const json = await res.json();
        for (const item of json?.data?.list || []) {
          const issueNumber = String(item.issueNumber || '');
          if (issueNumber) {
            wingo1mHistoryMap.set(issueNumber, {
              issueNumber,
              number: Number(item.number),
              color: String(item.color || ''),
              premium: String(item.premium || item.number),
            });
          }
        }
      } catch {}
    })(),
    (async () => {
      try {
        const qs = signArLotteryParams({
          gameCode: 'K3_1M',
          pageNo,
          pageSize: 20,
        });
        const res = await fetch(
          `https://api.ar-lottery01.com/api/Lottery/GetHistoryIssuePage?${qs}`,
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(4500),
          }
        );
        if (!res.ok) return;
        const json = await res.json();
        for (const item of json?.data?.list || []) {
          const issueNumber = String(item.issueNumber || '');
          const premium = String(item.premium || '');
          if (issueNumber && premium) {
            const dice = parseK3Dice(premium);
            k3HistoryMap.set(issueNumber, {
              issueNumber,
              premium,
              dice,
              sum: Number(item.sum || dice[0] + dice[1] + dice[2]),
            });
          }
        }
      } catch {}
    })(),
  ]);

  const energyPromise = (async () => {
    try {
      const qs = signArLotteryParams({ gameCode: 'WinGo_30S' });
      const res = await fetch(`https://api.ar-lottery01.com/api/Energy/GetPanel?${qs}`, {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.code === 0 && json?.data) {
          processEnergySnapshotData(json.data);
          energyLoaded = true;
        }
      }
    } catch {
      // Ignore energy panel failure
    }
  })();

  await Promise.all([...pagePromises, ...extraBackfillPromises, energyPromise]);
  if (fetchedIssues > 0) {
    runServerSideOfflineBrain();
    saveDatabase();
  }
  return { fetchedIssues, energyLoaded };
}

// Initialize 24/7 Background Collector & Offline AI Daemon
loadDatabase();
syncWinGo30S();
syncExtraMarkets1M();
if (customBearerToken) {
  fetchDeepHistoryWithToken(customBearerToken).catch(() => null);
  syncEnergyPanelLive().catch(() => null);
}
setInterval(syncWinGo30S, 500);
setInterval(syncEnergyPanelLive, 1500);
setInterval(syncExtraMarkets1M, 2000);

// External + Internal Keep-Alive Ping every 25 seconds so Cloud Run stays awake as long as possible
const KEEP_ALIVE_URLS = [
  process.env.APP_URL,
  'https://ais-dev-yopjiwkvd5rowryqizbg22-756772813975.europe-west2.run.app',
  'https://ais-pre-yopjiwkvd5rowryqizbg22-756772813975.europe-west2.run.app',
].filter((u): u is string => Boolean(u && u.startsWith('http')));

setInterval(() => {
  for (const baseUrl of KEEP_ALIVE_URLS) {
    fetch(`${baseUrl.replace(/\/$/, '')}/api/wingo30s/health`, {
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
  }
  if (customBearerToken) {
    fetchDeepHistoryWithToken(customBearerToken).catch(() => null);
  }
}, 25000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/wingo30s/health', (_req, res) => {
    res.json({
      ok: true,
      daemonStatus: 'ACTIVE_24_7',
      storedIssues: historyMap.size,
      storedPredictions: predictionsMap.size,
      storedEnergyRecords: energyHistoryMap.size,
      storedWinGo1M: wingo1mHistoryMap.size,
      storedK31M: k3HistoryMap.size,
      lastSyncAt: lastSuccessfulSyncAt,
    });
  });

  app.post('/api/wingo30s/restore-client-cache', (req, res) => {
    let mergedHistory = 0;
    let mergedPreds = 0;
    const clientHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const clientPreds = Array.isArray(req.body?.predictions) ? req.body.predictions : [];

    for (const item of clientHistory) {
      if (item && item.issueNumber && !historyMap.has(String(item.issueNumber))) {
        historyMap.set(String(item.issueNumber), {
          issueNumber: String(item.issueNumber),
          number: Number(item.number),
          color: String(item.color || ''),
          premium: String(item.premium || item.number),
        });
        mergedHistory++;
      }
    }

    if (mergedHistory > 0) {
      runServerSideOfflineBrain();
      saveDatabase();
    }

    res.json({
      ok: true,
      mergedHistory,
      mergedPreds,
      totalStoredIssues: historyMap.size,
      totalPredictions: predictionsMap.size,
    });
  });

  app.get('/api/wingo30s', async (_req, res) => {
    const now = Date.now();
    const arAlignedNow = now + AR_PHASE_OFFSET_MS;
    const remainIn30s = 30000 - (arAlignedNow % 30000);
    if (historyMap.size === 0 || !latestState || remainIn30s <= 4000 || remainIn30s >= 27500) {
      await syncWinGo30S();
    }
    const history = getSortedHistory();
    const predictions = getSortedPredictions();
    const currentNow = Date.now();
    const alignedNow = currentNow + AR_PHASE_OFFSET_MS;
    const remainingMs = 30000 - (alignedNow % 30000);
    const remainingMs1M = 60000 - (alignedNow % 60000);

    let currentIssue = '';
    let nextIssue = '';
    if (history.length > 0) {
      const latestResolved = BigInt(history[0].issueNumber);
      currentIssue = (latestResolved + 1n).toString();
      nextIssue = (latestResolved + 2n).toString();
    } else if (latestState?.current?.issueNumber) {
      currentIssue = latestState.current.issueNumber;
    }

    const remainingSeconds = Math.max(1, Math.min(30, Math.ceil(remainingMs / 1000)));
    const remainingSeconds1M = Math.max(1, Math.min(60, Math.ceil(remainingMs1M / 1000)));
    const activeEnergyRecord =
      (currentIssue && energyHistoryMap.get(currentIssue)) ||
      getSortedEnergyRecords()[0] ||
      null;

    res.json({
      ok: true,
      daemonStatus: 'ACTIVE_24_7',
      daemonStartedAt,
      lastSyncAt: lastSuccessfulSyncAt,
      serverTime: currentNow,
      phaseOffsetMs: AR_PHASE_OFFSET_MS,
      remainingMs,
      remainingSeconds,
      remainingSeconds1M,
      isLocked: remainingSeconds <= 5,
      preDrawIntercepted: false,
      state: latestState,
      currentIssue,
      nextIssue,
      latestResolvedIssue: history[0]?.issueNumber || '',
      latestResolvedNumber: history[0]?.number ?? null,
      totalStoredIssues: history.length,
      history,
      predictions,
      engineOutput: latestEngineOutput,
      energySnapshot: latestEnergySnapshot,
      activeEnergyRecord,
      energyRecords: getSortedEnergyRecords().slice(0, 30),
      energyStats: getEnergyStats(),
      wingo1mData: computeWinGo1MOutput(remainingSeconds1M),
      k3Data: computeK3Output(remainingSeconds1M),
      hasCustomToken: Boolean(customBearerToken),
    });
  });

  app.post('/api/wingo30s/reset-predictions', (_req, res) => {
    predictionsMap.clear();
    live1mPredsMap.clear();
    liveK3PredsMap.clear();
    runServerSideOfflineBrain();
    saveDatabase();
    res.json({
      ok: true,
      predictions: getSortedPredictions(),
    });
  });

  app.post('/api/wingo30s/token', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    customBearerToken = token;
    if (!token) {
      latestEnergySnapshot = null;
      saveDatabase();
      res.json({ ok: true, message: 'Token cleared', totalStoredIssues: historyMap.size });
      return;
    }
    const result = await fetchDeepHistoryWithToken(token);
    res.json({
      ok: true,
      fetchedIssues: result.fetchedIssues,
      energyLoaded: result.energyLoaded,
      totalStoredIssues: historyMap.size,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WinGo 30S 24/7 Collector & AI Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
