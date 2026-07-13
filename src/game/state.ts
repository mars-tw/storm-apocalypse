export const SAVE_VERSION = 2;
const SAVE_KEY = "storm-apocalypse-save-v1";

export type WeaponId = "machete" | "axe" | "smg";
export type EmployeeId = "hunter" | "cashier" | "dog";
export type TowerId = "ballista" | "frost" | "cannon";

export interface LoopQuestState {
  id: string;
  wave: number;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

export interface LifetimeStats {
  pastureVisited: boolean;
  cowsKilled: number;
  meatCollected: number;
  meatDeposited: number;
  sales: number;
  totalEarned: number;
  zombiesKilled: number;
  playerKills: number;
  towerKills: number;
  damageDealt: number;
  damageTaken: number;
  wavesCleared: number;
  campaignWins: number;
}

export interface QuestSaveState {
  chapter: number;
  completed: number[];
  unlocks: string[];
  loop: LoopQuestState | null;
}

export interface SaveState {
  version: number;
  money: number;
  wave: number;
  stallLevel: number;
  towerBuilt: boolean;
  bestWave: number;
  weapon: WeaponId;
  employees: Record<EmployeeId, boolean>;
  pasture2Unlocked: boolean;
  towers: Record<TowerId, number>;
  quest: QuestSaveState;
  stats: LifetimeStats;
  lastSavedAt: number;
}

export interface RuntimeState extends SaveState {
  carriedMeat: number;
  displayedMeat: number;
  baseHealth: number;
  waveActive: boolean;
  enemiesRemaining: number;
  selectedTower: TowerId;
  currentFps: number;
  drawCalls: number;
  quality: "低" | "中" | "高";
}

const DEFAULT_STATS: LifetimeStats = {
  pastureVisited: false,
  cowsKilled: 0,
  meatCollected: 0,
  meatDeposited: 0,
  sales: 0,
  totalEarned: 0,
  zombiesKilled: 0,
  playerKills: 0,
  towerKills: 0,
  damageDealt: 0,
  damageTaken: 0,
  wavesCleared: 0,
  campaignWins: 0,
};

const DEFAULT_SAVE: SaveState = {
  version: SAVE_VERSION,
  money: 35,
  wave: 0,
  stallLevel: 1,
  towerBuilt: false,
  bestWave: 0,
  weapon: "machete",
  employees: { hunter: false, cashier: false, dog: false },
  pasture2Unlocked: false,
  towers: { ballista: 0, frost: 0, cannon: 0 },
  quest: { chapter: 1, completed: [], unlocks: [], loop: null },
  stats: { ...DEFAULT_STATS },
  lastSavedAt: 0,
};

function finite(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function migrate(input: unknown): SaveState {
  const raw = record(input);
  const oldTowerBuilt = boolean(raw.towerBuilt);
  const employees = record(raw.employees);
  const towers = record(raw.towers);
  const quest = record(raw.quest);
  const stats = record(raw.stats);
  const weapon = raw.weapon === "axe" || raw.weapon === "smg" ? raw.weapon : "machete";
  const wave = finite(raw.wave, 0, 0, 30);
  const ballista = finite(towers.ballista, oldTowerBuilt ? 1 : 0, 0, 3);
  const loopRaw = record(quest.loop);
  const loop = typeof loopRaw.id === "string" && loopRaw.id.length > 0 ? {
    id: loopRaw.id,
    wave: finite(loopRaw.wave, wave + 1, 1, 30),
    progress: finite(loopRaw.progress, 0),
    target: finite(loopRaw.target, 1, 1),
    reward: finite(loopRaw.reward, 20, 0),
    completed: boolean(loopRaw.completed),
    claimed: boolean(loopRaw.claimed),
  } satisfies LoopQuestState : null;
  const completed = Array.isArray(quest.completed)
    ? [...new Set(quest.completed.map((value) => finite(value, 0, 0, 15)).filter(Boolean))]
    : [];
  const unlocks = Array.isArray(quest.unlocks)
    ? [...new Set(quest.unlocks.filter((value): value is string => typeof value === "string"))]
    : [];

  return {
    version: SAVE_VERSION,
    money: finite(raw.money, DEFAULT_SAVE.money),
    wave,
    stallLevel: finite(raw.stallLevel, 1, 1, 4),
    towerBuilt: ballista > 0,
    bestWave: finite(raw.bestWave, wave, 0, 30),
    weapon,
    employees: {
      hunter: boolean(employees.hunter),
      cashier: boolean(employees.cashier),
      dog: boolean(employees.dog),
    },
    pasture2Unlocked: boolean(raw.pasture2Unlocked),
    towers: {
      ballista,
      frost: finite(towers.frost, 0, 0, 3),
      cannon: finite(towers.cannon, 0, 0, 3),
    },
    quest: {
      chapter: finite(quest.chapter, 1, 1, 16),
      completed,
      unlocks,
      loop,
    },
    stats: {
      pastureVisited: boolean(stats.pastureVisited),
      cowsKilled: finite(stats.cowsKilled, 0),
      meatCollected: finite(stats.meatCollected, 0),
      meatDeposited: finite(stats.meatDeposited, 0),
      sales: finite(stats.sales, 0),
      totalEarned: finite(stats.totalEarned, 0),
      zombiesKilled: finite(stats.zombiesKilled, 0),
      playerKills: finite(stats.playerKills, 0),
      towerKills: finite(stats.towerKills, 0),
      damageDealt: finite(stats.damageDealt, 0),
      damageTaken: finite(stats.damageTaken, 0),
      wavesCleared: finite(stats.wavesCleared, wave, 0, 30),
      campaignWins: finite(stats.campaignWins, 0),
    },
    lastSavedAt: finite(raw.lastSavedAt, 0),
  };
}

export function loadState(): RuntimeState {
  let saved = { ...DEFAULT_SAVE, employees: { ...DEFAULT_SAVE.employees }, towers: { ...DEFAULT_SAVE.towers }, quest: { ...DEFAULT_SAVE.quest }, stats: { ...DEFAULT_STATS } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) saved = migrate(JSON.parse(raw));
  } catch {
    saved = migrate(DEFAULT_SAVE);
  }
  return {
    ...saved,
    carriedMeat: 0,
    displayedMeat: 0,
    baseHealth: 100,
    waveActive: false,
    enemiesRemaining: 0,
    selectedTower: "ballista",
    currentFps: 0,
    drawCalls: 0,
    quality: "高",
  };
}

export function saveState(state: RuntimeState): void {
  const snapshot: SaveState = {
    version: SAVE_VERSION,
    money: state.money,
    wave: state.wave,
    stallLevel: state.stallLevel,
    towerBuilt: state.towers.ballista > 0,
    bestWave: Math.max(state.bestWave, state.wave),
    weapon: state.weapon,
    employees: { ...state.employees },
    pasture2Unlocked: state.pasture2Unlocked,
    towers: { ...state.towers },
    quest: {
      chapter: state.quest.chapter,
      completed: [...state.quest.completed],
      unlocks: [...state.quest.unlocks],
      loop: state.quest.loop ? { ...state.quest.loop } : null,
    },
    stats: { ...state.stats },
    lastSavedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // 無痕模式或儲存空間不足時，遊戲仍可繼續運作。
  }
}

export function resetSave(): void {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
