export interface SaveState {
  money: number;
  wave: number;
  stallLevel: number;
  towerBuilt: boolean;
  bestWave: number;
}

export interface RuntimeState extends SaveState {
  carriedMeat: number;
  displayedMeat: number;
  baseHealth: number;
  waveActive: boolean;
  enemiesRemaining: number;
}

const SAVE_KEY = "storm-apocalypse-save-v1";

const DEFAULT_SAVE: SaveState = {
  money: 35,
  wave: 0,
  stallLevel: 1,
  towerBuilt: false,
  bestWave: 0,
};

export function loadState(): RuntimeState {
  let saved = DEFAULT_SAVE;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) saved = { ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveState>) };
  } catch {
    saved = DEFAULT_SAVE;
  }

  return {
    ...saved,
    carriedMeat: 0,
    displayedMeat: 0,
    baseHealth: 100,
    waveActive: false,
    enemiesRemaining: 0,
  };
}

export function saveState(state: RuntimeState): void {
  const snapshot: SaveState = {
    money: state.money,
    wave: state.wave,
    stallLevel: state.stallLevel,
    towerBuilt: state.towerBuilt,
    bestWave: Math.max(state.bestWave, state.wave),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
}

export function resetSave(): void {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
