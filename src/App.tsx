import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  RotateCcw,
  KeyRound,
  Download,
  ExternalLink,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  baseColorOfNumber,
  EnginePrediction,
  hasVioletColor,
  HistoryEntry,
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
  killBalls?: number[];
  sniper4Balls?: number[];
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
  wingo1mData?: WinGo1MData | null;
  k3Data?: K3MarketData | null;
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
  const [remainingSec, setRemainingSec] = useState<number>(30);
  const [remainingSec1M, setRemainingSec1M] = useState<number>(60);
  const [activeMarket, setActiveMarket] = useState<
    'WINGO_30S' | 'WINGO_1M' | 'K3_1M'
  >('WINGO_30S');
  const [wingo1mData, setWingo1mData] = useState<WinGo1MData | null>(null);
  const [k3Data, setK3Data] = useState<K3MarketData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [bellRinging, setBellRinging] = useState<boolean>(false);

  // Background Mode: 'dkwin_iframe' (live dkwin site by default!) | 'dkwin_board' (built-in board)
  const [bgMode, setBgMode] = useState<'dkwin_board' | 'dkwin_iframe'>('dkwin_iframe');
  const [dkwinUrl, setDkwinUrl] = useState<string>('https://dkwin9.com');
  const [urlInput, setUrlInput] = useState<string>('https://dkwin9.com');
  // Bottom Tab in DKWIN Board: 'game_history' | 'signal_chart' | 'quantum_brain'
  const [boardTab, setBoardTab] = useState<
    'game_history' | 'signal_chart' | 'quantum_brain'
  >('game_history');
  const [selectedMultiplier, setSelectedMultiplier] = useState<string>('X1');

  // Floating HUD state (draggable & minimizable just like screenshot)
  const [hudMinimized, setHudMinimized] = useState<boolean>(false);
  const [hudPos, setHudPos] = useState<{ x: number; y: number }>(() => {
    const defaultX =
      typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 272) : 16;
    return { x: defaultX, y: 48 };
  });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
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

  // Animated Neon Green ECG Heartbeat Monitor inside the HUD (matches screenshot)
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
          // Subtle dark green grid lines
          ctx.strokeStyle = 'rgba(24, 224, 96, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          // Glowing green ECG waveform
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
      stats.currentLossStreak
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
  }, [history, targetIssue, stats.currentLossStreak, records, serverEngineOutput]);

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
        if (data.wingo1mData) {
          setWingo1mData(data.wingo1mData);
        }
        if (data.k3Data) {
          setK3Data(data.k3Data);
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
      const clampedSec1M = Math.max(1, Math.min(60, Math.ceil(remainMs1M / 1000)));
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

  // HUD Pointer Drag Handlers
  const handleHudPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') && !hudMinimized) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: hudPos.x,
      origY: hudPos.y,
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
    const maxW = window.innerWidth - (hudMinimized ? 62 : 254);
    const maxH = window.innerHeight - (hudMinimized ? 62 : 220);
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

  // Helper for HUD 3D ball class
  const getHudBallClass = (num: number) => {
    if (num === 0) return 'purple mix';
    if (num === 5) return 'green mix';
    return [1, 3, 7, 9].includes(num) ? 'green' : 'red';
  };

  // Helper for DKWIN 3D casino ball class
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
      : engineOutput?.primaryNumber ?? 7;
  const backupBall =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.backupNumber ?? 9
      : activeMarket === 'K3_1M'
      ? k3Data?.targetSums?.[1] ?? 13
      : engineOutput?.backupNumber ?? 9;
  const activeSize: SizeType =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.predictedSize ?? 'BIG'
      : activeMarket === 'K3_1M'
      ? k3Data?.predictedSize ?? 'BIG'
      : engineOutput?.predictedSize ?? 'BIG';
  const activeColor: 'GREEN' | 'RED' =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.predictedColor ?? 'GREEN'
      : activeMarket === 'K3_1M'
      ? k3Data?.predictedParity === 'ODD'
        ? 'GREEN'
        : 'RED'
      : engineOutput?.predictedColor ?? 'GREEN';
  const activeTargetIssue =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.targetIssue || ''
      : activeMarket === 'K3_1M'
      ? k3Data?.targetIssue || ''
      : engineOutput?.targetIssue || targetIssue || '';
  const activeStep =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.recommendedStep || '1X'
      : activeMarket === 'K3_1M'
      ? k3Data?.recommendedStep || '1X'
      : engineOutput?.recommendedStep || '1X';
  const activeConfidence =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.confidence ?? 98
      : activeMarket === 'K3_1M'
      ? k3Data?.confidence ?? 97
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
      : stats.wins;
  const activeLosses =
    activeMarket === 'WINGO_1M'
      ? wingo1mData?.losses ?? 0
      : activeMarket === 'K3_1M'
      ? k3Data?.losses ?? 0
      : stats.losses;

  const shortPatternTag = useMemo(() => {
    if (activeMarket === 'WINGO_1M') return '1M ENERGY 63%';
    if (activeMarket === 'K3_1M') return 'K3 DICE 65.1%';
    if (!engineOutput) return 'AI TREND';
    if (engineOutput.signalGrade === 'REBOUND_SNIPER') return 'REBOUND (3X)';
    const streak = engineOutput.dragons.find((d) => d.category === 'SIZE');
    if (streak && streak.streakLength >= 2) {
      return `${streak.value} (${streak.streakLength}x)`;
    }
    return `QUANTUM (${engineOutput.formulaConsensusCount}/5)`;
  }, [engineOutput, activeMarket]);

  return (
    <div className="min-h-screen bg-[#f7f8ff] text-slate-800 relative select-none">
      {/* ===================================================================== */}
      {/* FLOATING DRAGGABLE NEON HUD SIMULATOR WIDGET (EXACT SCREENSHOT MATCH) */}
      {/* ===================================================================== */}
      <div
        className="hud-widget"
        style={{ left: `${hudPos.x}px`, top: `${hudPos.y}px` }}
        onPointerDown={handleHudPointerDown}
        onPointerMove={handleHudPointerMove}
        onPointerUp={handleHudPointerUp}
        onPointerCancel={handleHudPointerUp}
      >
        <div className={`hud-phone ${hudMinimized ? 'minimized' : ''}`}>
          {hudMinimized ? (
            <div
              title="Tap to open Quantum AI Simulator"
              className="w-full h-full rounded-full bg-[#050505] border-2 border-[#18e060] flex flex-col items-center justify-center shadow-[0_0_20px_rgba(24,224,96,0.8)]"
            >
              <span className="text-base leading-none">👑</span>
              <span className="text-[9px] font-black text-[#17f0e0] font-mono mt-0.5">
                {activeSize === 'BIG' ? 'BIG' : 'SML'}·{activeCountdownSec}s
              </span>
            </div>
          ) : (
            <div className="hud-screen">
              {/* Compact Phone Status Bar */}
              <div className="flex items-center justify-between text-[8.5px] font-bold px-1 pb-0.5 text-white/85">
                <span>{clockText}</span>
                <span className="flex items-center gap-1">
                  <span>●●●●</span>
                  <span>📶</span>
                  <span className="text-amber-400">🔋</span>
                </span>
              </div>

              {/* Top Header Bar: Menu | Crown + Brand | Bell */}
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBgMode('dkwin_board');
                    setBoardTab('signal_chart');
                    colorBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  title="চার্ট ও রিপোর্ট দেখুন"
                  className="hud-icon-btn"
                >
                  ☰
                </button>

                <div className="text-center leading-none">
                  <div className="text-[10px] text-amber-400">👑</div>
                  <div className="hud-brand-title">
                    𝐒𝐓𝐑™𝐐𝐔𝐀𝐍𝐓𝐔𝐌☞𝐎𝐖𝐍𝐄𝐑
                  </div>
                  <div className="hud-brand-sub">
                    {activeMarket === 'WINGO_30S'
                      ? 'SIMULATOR · 30S'
                      : activeMarket === 'WINGO_1M'
                      ? 'SIMULATOR · 1 MIN'
                      : 'SIMULATOR · K3 1M'}
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
                      soundEnabled ? 'bg-[#18e060]' : 'bg-[#ff2a2a]'
                    }`}
                  />
                </button>
              </div>

              {/* Built-in 3-Mode Selector Bar Inside the Prediction Tool Box (30S | 1 MIN | K3 1M) */}
              <div className="grid grid-cols-3 gap-1 mb-1.5 bg-[#0d0d0d] p-1 rounded-lg border border-[#222]">
                <button
                  type="button"
                  onClick={() => setActiveMarket('WINGO_30S')}
                  className={`py-1 rounded-md text-[9.5px] font-black font-mono transition-all ${
                    activeMarket === 'WINGO_30S'
                      ? 'bg-gradient-to-r from-[#18e060] to-[#05c987] text-black shadow-[0_0_8px_rgba(24,224,96,0.6)]'
                      : 'bg-[#161616] text-white/75 hover:text-white'
                  }`}
                >
                  30S ({remainingSec}s)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarket('WINGO_1M')}
                  className={`py-1 rounded-md text-[9.5px] font-black font-mono transition-all ${
                    activeMarket === 'WINGO_1M'
                      ? 'bg-gradient-to-r from-[#ffc83a] to-[#ff9900] text-black shadow-[0_0_8px_rgba(255,200,58,0.6)]'
                      : 'bg-[#161616] text-white/75 hover:text-white'
                  }`}
                >
                  1 MIN ({remainingSec1M}s)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarket('K3_1M')}
                  className={`py-1 rounded-md text-[9.5px] font-black font-mono transition-all ${
                    activeMarket === 'K3_1M'
                      ? 'bg-gradient-to-r from-[#17f0e0] to-[#00a8ff] text-black shadow-[0_0_8px_rgba(23,240,224,0.6)]'
                      : 'bg-[#161616] text-white/75 hover:text-white'
                  }`}
                >
                  🎲 K3 1M
                </button>
              </div>

              {/* Two Compact Columns: Left = Radar Ball + Period + Timer | Right = Step + ECG + BIG/SMALL */}
              <div className="grid grid-cols-12 gap-1.5 items-start">
                {/* Left Column (6 cols) */}
                <div className="col-span-6">
                  <div className="border border-[#1d1d1d] rounded-[10px] bg-[#070707] p-1">
                    {/* LIVE Header */}
                    <div className="flex items-center justify-between px-0.5 pb-0.5">
                      <span className="border border-[#18e060] rounded-[5px] px-1.5 py-0.2 text-[8px] font-extrabold text-[#18e060] bg-[#03170b]">
                        LIVE
                      </span>
                      <span className="flex items-center gap-1 text-[8px] font-extrabold text-[#18e060]">
                        <i className="w-1.5 h-1.5 rounded-full bg-[#18e060] shadow-[0_0_6px_#18e060] animate-pulse inline-block" />
                        {activeMarket === 'WINGO_30S'
                          ? '30S'
                          : activeMarket === 'WINGO_1M'
                          ? '1M'
                          : 'K3'}
                      </span>
                    </div>

                    {/* Compact Rotating Radar Scanner + 3D Target Ball */}
                    <div className="relative h-[82px] w-full bg-[#050505] rounded-md flex items-center justify-center overflow-hidden">
                      <div className="hud-scan-container" />
                      <div
                        className={`hud-number-ball ${getHudBallClass(
                          primaryBall % 10
                        )}`}
                      >
                        <span>{primaryBall}</span>
                      </div>
                      <div
                        title={`Backup Target: ${backupBall}`}
                        className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/85 border border-white/20 text-[8px] font-mono font-bold text-cyan-300 z-10"
                      >
                        #{backupBall}
                      </div>
                    </div>
                  </div>

                  {/* Glowing Period Bar (#1542) */}
                  <div className="hud-tf font-mono">
                    #{activeTargetIssue ? activeTargetIssue.slice(-4) : '----'}
                  </div>

                  {/* Countdown Number + Progress Bar */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className={`min-w-[20px] text-right text-[13px] font-black font-mono ${
                        isLocked
                          ? 'text-[#ff2a2a] drop-shadow-[0_0_6px_#ff2a2a]'
                          : 'text-[#17f0e0] drop-shadow-[0_0_6px_#17f0e0]'
                      }`}
                    >
                      {activeCountdownSec}
                    </div>
                    <div className="flex-1 h-1.5 bg-[#141414] rounded-full overflow-hidden border border-[#252525]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${cdPct}%`,
                          background: isLocked
                            ? 'linear-gradient(90deg, #ff7a2a, #ff2a2a)'
                            : 'linear-gradient(90deg, #18e060, #17f0e0)',
                          boxShadow: isLocked
                            ? '0 0 6px #ff2a2a'
                            : '0 0 6px #18e060',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column (6 cols) */}
                <div className="col-span-6">
                  {/* Compact STEP & Target Balls Row */}
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1 bg-[#0d0d0d] border border-[#17f0e0] rounded-[5px] text-[#17f0e0] py-0.5 px-1 text-center font-extrabold text-[7.5px] leading-tight truncate">
                      {shortPatternTag}
                    </div>
                    <div
                      title="Recommended Step"
                      className="px-1 py-0.5 bg-[#0d0d0d] border border-amber-500/50 rounded-[5px] text-amber-300 font-extrabold text-[8.5px] font-mono"
                    >
                      {activeStep}
                    </div>
                    <div
                      title="Target Balls"
                      className="px-1 py-0.5 bg-[#0d0d0d] border border-[#2c2c2c] rounded-[5px] text-white font-extrabold text-[8.5px] font-mono"
                    >
                      {primaryBall},{backupBall}
                    </div>
                  </div>

                  {/* Compact Animated Neon Green ECG Heartbeat Monitor */}
                  <div className="mt-1.5 h-[28px] border border-[#18e060] rounded-[7px] bg-[#020b05] flex items-center justify-center shadow-[0_0_8px_rgba(24,224,96,0.2)] overflow-hidden">
                    <canvas
                      ref={ecgCanvasRef}
                      width={130}
                      height={28}
                      className="w-full h-full block"
                    />
                  </div>

                  {/* Compact Neon BIG / SMALL Signal Display Box */}
                  <div className="mt-1.5">
                    <div
                      className={`hud-signal-wrapper ${
                        activeSize === 'BIG' ? 'big-wrap' : ''
                      }`}
                    >
                      <div
                        className={`hud-signal-display ${
                          activeSize === 'BIG' ? 'big' : ''
                        }`}
                      >
                        <span className="relative z-10 text-[8px] font-extrabold text-amber-300 tracking-normal leading-none mb-0.5">
                          👉 বেট ধরুন:
                        </span>
                        <span className="relative z-10 leading-none">
                          {activeSize === 'BIG' ? '𝐁𝐈𝐆' : '𝐒𝐌𝐀𝐋𝐋'}
                        </span>
                        <span
                          className={`relative z-10 mt-0.5 px-1.5 py-0.2 rounded-full text-[7.5px] font-extrabold tracking-normal border ${
                            activeColor === 'GREEN'
                              ? 'bg-emerald-950/90 text-[#18e060] border-[#18e060]/60'
                              : 'bg-rose-950/90 text-[#ff4d4d] border-[#ff4d4d]/60'
                          }`}
                        >
                          {activeMarket === 'K3_1M'
                            ? `${
                                k3Data?.predictedParity === 'ODD'
                                  ? 'বিজোড়'
                                  : 'জোড়'
                              } · যোগ:${primaryBall},${backupBall}`
                            : `${
                                activeColor === 'GREEN' ? 'সবুজ' : 'লাল'
                              } · বল:${primaryBall},${backupBall}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Bottom Row: 3-Col Neon Stats + Chart Button */}
              <div className="grid grid-cols-12 gap-1.5 mt-1.5 items-center">
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
                      WIN/LOSS
                    </small>
                    <b className="text-[10px] font-black text-[#17f0e0] font-mono">
                      {activeWins}W·{activeLosses}L
                    </b>
                  </div>

                  <div className="text-center px-0.5">
                    <small className="block text-[6.5px] font-bold text-[#ddd]">
                      WIN%
                    </small>
                    <b className="text-[10.5px] font-black text-[#18e060] font-mono">
                      {activeConfidence}%
                    </b>
                  </div>
                </div>

                <div className="col-span-4">
                  <button
                    type="button"
                    onClick={handleResetStats}
                    title="Win/Loss আবার 0W·0L থেকে নতুন করে শুরু করুন"
                    className="hud-tg-btn w-full"
                  >
                    <span>RESET ↺</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TOP STICKY DKWIN GOLDEN HEADER BAR + LIVE SITE URL BAR                */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#f6c73b] via-[#f8d24a] to-[#f5c230] text-white shadow-sm">
        <div className="max-w-[640px] mx-auto px-2.5 py-1.5 flex items-center justify-between gap-2">
          {/* Editable DKWIN Live URL Form so user can open any DKWIN domain inside the frame */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let clean = urlInput.trim();
              if (!clean) clean = 'https://dkwin9.com';
              if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
              setDkwinUrl(clean);
              setUrlInput(clean);
              setBgMode('dkwin_iframe');
            }}
            className="flex-1 flex items-center gap-1 bg-black/20 rounded-lg px-2 py-1"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://dkwin9.com"
              className="w-full bg-transparent text-white placeholder-white/70 text-xs font-mono font-bold focus:outline-none"
            />
            <button
              type="submit"
              className="px-2 py-0.5 rounded bg-white text-amber-600 text-[10px] font-black shrink-0"
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
              className="px-2 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-white text-[11px] font-bold"
            >
              {bgMode === 'dkwin_iframe' ? 'চার্ট বোর্ড' : 'DKWIN সাইট'}
            </button>
            <button
              type="button"
              onClick={() => setHudMinimized((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-black/25 hover:bg-black/35 text-white text-[11px] font-bold"
            >
              {hudMinimized ? 'Show Box' : 'Hide Box'}
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-1.5 rounded-full bg-black/15 hover:bg-black/25 text-white"
              title="Sound Toggle"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MODE A: FULL-SCREEN EMBEDDED DKWIN SITE IFRAME (DEFAULT)              */}
      {/* ===================================================================== */}
      {bgMode === 'dkwin_iframe' ? (
        <div className="fixed inset-0 top-[42px] z-10 bg-black">
          <iframe
            key={dkwinUrl}
            src={dkwinUrl}
            title="DKWIN Official Website"
            className="w-full h-full border-0 bg-white"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      ) : (
        /* =================================================================== */
        /* MODE B: CLEAN AUTHENTIC DKWIN BACKGROUND (EXACT SCREENSHOT MATCH)  */
        /* =================================================================== */
        <main className="max-w-[540px] mx-auto pb-20 px-3 pt-3 space-y-3.5">
          {/* Authentic DKWIN 4-Card Timer Mode Strip (WinGo 30sec | WinGo 1Min | K3 1Min | WinGo 5Min) */}
          <div className="bg-white rounded-2xl p-1.5 shadow-sm grid grid-cols-4 gap-1 text-center">
            <button
              type="button"
              onClick={() => setActiveMarket('WINGO_30S')}
              className={`rounded-xl py-2 px-1 flex flex-col items-center transition-all ${
                activeMarket === 'WINGO_30S'
                  ? 'bg-gradient-to-b from-[#f8d34c] to-[#f3bd2c] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-sm mb-0.5">
                ⏱️
              </div>
              <div className="text-[10.5px] font-bold leading-tight">WinGo</div>
              <div className="text-[10.5px] font-extrabold leading-tight">
                30sec
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveMarket('WINGO_1M')}
              className={`rounded-xl py-2 px-1 flex flex-col items-center transition-all ${
                activeMarket === 'WINGO_1M'
                  ? 'bg-gradient-to-b from-[#f8d34c] to-[#f3bd2c] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-sm mb-0.5">
                ⏱️
              </div>
              <div className="text-[10.5px] font-bold leading-tight">WinGo</div>
              <div className="text-[10.5px] font-extrabold leading-tight">
                1Min
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveMarket('K3_1M')}
              className={`rounded-xl py-2 px-1 flex flex-col items-center transition-all ${
                activeMarket === 'K3_1M'
                  ? 'bg-gradient-to-b from-[#f8d34c] to-[#f3bd2c] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-sm mb-0.5">
                🎲
              </div>
              <div className="text-[10.5px] font-bold leading-tight">K3 Lotre</div>
              <div className="text-[10.5px] font-extrabold leading-tight">
                1Min
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveMarket('WINGO_1M')}
              className="rounded-xl py-2 px-1 flex flex-col items-center text-slate-400 hover:text-slate-600 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm mb-0.5">
                ⏱️
              </div>
              <div className="text-[10.5px] font-bold leading-tight">WinGo</div>
              <div className="text-[10.5px] font-extrabold leading-tight">
                3Min
              </div>
            </button>
          </div>

          {/* Golden Yellow Game Banner Card (How to play + Last 4 Results + Time Remaining) */}
          <div className="rounded-2xl bg-gradient-to-r from-[#f6c83d] via-[#f8d249] to-[#f4be2b] text-white p-3.5 shadow-md relative overflow-hidden">
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Left Side: How to play + Game Title + Last 4 Results */}
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
                    : 'K3 Lotre 1Min'}
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

              {/* Right Side: Time Remaining + Digital Clock + Period Number */}
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

          {/* Clean White Betting Board Card (Green/Violet/Red + 0-9 Casino Balls + X1..X100 + Big/Small) */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm space-y-3.5 relative">
            {/* Three Color Buttons: Green | Violet | Red */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                className="py-2.5 rounded-tr-xl rounded-bl-xl font-bold text-white text-sm shadow-xs bg-[#18b660]"
              >
                Green
              </button>
              <button
                type="button"
                className="py-2.5 rounded-xl font-bold text-white text-sm shadow-xs bg-[#b659fe]"
              >
                Violet
              </button>
              <button
                type="button"
                className="py-2.5 rounded-tl-xl rounded-br-xl font-bold text-white text-sm shadow-xs bg-[#fb5b5b]"
              >
                Red
              </button>
            </div>

            {/* 0–9 3D Casino Number Balls (2 rows x 5 cols — Exact Clean Screenshot Layout) */}
            <div className="bg-[#f7f8ff] rounded-2xl p-3 grid grid-cols-5 gap-x-2.5 gap-y-3 justify-items-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <div key={num} className="relative flex flex-col items-center">
                  <div
                    className={`w-13 h-13 sm:w-14 sm:h-14 text-2xl ${getDkwinBallClass(
                      num
                    )}`}
                  >
                    {num}
                  </div>
                </div>
              ))}
            </div>

            {/* Random & X1, X5, X10, X20, X50, X100 Multiplier Row */}
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

            {/* Big / Small Split Pill Bar (Orange Big | Blue Small — Clean Screenshot Style) */}
            <div className="grid grid-cols-2 rounded-full overflow-hidden shadow-xs text-white font-bold text-base">
              <div className="py-2.5 text-center bg-[#feaa57]">Big</div>
              <div className="py-2.5 text-center bg-[#6ea8f4]">Small</div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 3 TABS MATCHING SCREENSHOT: Game history | Chart | My history     */}
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
              <span>Chart</span>
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
              <span>My history</span>
            </button>
          </div>

          {/* TAB 1: Authentic DKWIN Game History Table (Exact Match to Screenshot) */}
          {boardTab === 'game_history' && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#f6c83d] text-white grid grid-cols-12 py-3 px-3 text-xs font-extrabold text-center">
                <div className="col-span-5 text-left pl-1">Period</div>
                <div className="col-span-2">
                  {activeMarket === 'K3_1M' ? 'Sum' : 'Number'}
                </div>
                <div className="col-span-3">Big Small</div>
                <div className="col-span-2">
                  {activeMarket === 'K3_1M' ? 'Dice' : 'Color'}
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

          {/* TAB 3: Quantum Brain 5-Formula Pool + 24/7 Offline Storage + Token Sync */}
          {boardTab === 'quantum_brain' && (
            <div className="space-y-3.5">
              {/* 5-Expert Formula Pool */}
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800">
                      5-Super-Quantum Formula Consensus
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

              {/* 24/7 Offline Dataset Download & Optional Token Sync */}
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

                <form onSubmit={handleSyncToken} className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Instant 100-Issue Server Backfill (Optional Bearer Token)</span>
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
      )}
    </div>
  );
}

export default App;
