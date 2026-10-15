export type DirectorZombieType = "walker" | "runner" | "brute" | "boss";
export type WaveEventId = "standard" | "whiteout" | "elite_surge" | "boss" | "hungry_rush" | "haulers";

export interface WavePlan {
  wave: number;
  balanceProfile: WaveBalanceProfile["id"];
  event: WaveEventId;
  title: string;
  forecast: string;
  announcement: string;
  enemyCount: number;
  spawnInterval: number;
  hpMultiplier: number;
  speedMultiplier: number;
  damageMultiplier: number;
}

export interface WaveBalanceProfile {
  id: "r19" | "r20" | "r21" | "r22";
  finalWaveSpawnMultiplier: number;
  finalWaveHpMultiplier: number;
  finalWaveEnemyBonus: number;
  finalWaveDamageMultiplier: number;
}

export const WAVE_BALANCE_PROFILES: Readonly<Record<WaveBalanceProfile["id"], WaveBalanceProfile>> = Object.freeze({
  r19: Object.freeze({ id: "r19", finalWaveSpawnMultiplier: 0.9, finalWaveHpMultiplier: 1.08, finalWaveEnemyBonus: 1, finalWaveDamageMultiplier: 1 }),
  r20: Object.freeze({ id: "r20", finalWaveSpawnMultiplier: 0.9, finalWaveHpMultiplier: 1.07, finalWaveEnemyBonus: 1, finalWaveDamageMultiplier: 1 }),
  r21: Object.freeze({ id: "r21", finalWaveSpawnMultiplier: 0.9, finalWaveHpMultiplier: 1.07, finalWaveEnemyBonus: 1, finalWaveDamageMultiplier: 1 }),
  r22: Object.freeze({ id: "r22", finalWaveSpawnMultiplier: 0.9, finalWaveHpMultiplier: 1.07, finalWaveEnemyBonus: 1, finalWaveDamageMultiplier: 1.075 }),
});

export const ACTIVE_WAVE_BALANCE = WAVE_BALANCE_PROFILES.r22;

export function getWavePlan(wave: number, balance: WaveBalanceProfile = ACTIVE_WAVE_BALANCE): WavePlan {
  const normalized = Math.min(30, Math.max(1, Math.floor(wave)));
  const baseCount = Math.min(42, 4 + Math.ceil(normalized * 1.22));
  const baseInterval = Math.max(0.38, 0.86 - (normalized - 1) * 0.014);

  // Authored early encounters teach bait control before the first Boss.
  // Historical profiles retain their original enemy lineups for comparisons.
  if (balance.id === "r22" && (normalized === 3 || normalized === 7)) {
    const hungry = normalized === 3;
    return {
      wave: normalized, balanceProfile: balance.id, event: hungry ? "hungry_rush" : "haulers",
      title: hungry ? "飢餓快襲" : "蠻屍搬貨隊",
      forecast: hungry ? "雙奔行者 · 誘餌引進塔射界" : "兩隻蠻屍 · 寒霜控場保貨架",
      announcement: hungry ? "奔行者搶先抵達，用誘餌讓牠們停步" : "蠻屍打算搬走攤位存貨，先控場再集火",
      enemyCount: hungry ? 7 : 10, spawnInterval: hungry ? 0.9 : 1.05,
      hpMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
    };
  }

  if (normalized % 10 === 0) {
    return {
      wave: normalized,
      balanceProfile: balance.id,
      event: "boss",
      title: "巨屍越界",
      forecast: "Boss · 重型護衛",
      announcement: "巨型屍影正撞開北境封鎖線",
      enemyCount: Math.min(43, baseCount + balance.finalWaveEnemyBonus),
      spawnInterval: baseInterval * balance.finalWaveSpawnMultiplier,
      hpMultiplier: balance.finalWaveHpMultiplier,
      speedMultiplier: 1,
      damageMultiplier: balance.finalWaveDamageMultiplier,
    };
  }

  if (normalized % 6 === 0) {
    return {
      wave: normalized,
      balanceProfile: balance.id,
      event: "whiteout",
      title: "白幕突襲",
      forecast: "低能見度 · 奔行者連襲",
      announcement: "白幕壓境，奔行者借風雪逼近",
      enemyCount: Math.min(42, baseCount + 3),
      spawnInterval: Math.max(0.3, baseInterval * 0.72),
      hpMultiplier: 0.96,
      speedMultiplier: 1.12,
      damageMultiplier: 1,
    };
  }

  if (normalized >= 9 && normalized % 5 === 4) {
    const usesR22EliteCurve = balance.id === "r22";
    return {
      wave: normalized,
      balanceProfile: balance.id,
      event: "elite_surge",
      title: "精英壓境",
      forecast: "蠻屍隊列 · 高生命",
      announcement: "精英蠻屍護住屍群中央，準備集火",
      enemyCount: usesR22EliteCurve ? baseCount : Math.min(42, baseCount + 2),
      // Elite escorts arrive in a tighter column at every elite encounter.
      // Keep the HP budget below the following boss rather than inflating W29 HP.
      spawnInterval: usesR22EliteCurve ? baseInterval - 0.027 : baseInterval * 1.08,
      hpMultiplier: usesR22EliteCurve ? 1.07 : 1.2,
      speedMultiplier: usesR22EliteCurve ? 1 : 0.94,
      damageMultiplier: 1,
    };
  }

  return {
    wave: normalized,
    balanceProfile: balance.id,
    event: "standard",
    title: "北境夜襲",
    forecast: normalized >= 16 ? "奔行者＋蠻屍" : normalized >= 6 ? "行屍＋奔行者" : "行屍",
    announcement: "屍群穿越北境封鎖線",
    enemyCount: baseCount,
    spawnInterval: baseInterval,
    hpMultiplier: 1,
    speedMultiplier: 1,
    damageMultiplier: 1,
  };
}

export function enemyTypeForWave(plan: WavePlan, order: number): DirectorZombieType {
  if (plan.event === "hungry_rush") return order === plan.enemyCount || order === plan.enemyCount - 1 ? "runner" : "walker";
  if (plan.event === "haulers") return order === plan.enemyCount || order === 4 ? "brute" : order === 7 ? "runner" : "walker";
  if (plan.event === "boss" && order === 1) return "boss";
  if (plan.event === "whiteout" && (order % 4 === 0 || order % 4 === 1)) return "runner";
  if (plan.event === "elite_surge" && plan.balanceProfile === "r22") {
    if (order === 1 || order % 3 === 0) return "brute";
    if (order % 4 === 0) return "runner";
    return "walker";
  }
  if (plan.event === "elite_surge" && order % 3 === 0) return "brute";
  if (plan.wave >= 8 && order % 5 === 0) return "brute";
  if (plan.wave >= 4 && order % 3 === 0) return "runner";
  return "walker";
}
