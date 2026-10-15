// Permanent, local-only progression. Campaign reset deliberately retains this key.
export const PATROL_KEY = "storm-apocalypse-patrol-v1";
export type SupplyId = "standard" | "ration" | "repair" | "bounty";
export interface PatrolProfile { version: 1; completedWaves: number[]; selected: SupplyId }
export const SUPPLIES = [
  { id: "standard", name: "標準補給", threshold: 0, detail: "每波 1 份免費誘餌，壁壘修復 12。" },
  { id: "ration", name: "誘餌袋", threshold: 1, detail: "每波多 1 份免費誘餌，適合引怪集火。" },
  { id: "repair", name: "修繕箱", threshold: 3, detail: "開波額外修復 6 點壁壘，最高 100。" },
  { id: "bounty", name: "賞金證", threshold: 5, detail: "每次清波額外獲得 ✦15。" },
] as const;
export function normalizePatrol(raw: unknown): PatrolProfile {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const completedWaves = Array.isArray(data.completedWaves)
    ? [...new Set(data.completedWaves.filter((w): w is number => Number.isInteger(w) && w >= 1 && w <= 30))].sort((a, b) => a - b) : [];
  const selected = SUPPLIES.find(s => s.id === data.selected && s.threshold <= completedWaves.length)?.id ?? "standard";
  return { version: 1, completedWaves, selected };
}
export function loadPatrol(): PatrolProfile {
  try { return normalizePatrol(JSON.parse(localStorage.getItem(PATROL_KEY) ?? "null")); }
  catch { return normalizePatrol(null); }
}
export function savePatrol(profile: PatrolProfile): void {
  try { localStorage.setItem(PATROL_KEY, JSON.stringify(profile)); } catch { /* Session remains playable. */ }
}
export function selectSupply(profile: PatrolProfile, id: SupplyId): boolean {
  if (!SUPPLIES.some(s => s.id === id && s.threshold <= profile.completedWaves.length)) return false;
  profile.selected = id;
  return true;
}
export function supplyEffects(id: SupplyId): { scraps: number; repair: number; bonus: number } {
  return { scraps: id === "ration" ? 2 : 1, repair: id === "repair" ? 6 : 0, bonus: id === "bounty" ? 15 : 0 };
}
export interface PatrolMetrics { attracted: number; playerKills: number; wallDamage: number }
export function patrolObjective(wave: number, metrics: PatrolMetrics = { attracted: 0, playerKills: 0, wallDamage: 0 }) {
  if (wave % 3 === 0) return { title: "引怪集火", hint: "用誘餌引來 2 隻敵人", progress: Math.min(2, metrics.attracted), target: 2, complete: metrics.attracted >= 2 };
  if (wave % 3 === 2) return { title: "親手守夜", hint: "親手擊殺 2 隻敵人", progress: Math.min(2, metrics.playerKills), target: 2, complete: metrics.playerKills >= 2 };
  return { title: "守住燈火", hint: "清波時壁壘承傷不超過 12", progress: metrics.wallDamage, target: 12, complete: metrics.wallDamage <= 12 };
}
export function awardPatrol(profile: PatrolProfile, wave: number, metrics: PatrolMetrics): boolean {
  if (!Number.isInteger(wave) || wave < 1 || wave > 30 || profile.completedWaves.includes(wave) || !patrolObjective(wave, metrics).complete) return false;
  profile.completedWaves.push(wave);
  profile.completedWaves.sort((a, b) => a - b);
  return true;
}

// Screen drag is normalized and capped so one thumb can reach the whole throw fan.
export function baitDrag(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  return { aimed: distance >= 18, x: distance > 0 ? dx / distance : 0, y: distance > 0 ? dy / distance : 0, power: Math.min(1, distance / 90) };
}
