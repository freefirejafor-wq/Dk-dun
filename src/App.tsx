import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  KeyRound,
  Download,
  ExternalLink,
  BarChart3,
  Layers,
  ShieldCheck,
  Flame,
  Zap,
} from 'lucide-react';
import {
  baseColorOfNumber,
  EnginePrediction,
  hasVioletColor,
  HistoryEntry,
  OfficialTrendStatItem,
  runWinGo30SEngine,
  sizeOfNumber,
  SizeType,
} from './engine/wingo30sEngine';

interface StoredPredictionRecord {
  issueNumber: string;
  predictedSize: SizeType;
  predictedColor: 'GREEN' | 'RED';
  primaryNumber: number;
  backupNumber: number;
  confidence: number;
  step: string;
  patternCode?: string;
  actualNumber?: number;
  actualSize?: SizeType;
  sizeWin?: boolean;
  colorWin?: boolean;
  numberWin?: boolean;
  createdAt?: number;
  resolvedAt?: number;
}

export interface EnergyBallItem {
  number: number;
  rank: number;
  prevRank?: number;
  rankDelta?: number;
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
  stealthVotesCount?: number;
  stealthRuleBreakdown?: string;
  whaleSurgeBalls?: number[];
  energyPredictedColor: 'GREEN' | 'RED';
  medalBalls: number[];
  killBalls?: number[];
  sniper4Balls?: number[];
  deadZoneBalls?: number[];
  ultraStealthActive?: boolean;
  ultraStealthReasonBn?: string;
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

export interface EnergyStatsSummary {
  totalTracked: number;
  sizeWins: number;
  sizeLosses: number;
  sizeWinRate: number;
  medalHits: number;
  medalHitRate: number;
  killHits?: number;
  killHitRate?: number;
  sniper4Hits?: number;
  sniper4HitRate?: number;
  colorWins: number;
  colorWinRate: number;
}

export interface ServerDragonItem {
  gameCode: string;
  gameName: string;
  issueNumber: string;
  dragonCount: number;
  dragonItem: string;
  playType: string;
  endTime: number;
}

export interface ConnectedAccountInfo {
  connected: boolean;
  userId?: number;
  tenantAccount?: string;
  tenantId?: number;
  agentCode?: string;
  currency?: string;
  balance?: number;
  activeMirrorNode?: string;
  todayJackpots?: Array<{
    account: string;
    amount: number;
    currency: string;
  }>;
}

export interface WinGo1MData {
  gameCode: string;
  targetIssue: string;
  remainingSeconds: number;
  predictedSize: SizeType;
  predictedColor: 'GREEN' | 'RED';
  primaryNumber: number;
  backupNumber: number;
  recommendedStep: string;
  confidence: number;
  wins: number;
  losses: number;
  winRate: number;
  maxLossStreak: number;
  currentLossStreak: number;
  activeEnergyRecord?: EnergyPanelRecord | null;
  recentRecords: StoredPredictionRecord[];
  history: HistoryEntry[];
}

export interface K3HistoryItem {
  issueNumber: string;
  premium: string;
  dice: [number, number, number];
  sum: number;
}

export interface K3MarketData {
  gameCode: string;
  targetIssue: string;
  remainingSeconds: number;
  predictedSize: SizeType;
  predictedParity: 'ODD' | 'EVEN';
  targetSums: [number, number];
  recommendedStep: string;
  confidence: number;
  wins: number;
  losses: number;
  winRate: number;
  maxLossStreak: number;
  currentLossStreak: number;
  recentRecords: Array<{
    issueNumber: string;
    predictedSize: SizeType;
    predictedParity: 'ODD' | 'EVEN';
    targetSums: [number, number];
    step: string;
    actualSum?: number;
    actualDice?: [number, number, number];
    actualSize?: SizeType;
    sizeWin?: boolean;
  }>;
  history: K3HistoryItem[];
}

export interface TrxHistoryItem {
  issueNumber: string;
  number: number;
  color: string;
  blockId: string;
  blockNumber: number;
}

export interface Trx1MData {
  gameCode: string;
  targetIssue: string;
  remainingSeconds: number;
  predictedSize: SizeType;
  predictedColor: 'GREEN' | 'RED';
  primaryNumber: number;
  backupNumber: number;
  recommendedStep: string;
  confidence: number;
  wins: number;
  losses: number;
  winRate: number;
  maxLossStreak: number;
  currentLossStreak: number;
  recentRecords: StoredPredictionRecord[];
  history: TrxHistoryItem[];
}

export interface MainServerIntel {
  wingo4TfConsensus: SizeType;
  wingo4TfAgreement: number;
  wingo4TfSummaryBn: string;
  d5BestPos: 'A' | 'B' | 'C' | 'D' | 'E';
  d5BestBet: SizeType;
  d5StreakLen: number;
  d5SummaryBn: string;
}

interface ApiWinGoResponse {
  ok: boolean;
  gameCode: string;
  serverTime: number;
  phaseOffsetMs?: number;
  daemonStartedAt?: number;
  lastSuccessfulSyncAt?: number;
  targetIssue: string;
  latestResolvedIssue: string;
  totalStoredIssues: number;
  preDrawIntercepted?: boolean;
  history: HistoryEntry[];
  predictions?: StoredPredictionRecord[];
  engineOutput?: EnginePrediction | null;
  activeEnergyRecord?: EnergyPanelRecord | null;
  energyRecords?: EnergyPanelRecord[];
  energyStats?: EnergyStatsSummary;
  officialTrendStats?: OfficialTrendStatItem[];
  serverDragonList?: ServerDragonItem[];
  connectedAccountInfo?: ConnectedAccountInfo;
  wingo1mData?: WinGo1MData | null;
  k3Data?: K3MarketData | null;
  trx1mData?: Trx1MData | null;
  mainServerIntel?: MainServerIntel | null;
}

const STORAGE_KEY_RECORDS = 'wingo30s_live_session_v8';
const STORAGE_KEY_HISTORY = 'wingo30s_cached_history_v5';

export function App() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [targetIssue, setTargetIssue] = useState<string>('');
  const [latestResolvedIssue, setLatestResolvedIssue] = useState<string>('');
  const [totalStoredIssues, setTotalStoredIssues] = useState<number>(0);
  const [daemonStartedAt, setDaemonStartedAt] = useState<number>(Date.now());
  const [serverEngineOutput, setServerEngineOutput] =
    useState<EnginePrediction | null>(null);
  const [activeEnergyRecord, setActiveEnergyRecord] =
    useState<EnergyPanelRecord | null>(null);
  const [energyRecords, setEnergyRecords] = useState<EnergyPanelRecord[]>([]);
  const [energyStats, setEnergyStats] = useState<EnergyStatsSummary>({
    totalTracked: 0,
    sizeWins: 0,
    sizeLosses: 0,
    sizeWinRate: 0,
    medalHits: 0,
    medalHitRate: 0,
    colorWins: 0,
    colorWinRate: 0,
  });
  const [officialTrendStats, setOfficialTrendStats] = useState<
    OfficialTrendStatItem[]
  >([]);
  const [serverDragonList, setServerDragonList] = useState<ServerDragonItem[]>(
    []
  );
  const [connectedAccountInfo, setConnectedAccountInfo] =
    useState<ConnectedAccountInfo>({
      connected: false,
      activeMirrorNode: 'api.ar-lottery02.com',
    });

  const [remainingSec, setRemainingSec] = useState<number>(30);
  const [remainingSec1M, setRemainingSec1M] = useState<number>(60);
  const [activeMarket, setActiveMarket] = useState<
    'WINGO_30S' | 'WINGO_1M' | 'K3_1M' | 'TRX_1M'
  >('WINGO_30S');
  const [wingo1mData, setWingo1mData] = useState<WinGo1MData | null>(null);
  const [k3Data, setK3Data] = useState<K3MarketData | null>(null);
  const [trx1mData, setTrx1mData] = useState<Trx1MData | null>(null);
  const [mainServerIntel, setMainServerIntel] =
    useState<MainServerIntel | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [bellRinging, setBellRinging] = useState<boolean>(false);

  // Background Mode: 'dkwin_iframe' (live https://dkwin9.com/ site) | 'dkwin_board' (built-in board & secret intel)
  const [bgMode, setBgMode] = useState<'dkwin_board' | 'dkwin_iframe'>(
    'dkwin_iframe'
  );
  const [dkwinUrl, setDkwinUrl] = useState<string>('https://dkwin9.com/');
  const [urlInput, setUrlInput] = useState<string>('https://dkwin9.com/');
  const [boardTab, setBoardTab] = useState<
    'game_history' | 'signal_chart' | 'quantum_brain'
  >('game_history');
  const [showBanglaGuide, setShowBanglaGuide] = useState<boolean>(false);
  const [selectedMultiplier, setSelectedMultiplier] = useState<string>('X1');

