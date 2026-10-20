// R23：好玩 × 美觀的純規則層（無 Babylon 依賴，可在 node 單元測試）。

// ---------- 連斬 ----------
export const COMBO_WINDOW_SECONDS = 2.6;
export const COMBO_BONUS_THRESHOLD = 5;
export const COMBO_BONUS_CAP = 3;

export interface ComboState {
  count: number;
  lastKillAt: number;
  best: number;
}

export function createCombo(): ComboState {
  return { count: 0, lastKillAt: Number.NEGATIVE_INFINITY, best: 0 };
}

/** 登記一次玩家擊殺，回傳本次連斬數與額外 ✦。 */
export function registerComboKill(combo: ComboState, now: number): { count: number; bonus: number } {
  combo.count = now - combo.lastKillAt <= COMBO_WINDOW_SECONDS ? combo.count + 1 : 1;
  combo.lastKillAt = now;
  combo.best = Math.max(combo.best, combo.count);
  const bonus = combo.count >= COMBO_BONUS_THRESHOLD
    ? Math.min(COMBO_BONUS_CAP, 1 + Math.floor((combo.count - COMBO_BONUS_THRESHOLD) / 3))
    : 0;
  return { count: combo.count, bonus };
}

export function comboExpired(combo: ComboState, now: number): boolean {
  return combo.count > 0 && now - combo.lastKillAt > COMBO_WINDOW_SECONDS;
}

// ---------- 鮮肉誘餌 ----------
export const BAIT_RULES = Object.freeze({
  radius: 9,
  lifetime: 4.5,
  cooldown: 9,
  throwDistance: 2.4,
  feedRange: 0.9,
});

export type BaitSource = "scraps" | "carried" | "stock";

/** 每波附 1 份免費邊角料；用完後先扣背包，再扣攤位存貨；都沒有就不能丟。 */
export function pickBaitSource(carriedMeat: number, displayedMeat: number, scraps = 0): BaitSource | null {
  if (scraps > 0) return "scraps";
  if (carriedMeat > 0) return "carried";
  if (displayedMeat > 0) return "stock";
  return null;
}

export interface BaitCandidate {
  type: string;
  alive: boolean;
  x: number;
  z: number;
}

/** 回傳會被誘餌吸引的殭屍索引：活著、非 Boss、在半徑內。 */
export function baitAttractedIndices(bait: { x: number; z: number }, zombies: readonly BaitCandidate[], radius = BAIT_RULES.radius): number[] {
  const result: number[] = [];
  zombies.forEach((zombie, index) => {
    if (!zombie.alive || zombie.type === "boss") return;
    if (Math.hypot(zombie.x - bait.x, zombie.z - bait.z) <= radius) result.push(index);
  });
  return result;
}

// ---------- 波次評級 ----------
export type WaveGrade = "S" | "A" | "B" | "C";

export interface WaveReportInput {
  wallDamage: number;
  playerKills: number;
  totalKills: number;
  bestCombo: number;
  stockLost: boolean;
}

export function gradeWave(input: WaveReportInput): WaveGrade {
  const share = input.totalKills > 0 ? input.playerKills / input.totalKills : 0;
  let score = 0;
  score += input.wallDamage === 0 ? 3 : input.wallDamage <= 12 ? 2 : input.wallDamage <= 30 ? 1 : 0;
  score += share >= 0.4 ? 2 : share >= 0.15 ? 1 : 0;
  score += input.bestCombo >= 5 ? 1 : 0;
  score -= input.stockLost ? 1 : 0;
  if (score >= 5) return "S";
  if (score >= 3) return "A";
  if (score >= 2) return "B";
  return "C";
}

export const WAVE_GRADE_LABEL: Record<WaveGrade, string> = {
  S: "滴水不漏",
  A: "防線穩固",
  B: "勉強守住",
  C: "險些失守",
};

// ---------- 結算建議 ----------
export interface RunAdviceInput {
  won: boolean;
  wave: number;
  playerKills: number;
  towerKills: number;
  damageTaken: number;
  baitsThrown: number;
  bestCombo: number;
  towersBuilt: number;
  maxTowerLevel: number;
}

export function runAdvice(input: RunAdviceInput): string {
  if (input.won) return input.bestCombo >= 10 ? "挑戰下一局：換一位守燈人，試著讓連斬破 15。" : "下一局：多用斧和誘餌把屍群拉在一起，衝更高的連斬。";
  const total = input.playerKills + input.towerKills;
  const playerShare = total > 0 ? input.playerKills / total : 0;
  if (input.towersBuilt < 3) return "建議：三種塔各蓋一座。寒霜減速加弩箭輸出，是守過中段的關鍵。";
  if (input.baitsThrown === 0 && input.wave >= 6) return "建議：守波時按 Q（手機點「誘餌」）丟一塊肉，把屍群拉進塔的射界再一起清掉。";
  if (input.maxTowerLevel < 3 && input.wave >= 12) return "建議：把主力塔升到 Lv.3。後段敵人血量成長比塔數量更快。";
  if (playerShare < 0.15) return "建議：塔撐不住時親自上前線。斧的範圍攻擊能一口氣打斷屍群。";
  return "建議：精英波（第 9、14、19…波）前先修好壁壘、攤位留幾份肉當誘餌。";
}

// ---------- 訊息合併 ----------
export interface ToastEntry {
  message: string;
  count: number;
  shownAt: number;
}

export const TOAST_MAX_VISIBLE = 3;
export const TOAST_MERGE_SECONDS = 2.2;

/** 回傳應合併的既有訊息索引；-1 代表新增。 */
export function findMergeableToast(entries: readonly ToastEntry[], message: string, now: number): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].message === message && now - entries[index].shownAt <= TOAST_MERGE_SECONDS) return index;
  }
  return -1;
}
