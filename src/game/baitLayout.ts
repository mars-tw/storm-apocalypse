// Tactical map coordinates use the same world space as combat and tower targeting.
export const BAIT_LAYOUTS = [
  { id: "west", name: "西側攔截", x: -5, z: 12, hint: "靠近寒霜塔，拖住西側來敵" },
  { id: "center", name: "中央聚攏", x: 0, z: 12, hint: "集中兩側屍群，交給弩塔集火" },
  { id: "east", name: "東側繞行", x: 5, z: 12, hint: "把東側來敵留在火砲射界" },
] as const;
export type BaitLayoutId = typeof BAIT_LAYOUTS[number]["id"];
export const LAYOUT_SAVE_KEY = "storm-apocalypse-layout-v1";
export function layoutFor(id: string) { return BAIT_LAYOUTS.find(p => p.id === id) ?? BAIT_LAYOUTS[1]; }
export function canClaimStarter(wave: number, towers: Record<string, number>): boolean {
  return wave === 0 && Object.values(towers).every(level => level === 0);
}
export function layoutObjective(attracted: number): boolean { return attracted >= 2; }