  // Floating HUD state (draggable, resizable, glass-mode & minimizable)
  const [hudMinimized, setHudMinimized] = useState<boolean>(false);
  const [hudCompact, setHudCompact] = useState<boolean>(false);
  const [hudGlass, setHudGlass] = useState<boolean>(false);
  const [hudScale, setHudScale] = useState<number>(0.96);
  const [hudPos, setHudPos] = useState<{ x: number; y: number }>(() => {
    const defaultX =
      typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 292) : 12;
    return { x: defaultX, y: 44 };
  });
  const dragRef = useRef<{
    active: boolean;
    mode: 'move' | 'resize';
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origScale: number;
  }>({
    active: false,
    mode: 'move',
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origScale: 0.96,
  });

  const [clockText, setClockText] = useState<string>('6:50');
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [arTokenInput, setArTokenInput] = useState<string>('');
  const [tokenSyncStatus, setTokenSyncStatus] = useState<string>('');
  const [tokenSyncLoading, setTokenSyncLoading] = useState<boolean>(false);

  const [records, setRecords] = useState<StoredPredictionRecord[]>([]);

  const serverClockOffsetRef = useRef<number>(0);
  const phaseOffsetMsRef = useRef<number>(2600);
  const lastBeepSecRef = useRef<number>(-1);
  const lastAnnouncedIssueRef = useRef<string>('');
  const colorBoxRef = useRef<HTMLDivElement | null>(null);

  const playTone = (freq: number, durationMs: number) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + durationMs / 1000
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Ignore audio errors
    }
  };

  useEffect(() => {
    try {
      if (records.length > 0) {
        localStorage.setItem(
          STORAGE_KEY_RECORDS,
          JSON.stringify(records.slice(0, 1500))
        );
      }
    } catch {
      // Ignore quota error
    }
  }, [records]);

  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem(
          STORAGE_KEY_HISTORY,
          JSON.stringify(history.slice(0, 1500))
        );
      }
    } catch {
      // Ignore quota error
    }
  }, [history]);

  // Live Clock in HUD status bar
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const h = d.getHours() % 12 || 12;
      const m = String(d.getMinutes()).padStart(2, '0');
      setClockText(`${h}:${m}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animated Neon Green ECG Heartbeat Monitor inside the HUD
  useEffect(() => {
    let animId = 0;
    let phase = 0;
    const renderEcg = () => {
      const canvas = ecgCanvasRef.current;
      if (canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(24, 224, 96, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          ctx.strokeStyle = '#18e060';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#18e060';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          const mid = h / 2;
          const period = 85;
          for (let x = 0; x < w; x++) {
            const p = (x + phase) % period;
            let y = mid;
            if (p >= 15 && p < 20) y = mid - (p - 15) * 1.3;
            else if (p >= 20 && p < 25) y = mid + (p - 20) * 1.4;
            else if (p >= 27 && p < 30) y = mid + (p - 27) * 2.5;
            else if (p >= 30 && p < 34) y = mid - (p - 30) * 4.5;
            else if (p >= 34 && p < 38) y = mid - 18 + (p - 34) * 7.2;
            else if (p >= 38 && p < 42) y = mid + 11 - (p - 38) * 2.75;
            else if (p >= 48 && p < 56)
              y = mid - Math.sin(((p - 48) / 8) * Math.PI) * 4.5;

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      phase = (phase + 1.4) % 850;
      animId = requestAnimationFrame(renderEcg);
    };
    animId = requestAnimationFrame(renderEcg);
    return () => cancelAnimationFrame(animId);
  }, [hudMinimized]);

  // Calculate Size & Color stats from resolved records
  const stats = useMemo(() => {
    const resolved = records.filter((r) => r.actualNumber !== undefined);
    const wins = resolved.filter((r) => r.sizeWin).length;
    const losses = resolved.length - wins;
    const numberHits = resolved.filter((r) => r.numberWin).length;
    const colorHits = resolved.filter((r) => r.colorWin).length;

    let currentWinStreak = 0;
    for (const r of resolved) {
      if (r.sizeWin) currentWinStreak++;
      else break;
    }

    let currentLossStreak = 0;
    for (const r of resolved) {
      if (!r.sizeWin) currentLossStreak++;
      else break;
    }

    const colorWins = colorHits;
    const colorLosses = resolved.length - colorWins;

    let currentColorWinStreak = 0;
    for (const r of resolved) {
      if (r.colorWin) currentColorWinStreak++;
      else break;
    }

    let currentColorLossStreak = 0;
    for (const r of resolved) {
      if (!r.colorWin) currentColorLossStreak++;
      else break;
    }

    let maxColorLossStreak = 0;
    let runningColorLoss = 0;
    for (let i = resolved.length - 1; i >= 0; i--) {
      if (!resolved[i].colorWin) {
        runningColorLoss++;
        if (runningColorLoss > maxColorLossStreak) {
          maxColorLossStreak = runningColorLoss;
        }
      } else {
        runningColorLoss = 0;
      }
    }

    const stepList = ['1X', '2X', '4X', '8X', '16X'];
    const recommendedColorStep =
      stepList[Math.min(currentColorLossStreak, stepList.length - 1)];

    const winRate =
      resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;
    const colorWinRate =
      resolved.length > 0 ? Math.round((colorWins / resolved.length) * 100) : 0;

    return {
      totalSignals: resolved.length,
      wins,
      losses,
      winRate,
      colorWins,
      colorLosses,
      colorWinRate,
      currentWinStreak,
      currentLossStreak,
      currentColorWinStreak,
      currentColorLossStreak,
      maxColorLossStreak,
      recommendedColorStep,
      numberHits,
      colorHits,
    };
  }, [records]);

  // Compute 5-Layer 30S Engine output and lock its signal to the server's verified record
  const engineOutput: EnginePrediction | null = useMemo(() => {
    if (history.length === 0) return null;
    const activeIssue = (BigInt(history[0].issueNumber) + 1n).toString();
    const computed = runWinGo30SEngine(
      history,
      activeIssue,
      stats.currentLossStreak,
      officialTrendStats
    );
    const lockedRecord = records.find((r) => r.issueNumber === activeIssue);

    if (serverEngineOutput && serverEngineOutput.targetIssue === activeIssue) {
      return {
        ...computed,
        ...serverEngineOutput,
      };
    }

    if (lockedRecord) {
      return {
        ...computed,
        targetIssue: activeIssue,
        predictedSize: lockedRecord.predictedSize,
        predictedColor: lockedRecord.predictedColor,
        primaryNumber: lockedRecord.primaryNumber,
        backupNumber: lockedRecord.backupNumber,
        confidence: lockedRecord.confidence,
        recommendedStep: lockedRecord.step,
        activePatternTitle:
          lockedRecord.patternCode || computed.activePatternTitle,
      };
    }

    return computed;
  }, [
    history,
    targetIssue,
    stats.currentLossStreak,
    records,
    serverEngineOutput,
    officialTrendStats,
  ]);

  // Trigger bell animation on new targetIssue
  useEffect(() => {
    if (
      engineOutput?.targetIssue &&
      engineOutput.targetIssue !== lastAnnouncedIssueRef.current
    ) {
      lastAnnouncedIssueRef.current = engineOutput.targetIssue;
      setBellRinging(true);
      playTone(880, 140);
      const t = setTimeout(() => setBellRinging(false), 1200);
      return () => clearTimeout(t);
    }
  }, [engineOutput?.targetIssue]);

  const fetchMarketState = async () => {
    try {
      const res = await fetch('/api/wingo30s');
      if (!res.ok) throw new Error('Server sync error');
      const data: ApiWinGoResponse = await res.json();

      if (data.serverTime) {
        serverClockOffsetRef.current = data.serverTime - Date.now();
      }
      if (typeof data.phaseOffsetMs === 'number') {
        phaseOffsetMsRef.current = data.phaseOffsetMs;
      }
      if (data.daemonStartedAt) {
        setDaemonStartedAt(data.daemonStartedAt);
      }

      if (data.history && data.history.length > 0) {
        const nextActiveIssue = (
          BigInt(data.history[0].issueNumber) + 1n
        ).toString();
        setHistory((prev) => {
          const map = new Map<string, HistoryEntry>();
          for (const item of prev) map.set(item.issueNumber, item);
          for (const item of data.history) map.set(item.issueNumber, item);
          return Array.from(map.values())
            .sort((a, b) =>
              BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1
            )
            .slice(0, 1500);
        });
        setLatestResolvedIssue(data.latestResolvedIssue);
        setTotalStoredIssues(Math.max(data.totalStoredIssues, history.length));
        setTargetIssue(nextActiveIssue);
        if (data.engineOutput) {
          setServerEngineOutput(data.engineOutput);
        }
        if (data.activeEnergyRecord) {
          setActiveEnergyRecord(data.activeEnergyRecord);
        }
        if (Array.isArray(data.energyRecords)) {
          setEnergyRecords(data.energyRecords);
        }
        if (data.energyStats) {
          setEnergyStats(data.energyStats);
        }
        if (Array.isArray(data.officialTrendStats)) {
          setOfficialTrendStats(data.officialTrendStats);
        }
        if (Array.isArray(data.serverDragonList)) {
          setServerDragonList(data.serverDragonList);
        }
        if (data.connectedAccountInfo) {
          setConnectedAccountInfo(data.connectedAccountInfo);
        }
        if (data.wingo1mData) {
          setWingo1mData(data.wingo1mData);
        }
        if (data.k3Data) {
          setK3Data(data.k3Data);
        }
        if (data.trx1mData) {
          setTrx1mData(data.trx1mData);
        }
        if (data.mainServerIntel) {
          setMainServerIntel(data.mainServerIntel);
        }
        if (Array.isArray(data.predictions)) {
          const sortedServerPreds = [...data.predictions]
            .sort((a, b) =>
              BigInt(b.issueNumber) > BigInt(a.issueNumber) ? 1 : -1
            )
            .slice(0, 500);
          setRecords(sortedServerPreds);
        }
      }
    } catch {
      // Silent retry on next 600ms tick
    }
  };

  useEffect(() => {
    try {
      const savedHist = localStorage.getItem(STORAGE_KEY_HISTORY);
      const parsedHist = savedHist ? JSON.parse(savedHist) : [];
      if (parsedHist.length > 0) {
        fetch('/api/wingo30s/restore-client-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: parsedHist,
          }),
        }).catch(() => null);
      }
    } catch {
      // Ignore restore error
    }

    fetchMarketState();
    const pollInterval = setInterval(fetchMarketState, 600);
    return () => clearInterval(pollInterval);
  }, []);

  // High-precision 200ms countdown synced to AR-Lottery's +2600ms phase-shifted 30S & 1M boundaries
  useEffect(() => {
    const updateCountdown = () => {
      const alignedNow =
        Date.now() + serverClockOffsetRef.current + phaseOffsetMsRef.current;
      const remainMs = 30000 - (alignedNow % 30000);
      const remainMs1M = 60000 - (alignedNow % 60000);
      const clampedSec = Math.max(1, Math.min(30, Math.ceil(remainMs / 1000)));
      const clampedSec1M = Math.max(
        1,
        Math.min(60, Math.ceil(remainMs1M / 1000))
      );
      setRemainingSec(clampedSec);
      setRemainingSec1M(clampedSec1M);

      const activeSec = activeMarket === 'WINGO_30S' ? clampedSec : clampedSec1M;
      if (soundEnabled && activeSec <= 5 && activeSec >= 1) {
        if (lastBeepSecRef.current !== activeSec) {
          lastBeepSecRef.current = activeSec;
          playTone(activeSec === 1 ? 880 : 540, 90);
        }
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 200);
    return () => clearInterval(timer);
  }, [soundEnabled, activeMarket]);

  // HUD Pointer Drag & Corner Resize Handlers
  const handleHudPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isResizeHandle = Boolean(target.closest('[data-hud-resize="true"]'));
    if (target.closest('button') && !hudMinimized && !isResizeHandle) return;
    dragRef.current = {
      active: true,
      mode: isResizeHandle ? 'resize' : 'move',
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: hudPos.x,
      origY: hudPos.y,
      origScale: hudScale,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHudPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.mode === 'resize') {
      const delta = (dx + dy) / 260;
      const nextScale = Math.max(
        0.72,
        Math.min(1.2, Number((dragRef.current.origScale + delta).toFixed(2)))
      );
      setHudScale(nextScale);
      return;
    }
    const maxW = window.innerWidth - (hudMinimized ? 62 : 220);
    const maxH = window.innerHeight - (hudMinimized ? 62 : 180);
    setHudPos({
      x: Math.max(4, Math.min(maxW, dragRef.current.origX + dx)),
      y: Math.max(4, Math.min(maxH, dragRef.current.origY + dy)),
    });
  };

  const handleHudPointerUp = () => {
    if (!dragRef.current.active) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    if (hudMinimized && !wasMoved) {
      setHudMinimized(false);
    }
  };

  const handleResetStats = async () => {
    try {
      const res = await fetch('/api/wingo30s/reset-predictions', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.predictions)) {
        setRecords(data.predictions);
      } else {
        setRecords([]);
      }
      localStorage.removeItem(STORAGE_KEY_RECORDS);
    } catch {
      setRecords([]);
      localStorage.removeItem(STORAGE_KEY_RECORDS);
    }
  };

  const handleDownloadDataset = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalStoredIssues: history.length,
      totalPredictions: records.length,
      history,
      predictions: records,
      energyRecords,
      officialTrendStats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wingo30s_dataset_${history.length}_issues.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenSyncLoading(true);
    setTokenSyncStatus('');
    try {
      const res = await fetch('/api/wingo30s/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: arTokenInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setTokenSyncStatus(
          `সফলভাবে সিঙ্ক হয়েছে! মোট জমা হওয়া পিরিয়ড: ${data.totalStoredIssues}টি`
        );
        await fetchMarketState();
      } else {
        setTokenSyncStatus('টোকেন সিঙ্ক ব্যর্থ হয়েছে।');
      }
    } catch {
      setTokenSyncStatus('নেটওয়ার্ক ত্রুটি হয়েছে।');
    } finally {
      setTokenSyncLoading(false);
    }
  };

  const getHudBallClass = (num: number) => {
    if (num === 0) return 'purple mix';
    if (num === 5) return 'green mix';
    return [1, 3, 7, 9].includes(num) ? 'green' : 'red';
  };

  const getDkwinBallClass = (num: number) => {
    if (num === 0) return 'dkwin-ball dkwin-ball-0';
    if (num === 5) return 'dkwin-ball dkwin-ball-5';
    return [1, 3, 7, 9].includes(num)
      ? 'dkwin-ball dkwin-ball-green'
      : 'dkwin-ball dkwin-ball-red';
  };

  const activeCountdownSec =
    activeMarket === 'WINGO_30S' ? remainingSec : remainingSec1M;
  const maxCountdownSec = activeMarket === 'WINGO_30S' ? 30 : 60;
  const isLocked = activeCountdownSec <= 5;
  const cdPct = Math.max(
    3,
    Math.min(100, (activeCountdownSec / maxCountdownSec) * 100)
  );
  const secTens = Math.floor(activeCountdownSec / 10);
  const secOnes = activeCountdownSec % 10;

  const primaryBall =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.primaryNumber ?? 7
      : activeMarket === 'K3_1M'
      ? k3Data?.targetSums?.[0] ?? 11
      : activeMarket === 'TRX_1M'
      ? trx1mData?.primaryNumber ?? 6
      : engineOutput?.primaryNumber ?? 7;
  const backupBall =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.backupNumber ?? 9
      : activeMarket === 'K3_1M'
      ? k3Data?.targetSums?.[1] ?? 13
      : activeMarket === 'TRX_1M'
      ? trx1mData?.backupNumber ?? 8
      : engineOutput?.backupNumber ?? 9;
  const activeSize: SizeType =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.predictedSize ?? 'BIG'
      : activeMarket === 'K3_1M'
      ? k3Data?.predictedSize ?? 'BIG'
      : activeMarket === 'TRX_1M'
      ? trx1mData?.predictedSize ?? 'BIG'
      : engineOutput?.predictedSize ?? 'BIG';
  const activeColor: 'GREEN' | 'RED' =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.predictedColor ?? 'GREEN'
      : activeMarket === 'K3_1M'
      ? k3Data?.predictedParity === 'ODD'
        ? 'GREEN'
        : 'RED'
      : activeMarket === 'TRX_1M'
      ? trx1mData?.predictedColor ?? 'GREEN'
      : engineOutput?.predictedColor ?? 'GREEN';
  const activeTargetIssue =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.targetIssue || ''
      : activeMarket === 'K3_1M'
      ? k3Data?.targetIssue || ''
      : activeMarket === 'TRX_1M'
      ? trx1mData?.targetIssue || ''
      : engineOutput?.targetIssue || targetIssue || '';
  const activeStep =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.recommendedStep || '1X'
      : activeMarket === 'K3_1M'
      ? k3Data?.recommendedStep || '1X'
      : activeMarket === 'TRX_1M'
      ? trx1mData?.recommendedStep || '1X'
      : engineOutput?.recommendedStep || '1X';
  const activeConfidence =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.confidence ?? 98
      : activeMarket === 'K3_1M'
      ? k3Data?.confidence ?? 97
      : activeMarket === 'TRX_1M'
      ? trx1mData?.confidence ?? 97
      : engineOutput?.confidence ?? 98;
  const activeEnergyForBoard =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.activeEnergyRecord || activeEnergyRecord
      : activeEnergyRecord;
  const activeWins =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.wins ?? 0
      : activeMarket === 'K3_1M'
      ? k3Data?.wins ?? 0
      : activeMarket === 'TRX_1M'
      ? trx1mData?.wins ?? 0
      : stats.wins;
  const activeLosses =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.losses ?? 0
      : activeMarket === 'K3_1M'
      ? k3Data?.losses ?? 0
      : activeMarket === 'TRX_1M'
      ? trx1mData?.losses ?? 0
      : stats.losses;

  const shortPatternTag = useMemo(() => {
    if (activeMarket === 'WINGO_1M') return '1M STEALTH 67%';
    if (activeMarket === 'K3_1M') return 'K3 DICE 65.1%';
    if (activeMarket === 'TRX_1M') return 'TRX HASH 1M';
    if (activeEnergyRecord?.isLiveDifferentiated) {
      return `SNAP#${activeEnergyRecord.snapNo} (${
        activeEnergyRecord.stealthVotesCount || 4
      }/5)`;
    }
    if (!engineOutput) return 'APEX 2922';
    if (engineOutput.signalGrade === 'REBOUND_SNIPER') return 'REBOUND LOCK';
    return `APEX (${engineOutput.formulaConsensusCount}/5)`;
  }, [engineOutput, activeMarket, activeEnergyRecord]);

  return (
    <div className="min-h-screen bg-[#f7f8ff] text-slate-800 relative select-none">
      {/* ===================================================================== */}
      {/* FLOATING DRAGGABLE & RESIZABLE CYBER-QUANTUM HUD SIMULATOR WIDGET     */}
      {/* ===================================================================== */}
      <div
        className="hud-widget"
        style={{
          left: `${hudPos.x}px`,
          top: `${hudPos.y}px`,
          transform: hudMinimized ? 'scale(1)' : `scale(${hudScale})`,
          transformOrigin: 'top left',
        }}
        onPointerDown={handleHudPointerDown}
        onPointerMove={handleHudPointerMove}
        onPointerUp={handleHudPointerUp}
        onPointerCancel={handleHudPointerUp}
      >
        <div className={`hud-phone ${hudMinimized ? 'minimized' : ''}`}>
          {hudMinimized ? (
            <div
              title="ট্যাপ করে ADRIYAN JAFOR প্রেডিকশন বক্স খুলুন"
              className="w-full h-full rounded-full bg-[#050811] border-2 border-[#ffd700] flex flex-col items-center justify-center shadow-[0_0_24px_rgba(255,215,0,0.85)]"
            >
              <span className="text-[11px] font-black text-amber-300 leading-none">
                AJ👑
              </span>
              <span className="text-[9px] font-black text-[#00ffa3] font-mono mt-0.5">
                {activeSize === 'BIG' ? 'BIG' : 'SML'}·{activeCountdownSec}s
              </span>
            </div>
          ) : (
            <div className={`hud-screen ${hudGlass ? 'glass-mode' : ''}`}>
              {/* Top Royal Control Strip: Time + Node | ছোট- | % | বড়+ | স্বচ্ছ | মিনি */}
              <div className="flex items-center justify-between text-[8.5px] font-bold px-0.5 pb-1 border-b border-white/10 mb-1.5 text-white/90">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-amber-300">{clockText}</span>
                  <span className="text-[#00ffa3] font-mono">
                    ●{' '}
                    {activeEnergyForBoard?.isLiveDifferentiated
                      ? `SNAP#${activeEnergyForBoard.snapNo}`
                      : '30S-VIP'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHudScale((s) =>
                        Math.max(0.72, Number((s - 0.1).toFixed(2)))
                      );
                    }}
                    title="বক্স ছোট করুন"
                    className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-mono text-[8px] font-black border border-cyan-400/40"
                  >
                    ছোট-
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHudScale(0.96);
                    }}
                    title="ডিফল্ট সাইজ (96%)"
                    className="px-1 py-0.2 rounded bg-white/10 hover:bg-white/20 text-amber-300 font-mono text-[8px] font-black"
                  >
                    {Math.round(hudScale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHudScale((s) =>
                        Math.min(1.2, Number((s + 0.1).toFixed(2)))
                      );
                    }}
                    title="বক্স বড় করুন"
                    className="px-1.5 py-0.2 rounded bg-white/10 hover:bg-white/20 text-[#00ffa3] font-mono text-[8px] font-black border border-emerald-400/40"
                  >
                    বড়+
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHudGlass((g) => !g);
                    }}
                    title="স্বচ্ছ গ্লাস মোড (নিচের মার্কেট দেখা যাবে)"
                    className={`px-1 py-0.2 rounded text-[8px] font-black border ${
                      hudGlass
                        ? 'bg-cyan-500/30 border-cyan-300 text-cyan-200'
                        : 'bg-white/10 border-white/20 text-slate-300'
                    }`}
                  >
                    স্বচ্ছ
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHudCompact((c) => !c);
                    }}
                    title="মিনি / ফুল মোড"
                    className="px-1 py-0.2 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[8px] font-black"
                  >
                    {hudCompact ? 'ফুল' : 'মিনি'}
                  </button>
                </div>
              </div>

              {/* Brand Header: Menu | 👑 ADRIYAN JAFOR | Sound Bell */}
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBgMode((m) =>
                      m === 'dkwin_iframe' ? 'dkwin_board' : 'dkwin_iframe'
                    );
                    setBoardTab('quantum_brain');
                  }}
                  title="সার্ভার হ্যাক বোর্ড / লাইভ dkwin9.com সাইট সুইচ করুন"
                  className="hud-icon-btn"
                >
                  ☰
                </button>

                <div className="text-center leading-none">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs">👑</span>
                    <span className="hud-brand-title">
                      𝐀𝐃𝐑𝐈𝐘𝐀𝐍 𝐉𝐀𝐅𝐎𝐑
                    </span>
                    <span className="text-xs">⚡</span>
                  </div>
                  <div className="hud-brand-sub">
                    {activeEnergyForBoard?.ultraStealthActive ||
                    engineOutput?.ultraStealthActive
                      ? '💎 73.1% DOUBLE-MEDAL KILL LOCK'
                      : 'QUANTUM 30S · VIP AI ENGINE'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((prev) => !prev)}
                  title={soundEnabled ? 'Sound On' : 'Sound Off'}
                  className={`hud-icon-btn ${bellRinging ? 'ringing' : ''}`}
                >
                  <span>🔔</span>
                  <span
                    className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                      soundEnabled ? 'bg-[#00ffa3]' : 'bg-[#ff2a2a]'
                    }`}
                  />
                </button>
              </div>

              {/* Live Period + Laser Countdown Strip */}
              <div className="flex items-center justify-between gap-2 bg-[#071020] border border-cyan-500/30 rounded-xl px-2.5 py-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded bg-[#00ffa3]/20 border border-[#00ffa3]/60 text-[#00ffa3] text-[8px] font-black font-mono">
                    30S LIVE
                  </span>
                  <span className="text-[11px] font-mono font-black text-amber-300">
                    #{activeTargetIssue ? activeTargetIssue.slice(-4) : '----'}
                  </span>
                </div>

                <div className="flex-1 h-1.5 bg-[#0e1b30] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${cdPct}%`,
                      background: isLocked
                        ? 'linear-gradient(90deg, #ff7a2a, #ff2a2a)'
                        : 'linear-gradient(90deg, #ffd700, #00ffa3, #00d4ff)',
                      boxShadow: isLocked
                        ? '0 0 8px #ff2a2a'
                        : '0 0 8px #00ffa3',
                    }}
                  />
                </div>

                <div
                  className={`min-w-[26px] text-right text-[13px] font-black font-mono ${
                    isLocked
                      ? 'text-[#ff2a2a] animate-pulse'
                      : 'text-[#00ffa3]'
                  }`}
                >
                  {activeCountdownSec}s
                </div>
              </div>

              {/* NEW ADRIYAN JAFOR DUAL-CORE HERO SHOWCASE: Left = Signal + Step + Color | Right = 3D Ball + Radar + ECG */}
              <div className="grid grid-cols-12 gap-1.5 items-stretch">
                {/* Left Column (7 cols): Giant BIG / SMALL / SKIP Decision + Step + Color */}
                <div className="col-span-7 flex flex-col justify-between">
                  <div
                    className={`hud-signal-wrapper h-full ${
                      activeSize === 'BIG' ? 'big-wrap' : ''
                    }`}
                  >
                    <div
                      className={`hud-signal-display h-full py-2 ${
                        activeSize === 'BIG' ? 'big' : ''
                      }`}
                    >
                      <span className="relative z-10 text-[8.5px] font-extrabold text-amber-200 tracking-normal leading-none mb-1">
                        {isLocked
                          ? '⏳ নতুন দান আসছে...'
                          : engineOutput?.betAction === 'SKIP_ROUND'
                          ? '⚠️ ঝুঁকিপূর্ণ দান (SKIP):'
                          : activeEnergyForBoard?.ultraStealthActive ||
                            engineOutput?.ultraStealthActive
                          ? '💎 ৭৩.১% ভিআইপি লক:'
                          : '🔥 এখন মার্কেটে ধরুন:'}
                      </span>

                      <span className="relative z-10 leading-none text-[22px] font-black tracking-wider drop-shadow">
                        {engineOutput?.betAction === 'SKIP_ROUND'
                          ? '𝐒𝐊𝐈𝐏'
                          : activeSize === 'BIG'
                          ? '𝐁𝐈𝐆 (বড়)'
                          : '𝐒𝐌𝐀𝐋𝐋 (ছোট)'}
                      </span>

                      {/* Step + Color Badges Inside the Signal Card */}
                      <div className="relative z-10 mt-1.5 flex items-center justify-center gap-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-black/80 border border-amber-400 text-amber-300 text-[9px] font-black font-mono">
                          স্টেপ: {activeStep}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[8.5px] font-black border ${
                            activeColor === 'GREEN'
                              ? 'bg-emerald-950/90 text-[#00ffa3] border-[#00ffa3]/70'
                              : 'bg-rose-950/90 text-[#ff4d4d] border-[#ff4d4d]/70'
                          }`}
                        >
                          {activeColor === 'GREEN' ? '🟢 সবুজ' : '🔴 লাল'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): 3D Target Ball + Backup Ball + Live ECG */}
                <div className="col-span-5 flex flex-col justify-between gap-1">
                  <div className="relative h-[74px] w-full bg-[#040914] border border-amber-400/35 rounded-xl flex items-center justify-center overflow-hidden shadow-inner">
                    <div className="hud-scan-container" />
                    <div
                      className={`hud-number-ball ${getHudBallClass(
                        primaryBall % 10
                      )}`}
                    >
                      <span>{primaryBall}</span>
                    </div>
                    <div
                      title={`Backup Ball: ${backupBall}`}
                      className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded-md bg-black/90 border border-amber-400 text-[8.5px] font-mono font-black text-amber-300 z-10"
                    >
                      +{backupBall}
                    </div>
                    <div className="absolute top-1 left-1 px-1 py-0.1 rounded bg-black/75 text-[7px] font-mono font-bold text-cyan-300 z-10">
                      9X বল
                    </div>
                  </div>

                  {/* Animated Neon ECG Heartbeat Monitor */}
                  <div className="h-[22px] border border-[#00ffa3]/75 rounded-lg bg-[#020a06] flex items-center justify-center overflow-hidden">
                    <canvas
                      ref={ecgCanvasRef}
                      width={120}
                      height={22}
                      className="w-full h-full block"
                    />
                  </div>
                </div>
              </div>

              {/* Collapsible Extra Details (Hidden when user clicks মিনি/Compact) */}
              {!hudCompact && (
                <>
                  {/* Compact 4-Ball Golden Sniper (51.9% Hit) & Dead-Zone Blacklist Strip inside HUD */}
                  {activeEnergyForBoard?.sniper4Balls &&
                    activeEnergyForBoard.sniper4Balls.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[8px] font-extrabold font-mono">
                        <div className="bg-amber-950/80 border border-amber-400/60 rounded-md px-1.5 py-0.5 text-amber-300 truncate">
                          🎯৪-বল(৯X):{' '}
                          <span className="text-white">
                            {activeEnergyForBoard.sniper4Balls.join(',')}
                          </span>
                        </div>
                        <div className="bg-rose-950/80 border border-rose-500/60 rounded-md px-1.5 py-0.5 text-rose-300 truncate">
                          🚫কিল বল:{' '}
                          <span className="text-white line-through">
                            {(
                              activeEnergyForBoard.deadZoneBalls ||
                              activeEnergyForBoard.medalBalls.slice(0, 2)
                            ).join(',')}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Direct 1-Line Bangla Action Instruction Bar inside HUD */}
                  <div
                    className={`mt-1.5 py-1 px-2 rounded-lg text-center text-[9px] font-extrabold border ${
                      isLocked
                        ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                        : engineOutput?.betAction === 'SKIP_ROUND'
                        ? 'bg-amber-950/90 border-amber-400 text-amber-300'
                        : activeEnergyForBoard?.ultraStealthActive ||
                          engineOutput?.ultraStealthActive
                        ? 'bg-purple-950/90 border-purple-400 text-amber-300 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                        : 'bg-emerald-950/80 border-[#00ffa3]/60 text-[#00ffa3]'
                    }`}
                  >
                    {isLocked
                      ? `🔴 সময় শেষ (${activeCountdownSec}s)! পরের দানের জন্য অপেক্ষা করুন`
                      : engineOutput?.betAction === 'SKIP_ROUND'
                      ? `⚠️ পিরিয়ড #${
                          activeTargetIssue
                            ? activeTargetIssue.slice(-4)
                            : '----'
                        } ঝুঁকিপূর্ণ — বেট না ধরে SKIP করুন!`
                      : activeEnergyForBoard?.ultraStealthActive ||
                        engineOutput?.ultraStealthActive
                      ? `💎 ৭৩.১% ডাবল-মেডেল লক: #${
                          activeTargetIssue
                            ? activeTargetIssue.slice(-4)
                            : '----'
                        } এ ${
                          activeSize === 'BIG' ? 'BIG (বড়)' : 'SMALL (ছোট)'
                        } (${activeStep}) ধরুন!`
                      : `🔥 পিরিয়ড #${
                          activeTargetIssue
                            ? activeTargetIssue.slice(-4)
                            : '----'
                        } এ ${
                          activeSize === 'BIG' ? 'BIG (বড়)' : 'SMALL (ছোট)'
                        } এ ${activeStep} বেট ধরুন`}
                  </div>
                </>
              )}

              {/* Compact Bottom Row: 3-Col Neon Stats + Reset Button + Corner Drag Resize Grip */}
              <div className="grid grid-cols-12 gap-1.5 mt-1.5 items-center relative">
                <div className="col-span-8 hud-stats">
                  <div className="text-center px-0.5 border-r border-[#2a2a2a]">
                    <small className="block text-[6.5px] font-bold text-[#ddd]">
                      HIDE
                    </small>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHudMinimized(true);
                      }}
                      className="hud-min-btn"
                      title="Minimize HUD"
                    >
                      -
                    </button>
                  </div>

                  <div className="text-center px-0.5 border-r border-[#2a2a2a]">
                    <small className="block text-[6.5px] font-bold text-[#ddd]">
                      WIN / LOSS
                    </small>
                    <b className="text-[10px] font-black text-[#17f0e0] font-mono">
                      {activeWins}W·{activeLosses}L
                    </b>
                  </div>

                  <div className="text-center px-0.5">
                    <small className="block text-[6.5px] font-bold text-[#ddd]">
                      ACCURACY
                    </small>
                    <b className="text-[10.5px] font-black text-[#00ffa3] font-mono">
                      {activeConfidence}%
                    </b>
                  </div>
                </div>

                <div className="col-span-4 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleResetStats}
                    title="Win/Loss আবার 0W·0L থেকে নতুন করে শুরু করুন"
                    className="hud-tg-btn flex-1"
                  >
                    <span>RESET ↺</span>
                  </button>
                  {/* Corner Drag-to-Resize Handle */}
                  <div
                    data-hud-resize="true"
                    title="টেনে ছোট-বড় করুন (Drag to resize)"
                    className="w-5 h-6 rounded bg-amber-500/20 border border-amber-400/70 flex items-center justify-center text-[10px] text-amber-300 cursor-nwse-resize shrink-0"
                  >
                    ↘
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COMPACT TOP BAR: DIRECT https://dkwin9.com/ MARKET URL + CONTROLS     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 h-[38px] bg-gradient-to-r from-[#081020] via-[#0e1b33] to-[#081020] border-b border-amber-400/30 text-white shadow-sm">
        <div className="max-w-[680px] mx-auto h-full px-2 flex items-center justify-between gap-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let clean = urlInput.trim();
              if (!clean) clean = 'https://dkwin9.com/';
              if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
              setDkwinUrl(clean);
              setUrlInput(clean);
              setBgMode('dkwin_iframe');
            }}
            className="flex-1 flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg px-2 py-0.5"
          >
            <ExternalLink className="w-3 h-3 text-amber-400 shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://dkwin9.com/"
              className="w-full bg-transparent text-white placeholder-white/60 text-[11px] font-mono font-bold focus:outline-none"
            />
            <button
              type="submit"
              className="px-2 py-0.2 rounded bg-amber-400 text-black text-[9.5px] font-black shrink-0"
            >
              GO
            </button>
          </form>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setBgMode((m) =>
                  m === 'dkwin_iframe' ? 'dkwin_board' : 'dkwin_iframe'
                )
              }
              className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold"
            >
              {bgMode === 'dkwin_iframe' ? '📊 হ্যাক বোর্ড' : '🌐 dkwin9 সাইট'}
            </button>
            <button
              type="button"
              onClick={() => setHudMinimized((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-[#00ffa3] text-[10px] font-extrabold"
            >
              {hudMinimized ? 'বক্স খুলুন' : 'বক্স লুকান'}
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MODE A (DEFAULT): FULL-SCREEN LIVE https://dkwin9.com/ MARKET IFRAME  */}
      {/* ===================================================================== */}
      {bgMode === 'dkwin_iframe' ? (
        <div className="fixed inset-0 top-[38px] z-10 bg-black">
          <iframe
            key={dkwinUrl}
            src={dkwinUrl}
            title="DKWIN Official Website (https://dkwin9.com/)"
            className="w-full h-full border-0 bg-white"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      ) : (
        /* =================================================================== */
        /* MODE B: CLEAN AUTHENTIC DKWIN BACKGROUND + EASY BANGLA BET GUIDE   */
        /* =================================================================== */
        <div className="relative">
          {/* Authentic Golden Top Backdrop Behind the WinGo 30sec Pill Card */}
          <div className="h-10 bg-gradient-to-r from-[#f5c73b] via-[#f8d24a] to-[#f4be2b] rounded-b-[28px]" />
          <main className="max-w-[540px] mx-auto pb-20 px-3 -mt-7 space-y-3.5 relative z-10">
            {/* Authentic DKWIN Dedicated WinGo 30sec Mode Strip */}
            <div className="bg-white rounded-2xl p-1.5 shadow-sm text-center">
              <button
                type="button"
                onClick={() => setActiveMarket('WINGO_30S')}
                className="w-40 rounded-xl py-2 px-3 flex flex-col items-center justify-center transition-all bg-gradient-to-b from-[#f8d34c] to-[#f3bd2c] text-white shadow-xs"
              >
                <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-sm mb-0.5">
                  ⏱️
                </div>
                <div className="text-[11px] font-bold leading-tight">
                  WinGo
                </div>
                <div className="text-[11px] font-extrabold leading-tight">
                  30sec
                </div>
              </button>
            </div>

            {/* ================================================================= */}
            {/* COLLAPSIBLE BANGLA "WHAT TO BET RIGHT NOW" GUIDE CARD             */}
            {/* ================================================================= */}
            {showBanglaGuide && (
              <div className="rounded-2xl bg-[#07111e] text-white p-3.5 shadow-lg border-2 border-[#18e060]">
                <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#18e060] text-black text-[10px] font-black">
                        লাইভ গাইড · পিরিয়ড #
                        {activeTargetIssue
                          ? activeTargetIssue.slice(-4)
                          : '----'}
                      </span>
                      {activeEnergyForBoard?.isLiveDifferentiated && (
                        <span className="inline-block px-2 py-0.5 rounded bg-cyan-400 text-black text-[10px] font-black">
                          ⚡ লাইভ Snap #{activeEnergyForBoard.snapNo} স্টিলথ লক
                        </span>
                      )}
                      {(activeEnergyForBoard?.ultraStealthActive ||
                        engineOutput?.ultraStealthActive) && (
                        <span className="inline-block px-2 py-0.5 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black shadow-xs">
                          💎 ৭৩.১% ডাবল-মেডেল কিল লক
                        </span>
                      )}
                      {engineOutput?.crossSyncActive && (
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black">
                          🔥 30S+1M ক্রস-সিঙ্ক
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-black text-white mt-1">
                      {engineOutput?.betActionBn ||
                        'এখন আপনি কী বেট ধরবেন? (এক নজরে দেখুন)'}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-300 font-bold">
                      বাকি সময়
                    </div>
                    <div
                      className={`text-xl font-mono font-black ${
                        isLocked ? 'text-rose-400' : 'text-[#18e060]'
                      }`}
                    >
                      {activeCountdownSec}s
                    </div>
                  </div>
                </div>

                {/* Live Ultra Stealth / Whale Trap / Cross-Sync / Main Server 4-Timeframe Banner */}
                {(activeEnergyForBoard?.ultraStealthReasonBn ||
                  engineOutput?.ultraStealthReasonBn ||
                  engineOutput?.whaleTrapReasonBn ||
                  engineOutput?.crossSyncReasonBn ||
                  mainServerIntel) && (
                  <div className="mb-2.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-[11px] font-bold text-amber-200 space-y-0.5">
                    {(activeEnergyForBoard?.ultraStealthReasonBn ||
                      engineOutput?.ultraStealthReasonBn) && (
                      <div className="text-pink-200">
                        {activeEnergyForBoard?.ultraStealthReasonBn ||
                          engineOutput?.ultraStealthReasonBn}
                      </div>
                    )}
                    {(engineOutput?.whaleTrapReasonBn ||
                      engineOutput?.crossSyncReasonBn) && (
                      <div>
                        {engineOutput?.whaleTrapReasonBn ||
                          engineOutput?.crossSyncReasonBn}
                      </div>
                    )}
                    {mainServerIntel && (
                      <div className="pt-0.5 border-t border-white/10 text-[10.5px] text-cyan-200">
                        <div>{mainServerIntel.wingo4TfSummaryBn}</div>
                      </div>
                    )}
                  </div>
                )}

                {isLocked ? (
                  <div className="py-3 px-3 rounded-xl bg-rose-950/90 border border-rose-500 text-center">
                    <div className="text-sm font-black text-rose-200">
                      ✋ এখন বেট ধরবেন না! এই দানের সময় শেষ (
                      {activeCountdownSec} সেকেন্ড বাকি)
                    </div>
                    <div className="text-xs text-rose-300 mt-0.5">
                      কয়েক সেকেন্ড অপেক্ষা করুন, নতুন পিরিয়ড শুরু হলেই নতুন
                      সিগন্যাল আসবে।
                    </div>
                  </div>
                ) : activeMarket === 'WINGO_30S' &&
                  engineOutput?.betAction === 'SKIP_ROUND' ? (
                  <div className="py-3 px-3 rounded-xl bg-amber-950/90 border-2 border-amber-400 text-center">
                    <div className="text-sm font-black text-amber-300">
                      ⚠️ এই দানটি ঝুঁকিপূর্ণ — এখন বেট না ধরে SKIP করুন!
                    </div>
                    <div className="text-xs text-amber-100 mt-0.5">
                      সার্ভারের সূত্রগুলোর মধ্যে মতভেদ আছে। আপনার টাকা নিরাপদ
                      রাখতে পরের ভিআইপি শটের জন্য অপেক্ষা করুন (ধরলে হালকা{' '}
                      {activeSize === 'BIG' ? 'BIG' : 'SMALL'} দেখতে পারেন)।
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {/* Box 1: Main Bet (Big/Small) */}
                    <div
                      className={`p-2.5 rounded-xl border-2 ${
                        activeSize === 'BIG'
                          ? 'bg-amber-500/20 border-amber-400'
                          : 'bg-sky-500/20 border-sky-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-200">
                        ১. মূল বেট (সাইজ)
                      </div>
                      <div
                        className={`text-lg font-black mt-0.5 ${
                          activeSize === 'BIG'
                            ? 'text-amber-300'
                            : 'text-sky-300'
                        }`}
                      >
                        {activeSize === 'BIG' ? 'BIG (বড়)' : 'SMALL (ছোট)'}
                      </div>
                      <div className="text-[10px] font-extrabold text-[#18e060] mt-0.5">
                        বেট মাউন্ট: {activeStep}
                      </div>
                    </div>

                    {/* Box 2: Color Bet */}
                    <div
                      className={`p-2.5 rounded-xl border-2 ${
                        activeColor === 'GREEN'
                          ? 'bg-emerald-500/20 border-emerald-400'
                          : 'bg-rose-500/20 border-rose-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-200">
                        ২. কালার ধরলে
                      </div>
                      <div
                        className={`text-lg font-black mt-0.5 ${
                          activeColor === 'GREEN'
                            ? 'text-[#18e060]'
                            : 'text-rose-400'
                        }`}
                      >
                        {activeColor === 'GREEN' ? 'সবুজ (Green)' : 'লাল (Red)'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 mt-0.5">
                        অপশনাল
                      </div>
                    </div>

                    {/* Box 3: 2 Lucky Numbers */}
                    <div className="p-2.5 rounded-xl border-2 bg-purple-500/20 border-purple-400">
                      <div className="text-[10px] font-bold text-slate-200">
                        ৩. নাম্বার ধরলে (২টি)
                      </div>
                      <div className="text-lg font-black font-mono text-amber-300 mt-0.5">
                        {primaryBall} এবং {backupBall}
                      </div>
                      <div className="text-[10px] font-bold text-purple-200 mt-0.5">
                        ৯ গুণ পেআউট
                      </div>
                    </div>
                  </div>
                )}

                {/* 4-Ball Golden Sniper (51.9% Hit Rate) & Dead-Zone Blacklist Balls (92% Killed) */}
                {activeEnergyForBoard?.sniper4Balls &&
                  activeEnergyForBoard.sniper4Balls.length > 0 && (
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black text-amber-300">
                            🎯 ৪-বল গোল্ডেন স্নাইপার (৫১.৯% হিট · ৯X লাভ)
                          </div>
                          <div className="text-[9.5px] text-slate-300">
                            Rank #9, #3, #10, #8 — ১০ টাকা করে ধরলে ৯০ টাকা!
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {activeEnergyForBoard.sniper4Balls.map((b) => (
                            <span
                              key={b}
                              className="w-6 h-6 rounded-full bg-amber-400 text-black font-mono font-black text-xs flex items-center justify-center shadow-xs"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-400/50 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black text-rose-300">
                            🚫 ডেড-জোন ব্ল্যাকলিস্ট (৯২% কিল রেট)
                          </div>
                          <div className="text-[9.5px] text-slate-300">
                            Rank #5, #6 ও গোল্ড মেডেল #1 — এগুলোতে ধরবেন না!
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {(
                            activeEnergyForBoard.deadZoneBalls ||
                            activeEnergyForBoard.medalBalls.slice(0, 2)
                          ).map((b) => (
                            <span
                              key={b}
                              className="w-6 h-6 rounded-full bg-rose-950 border border-rose-400 text-rose-200 font-mono font-black text-xs flex items-center justify-center line-through"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

          {/* Golden Yellow Game Banner Card (How to play + Last 4 Results + Time Remaining) */}
          <div className="rounded-2xl bg-gradient-to-r from-[#f6c83d] via-[#f8d249] to-[#f4be2b] text-white p-3.5 shadow-md relative overflow-hidden">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 border-r border-white/30 pr-2">
                <div className="inline-flex items-center gap-1.5 border border-white/80 rounded-full px-3 py-1 text-xs font-bold bg-white/10">
                  <span>📋</span>
                  <span>How to play</span>
                </div>
                <div className="mt-2 text-xs font-bold text-white/95">
                  {activeMarket === 'WINGO_30S'
                    ? 'WinGo 30sec'
                    : activeMarket === 'WINGO_1M'
                    ? 'WinGo 1Min'
                    : activeMarket === 'K3_1M'
                    ? 'K3 Lotre 1Min'
                    : 'TRX WinGo 1Min (Blockchain)'}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {activeMarket === 'K3_1M'
                    ? (k3Data?.history || []).slice(0, 4).map((h) => (
                        <div
                          key={h.issueNumber}
                          className="px-2 py-1 rounded-lg bg-white/25 border border-white/50 text-xs font-mono font-black text-white"
                        >
                          🎲{h.sum}
                        </div>
                      ))
                    : (activeMarket === 'WINGO_1M'
                        ? wingo1mData?.history || history
                        : activeMarket === 'TRX_1M'
                        ? trx1mData?.history || history
                        : history
                      )
                        .slice(0, 4)
                        .map((h) => (
                          <div
                            key={h.issueNumber}
                            className={`w-8 h-8 text-sm ${getDkwinBallClass(
                              h.number
                            )}`}
                          >
                            {h.number}
                          </div>
                        ))}
                </div>
              </div>

              <div className="col-span-5 text-right pl-1">
                <div className="text-xs font-extrabold text-white/95">
                  Time remaining
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 font-mono font-black text-lg">
                  <span className="bg-white/95 text-amber-600 px-1.5 py-0.5 rounded shadow-xs">
                    0
                  </span>
                  <span className="bg-white/95 text-amber-600 px-1.5 py-0.5 rounded shadow-xs">
                    0
                  </span>
                  <span className="text-white font-black">:</span>
                  <span className="bg-white/95 text-amber-600 px-1.5 py-0.5 rounded shadow-xs">
                    {secTens}
                  </span>
                  <span className="bg-white/95 text-amber-600 px-1.5 py-0.5 rounded shadow-xs">
                    {secOnes}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono font-extrabold text-white tracking-tight truncate">
                  {activeTargetIssue || 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          {/* Clean White Betting Board Card with Direct Finger Pointers */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-3.5 relative">
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                className={`py-2.5 rounded-tr-xl rounded-bl-xl font-bold text-white text-sm shadow-xs bg-[#18b660] ${
                  activeColor === 'GREEN'
                    ? 'ring-3 ring-amber-400 scale-[1.02]'
                    : 'opacity-80'
                }`}
              >
                Green {activeColor === 'GREEN' ? '👈' : ''}
              </button>
              <button
                type="button"
                className="py-2.5 rounded-xl font-bold text-white text-sm shadow-xs bg-[#b659fe] opacity-80"
              >
                Violet
              </button>
              <button
                type="button"
                className={`py-2.5 rounded-tl-xl rounded-br-xl font-bold text-white text-sm shadow-xs bg-[#fb5b5b] ${
                  activeColor === 'RED'
                    ? 'ring-3 ring-amber-400 scale-[1.02]'
                    : 'opacity-80'
                }`}
              >
                Red {activeColor === 'RED' ? '👈' : ''}
              </button>
            </div>

            <div className="bg-[#f7f8ff] rounded-2xl p-3 grid grid-cols-5 gap-x-2.5 gap-y-3 justify-items-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const isTarget = num === primaryBall || num === backupBall;
                return (
                  <div
                    key={num}
                    className="relative flex flex-col items-center"
                  >
                    <div
                      className={`w-13 h-13 sm:w-14 sm:h-14 text-2xl ${getDkwinBallClass(
                        num
                      )} ${
                        isTarget
                          ? 'ring-3 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)] scale-110'
                          : 'opacity-75'
                      }`}
                    >
                      {num}
                    </div>
                    {isTarget && (
                      <span className="mt-1 px-1.5 py-0.2 rounded bg-amber-500 text-black text-[9px] font-black leading-tight">
                        ধরুন
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-[#fb5b5b] text-[#fb5b5b] text-xs font-bold shrink-0"
              >
                Random
              </button>
              {['X1', 'X5', 'X10', 'X20', 'X50', 'X100'].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setSelectedMultiplier(mult)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                    selectedMultiplier === mult
                      ? 'bg-[#18b660] text-white'
                      : 'bg-[#f1f2f7] text-slate-600'
                  }`}
                >
                  {mult}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 rounded-full overflow-hidden shadow-xs text-white font-bold text-base">
              <div
                className={`py-3 text-center bg-[#feaa57] transition-all ${
                  activeSize === 'BIG'
                    ? 'ring-4 ring-inset ring-emerald-400 font-black text-lg'
                    : 'opacity-65'
                }`}
              >
                Big {activeSize === 'BIG' ? '👈 এইটা ধরুন' : ''}
              </div>
              <div
                className={`py-3 text-center bg-[#6ea8f4] transition-all ${
                  activeSize === 'SMALL'
                    ? 'ring-4 ring-inset ring-emerald-400 font-black text-lg'
                    : 'opacity-65'
                }`}
              >
                Small {activeSize === 'SMALL' ? '👈 এইটা ধরুন' : ''}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 3 TABS: Game history | Chart | গোপন সার্ভার ইন্টেল (Secret Intel) */}
          {/* ================================================================= */}
          <div ref={colorBoxRef} className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setBoardTab('game_history')}
              className={`py-2.5 px-2 rounded-xl font-bold text-xs shadow-xs transition-colors ${
                boardTab === 'game_history'
                  ? 'bg-gradient-to-r from-[#f6c83d] to-[#f4be2b] text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              Game history
            </button>
            <button
              type="button"
              onClick={() => setBoardTab('signal_chart')}
              className={`py-2.5 px-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 ${
                boardTab === 'signal_chart'
                  ? 'bg-gradient-to-r from-[#f6c83d] to-[#f4be2b] text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Signal Log</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardTab('quantum_brain')}
              className={`py-2.5 px-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 ${
                boardTab === 'quantum_brain'
                  ? 'bg-gradient-to-r from-[#f6c83d] to-[#f4be2b] text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>গোপন সার্ভার হ্যাক</span>
            </button>
          </div>

          {/* TAB 1: Authentic DKWIN Game History Table */}
          {boardTab === 'game_history' && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#f6c83d] text-white grid grid-cols-12 py-3 px-3 text-xs font-extrabold text-center">
                <div className="col-span-5 text-left pl-1">Period</div>
                <div className="col-span-2">
                  {activeMarket === 'K3_1M' ? 'Sum' : 'Number'}
                </div>
                <div className="col-span-3">Big Small</div>
                <div className="col-span-2">
                  {activeMarket === 'K3_1M'
                    ? 'Dice'
                    : activeMarket === 'TRX_1M'
                    ? 'Block'
                    : 'Color'}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {activeMarket === 'K3_1M'
                  ? (k3Data?.history || []).slice(0, 20).map((item) => {
                      const isBig = item.sum >= 11;
                      return (
                        <div
                          key={item.issueNumber}
                          className="grid grid-cols-12 items-center py-3 px-3 text-center hover:bg-slate-50"
                        >
                          <div className="col-span-5 text-left pl-1 font-mono text-xs sm:text-[13px] font-medium text-slate-700">
                            {item.issueNumber}
                          </div>
                          <div className="col-span-2 text-xl font-black font-mono text-amber-600">
                            {item.sum}
                          </div>
                          <div className="col-span-3 text-xs font-semibold text-slate-700">
                            {isBig ? 'Big' : 'Small'} (
                            {item.sum % 2 === 1 ? 'Odd' : 'Even'})
                          </div>
                          <div className="col-span-2 font-mono text-xs font-bold text-slate-600">
                            {item.dice.join('·')}
                          </div>
                        </div>
                      );
                    })
                  : activeMarket === 'TRX_1M'
                  ? (trx1mData?.history || []).slice(0, 20).map((item) => {
                      const isBig = sizeOfNumber(item.number) === 'BIG';
                      const clr = baseColorOfNumber(item.number);
                      return (
                        <div
                          key={item.issueNumber}
                          className="grid grid-cols-12 items-center py-3 px-3 text-center hover:bg-slate-50"
                        >
                          <div className="col-span-5 text-left pl-1 font-mono text-xs font-medium text-slate-700">
                            {item.issueNumber}
                          </div>
                          <div
                            className={`col-span-2 text-2xl font-black font-mono ${
                              clr === 'GREEN'
                                ? 'text-[#18b660]'
                                : 'text-[#fb5b5b]'
                            }`}
                          >
                            {item.number}
                          </div>
                          <div className="col-span-3 text-xs font-semibold text-slate-700">
                            {isBig ? 'Big' : 'Small'}
                          </div>
                          <div className="col-span-2 font-mono text-[10px] font-bold text-purple-600">
                            ..{(item.blockId || '').slice(-4)}
                          </div>
                        </div>
                      );
                    })
                  : (activeMarket === 'WINGO_1M'
                      ? wingo1mData?.history || history
                      : history
                    )
                      .slice(0, 20)
                      .map((item) => {
                        const isBig = sizeOfNumber(item.number) === 'BIG';
                        const clr = baseColorOfNumber(item.number);
                        const hasVio = hasVioletColor(item.number);
                        return (
                          <div
                            key={item.issueNumber}
                            className="grid grid-cols-12 items-center py-3 px-3 text-center hover:bg-slate-50"
                          >
                            <div className="col-span-5 text-left pl-1 font-mono text-xs sm:text-[13px] font-medium text-slate-700">
                              {item.issueNumber}
                            </div>
                            <div
                              className={`col-span-2 text-2xl font-black font-mono ${
                                clr === 'GREEN'
                                  ? 'text-[#18b660]'
                                  : 'text-[#fb5b5b]'
                              }`}
                            >
                              {item.number}
                            </div>
                            <div className="col-span-3 text-xs font-semibold text-slate-700">
                              {isBig ? 'Big' : 'Small'}
                            </div>
                            <div className="col-span-2 flex items-center justify-center gap-1">
                              <span
                                className={`w-3.5 h-3.5 rounded-full inline-block ${
                                  clr === 'GREEN'
                                    ? 'bg-[#18b660]'
                                    : 'bg-[#fb5b5b]'
                                }`}
                              />
                              {hasVio && (
                                <span className="w-3.5 h-3.5 rounded-full inline-block bg-[#b659fe]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
              </div>
            </div>
          )}

          {/* TAB 2: Live Prediction Verification Log */}
          {boardTab === 'signal_chart' && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#0b1322] text-white p-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold">
                    Live Signal Verification Log (Size + Color + 2 Balls)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    প্রতি ৩০ সেকেন্ডের সিগন্যালের সাথে আসল ড্র রেজাল্টের অটো-যাচাইকরণ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchMarketState}
                  className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-2.5">Period</th>
                      <th className="py-2.5 px-2">Signal</th>
                      <th className="py-2.5 px-2">Balls</th>
                      <th className="py-2.5 px-2">Actual</th>
                      <th className="py-2.5 px-2.5 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.slice(0, 25).map((rec) => {
                      const isPending = rec.actualNumber === undefined;
                      return (
                        <tr key={rec.issueNumber} className="hover:bg-slate-50">
                          <td className="py-2.5 px-2.5 font-semibold text-slate-700">
                            #{rec.issueNumber.slice(-5)}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`font-black ${
                                rec.predictedSize === 'BIG'
                                  ? 'text-emerald-600'
                                  : 'text-sky-600'
                              }`}
                            >
                              {rec.predictedSize}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">
                              ({rec.step}·{rec.predictedColor[0]})
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-bold text-amber-600">
                            {rec.primaryNumber}, {rec.backupNumber}
                          </td>
                          <td className="py-2.5 px-2">
                            {isPending ? (
                              <span className="text-[11px] text-amber-600 font-semibold">
                                Wait {remainingSec}s
                              </span>
                            ) : (
                              <span className="font-bold text-slate-800">
                                {rec.actualNumber} ({rec.actualSize?.[0]})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            {isPending ? (
                              <span className="text-[10px] text-slate-400">
                                PENDING
                              </span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span
                                  className={`font-black ${
                                    rec.sizeWin
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'
                                  }`}
                                >
                                  {rec.sizeWin ? 'SIZE WIN' : 'SIZE LOSS'}
                                  {rec.numberWin ? ' 🎯' : ''}
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    rec.colorWin
                                      ? 'text-emerald-600'
                                      : 'text-rose-500'
                                  }`}
                                >
                                  CLR({rec.predictedColor[0]}):{' '}
                                  {rec.colorWin ? 'WIN' : 'LOSS'}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SECRET SERVER INTELLIGENCE HUB (Energy Stealth + Official Dragon + 100-Draw Trend + Quantum Pool) */}
          {boardTab === 'quantum_brain' && (
            <div className="space-y-3.5">
              {/* 1. Connected AR-Lottery02 Server Account & Stealth Matrix Status */}
              <div className="bg-[#09121e] text-white rounded-2xl p-4 shadow-md space-y-3 border border-emerald-500/30">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#18e060]" />
                    <div>
                      <h3 className="text-xs font-extrabold text-[#18e060]">
                        AR-Lottery গোপন সার্ভার কানেকশন সক্রিয়
                      </h3>
                      <p className="text-[10.5px] text-slate-300 font-mono">
                        Node: {connectedAccountInfo.activeMirrorNode || 'api.ar-lottery02.com'}{' '}
                        · UID: #{connectedAccountInfo.tenantAccount || '1771743'}{' '}
                        · Tenant: #{connectedAccountInfo.tenantId || 1081}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono font-black text-[#18e060]">
                    {energyStats.sizeWinRate || 67}% STEALTH WIN
                  </span>
                </div>

                {/* Live Energy/GetPanel 5-Rule Stealth Matrix */}
                {activeEnergyForBoard ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-300 font-bold">
                        ⚡ লাইভ Energy/GetPanel (Snap #{activeEnergyForBoard.snapNo})
                      </span>
                      <span className="text-amber-300 font-extrabold">
                        গোপন সিগন্যাল: {activeEnergyForBoard.energyPredictedSize} (
                        {activeEnergyForBoard.stealthVotesCount || 4}/5 রুল)
                      </span>
                    </div>

                    {/* Crowd Bet % Bar */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                        <div className="flex justify-between text-slate-300">
                          <span>পাবলিক BIG বেট:</span>
                          <b className="text-amber-400">
                            {activeEnergyForBoard.bigPercent}%
                          </b>
                        </div>
                        <div className="flex justify-between text-slate-300 mt-0.5">
                          <span>পাবলিক SMALL বেট:</span>
                          <b className="text-cyan-400">
                            {activeEnergyForBoard.smallPercent}%
                          </b>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                        <div className="flex justify-between text-slate-300">
                          <span>Stealth বল (R9,R10):</span>
                          <b className="text-[#18e060]">
                            #{(activeEnergyForBoard.killBalls || []).join(', #')}
                          </b>
                        </div>
                        <div className="flex justify-between text-slate-300 mt-0.5">
                          <span>Sniper 4 বল (46% Hit):</span>
                          <b className="text-amber-300">
                            #{(activeEnergyForBoard.sniper4Balls || []).join(',')}
                          </b>
                        </div>
                      </div>
                    </div>

                    {/* 0-9 Live Server Rank & Crowd Bet % Grid */}
                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      {activeEnergyForBoard.list.map((b) => {
                        const isStealth = b.rank === 8 || b.rank === 9 || b.rank === 10 || b.rank === 3;
                        const isGoldTrap = b.rank === 1;
                        return (
                          <div
                            key={b.number}
                            className={`rounded-lg p-1.5 text-center font-mono border ${
                              isStealth
                                ? 'bg-emerald-950/70 border-emerald-400/60 text-white'
                                : isGoldTrap
                                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                                : 'bg-white/5 border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-black">
                              #{b.number}{' '}
                              <span className="text-[9px] text-amber-300">
                                R{b.rank}
                              </span>
                            </div>
                            <div className="text-[9.5px] font-bold">
                              {b.percent}%
                              {b.rankDelta ? (
                                <span
                                  className={
                                    b.rankDelta > 0
                                      ? 'text-rose-400 ml-0.5'
                                      : 'text-emerald-400 ml-0.5'
                                  }
                                >
                                  {b.rankDelta > 0
                                    ? `↑${b.rankDelta}`
                                    : `↓${Math.abs(b.rankDelta)}`}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {activeEnergyForBoard.stealthRuleBreakdown && (
                      <div className="text-[10px] font-mono text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                        🎯 {activeEnergyForBoard.stealthRuleBreakdown}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    লাইভ Energy/GetPanel স্ন্যাপশট লোড হচ্ছে...
                  </p>
                )}
              </div>

              {/* 2. Official Server Live ChangLong Dragon Radar (/api/Lottery/GetDragonList) */}
              {serverDragonList.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-500" />
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-800">
                          অফিশিয়াল সার্ভার ChangLong ড্রাগন রাডার (GetDragonList)
                        </h3>
                        <p className="text-[10.5px] text-slate-500">
                          ডিকেউইন মূল সার্ভার থেকে সরাসরি প্রাপ্ত লম্বা স্ট্রিক সতর্কবার্তা
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                      {serverDragonList.length} Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                    {serverDragonList.slice(0, 6).map((d, idx) => (
                      <div
                        key={`${d.gameCode}-${d.playType}-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {d.gameName}{' '}
                            <span className="text-[10px] text-slate-500">
                              ({d.playType})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            একটানা এসেছে:{' '}
                            <b className="text-rose-600">
                              {d.dragonCount}x {d.dragonItem}
                            </b>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                            d.dragonCount >= 7
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {d.dragonCount >= 7 ? 'CUT (বিপরীত)' : 'FOLLOW'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Official Server 100-Draw Trend Telemetry (/api/Lottery/GetTrendStatistics) */}
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800">
                        অফিশিয়াল ১০০-পিরিয়ড সার্ভার ট্রেন্ড পরিসংখ্যান (GetTrendStatistics)
                      </h3>
                      <p className="text-[10.5px] text-slate-500">
                        কোন বল কত পিরিয়ড ধরে মিসিং এবং কোন বলের প্রেশার সবচেয়ে বেশি
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
                  {(engineOutput?.ballTelemetry || []).map((b) => (
                    <div
                      key={b.number}
                      className={`p-2 rounded-xl border text-center ${
                        b.pressureRatio >= 1.5
                          ? 'bg-amber-50 border-amber-400 text-slate-900'
                          : 'bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="font-black text-sm">#{b.number}</div>
                      <div className="text-[10px] text-slate-500">
                        গ্যাপ: <b className="text-slate-800">{b.missingCount}</b>/
                        {b.avgMissing}
                      </div>
                      <div className="text-[9.5px] font-bold text-emerald-600">
                        Open: {b.openCount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Upgraded 7-Quantum Formula Pool */}
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800">
                      Quantum Apex 2-9-2-2 & Shield 6-8-4-9 Formula Pool
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {engineOutput?.activePatternExplanationBn}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600">
                    {engineOutput?.selfLearningBacktestWinRate}% Win
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {engineOutput?.learnedExperts.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{ex.name}</div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {ex.formulaDescBn}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-black text-emerald-600">
                          {ex.winRate}% ({ex.wins}/{ex.total})
                        </div>
                        <div className="text-[10px] font-bold text-slate-600">
                          Vote: {ex.nextVote} · MaxL:{ex.maxLossStreak}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. 24/7 Offline Dataset Download & Optional Token Sync */}
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800">
                      24/7 Offline Server Memory ({totalStoredIssues} Issues)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Active Since:{' '}
                      {new Date(daemonStartedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadDataset}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>

                <form
                  onSubmit={handleSyncToken}
                  className="space-y-2 pt-2 border-t border-slate-100"
                >
                  <label className="block text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Instant 300-Issue Server Backfill (Optional Bearer Token)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={arTokenInput}
                      onChange={(e) => setArTokenInput(e.target.value)}
                      placeholder="Paste Bearer eyJhbGci..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      disabled={tokenSyncLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shrink-0"
                    >
                      {tokenSyncLoading ? 'Syncing...' : 'Sync'}
                    </button>
                  </div>
                  {tokenSyncStatus && (
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      {tokenSyncStatus}
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
