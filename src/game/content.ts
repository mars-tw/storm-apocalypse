import type { EmployeeId, RuntimeState, TowerId, WeaponId } from "./state";

export interface ShopItem<T extends string> {
  id: T;
  name: string;
  description: string;
  price: number;
}

export const WEAPONS: readonly ShopItem<WeaponId>[] = [
  { id: "machete", name: "砍刀", description: "近距離單體揮砍 · 傷害 2", price: 0 },
  { id: "axe", name: "迴旋斧", description: "360° 橫掃 · 傷害 3", price: 120 },
  { id: "smg", name: "衝鋒槍", description: "遠程掃射 · 傷害 2×3", price: 360 },
] as const;

export const EMPLOYEES: readonly ShopItem<EmployeeId>[] = [
  { id: "hunter", name: "獵人", description: "巡邏牧場並自動攻擊牛隻", price: 140 },
  { id: "cashier", name: "收銀員", description: "快速結帳並增加 5 金小費", price: 190 },
  { id: "dog", name: "牧羊犬", description: "拾取肉品並搬回攤位", price: 230 },
] as const;

export const TOWERS: readonly ShopItem<TowerId>[] = [
  { id: "ballista", name: "獵風弩塔", description: "快速單體箭矢", price: 60 },
  { id: "frost", name: "寒霜塔", description: "低傷害並減速 45%", price: 110 },
  { id: "cannon", name: "火砲塔", description: "慢速範圍爆炸", price: 160 },
] as const;

export interface MainQuestDefinition {
  chapter: number;
  title: string;
  log: string;
  target: number;
  rewardGold: number;
  rewardUnlock?: string;
  rewardLabel: string;
  progress: (state: RuntimeState) => number;
}

const employeeCount = (state: RuntimeState): number => Object.values(state.employees).filter(Boolean).length;
const towerCount = (state: RuntimeState): number => Object.values(state.towers).filter((level) => level > 0).length;

export const SHOP_UNLOCK_CHAPTER = {
  defenseShop: 5,
  employeeShop: 6,
  pasture2: 7,
  axe: 8,
  smg: 9,
  towerUpgrade: 10,
} as const;

export function hasCompletedChapter(state: RuntimeState, chapter: number): boolean {
  return state.quest.chapter > chapter || state.quest.completed.includes(chapter);
}

export const MAIN_QUESTS: readonly MainQuestDefinition[] = [
  { chapter: 1, title: "前往東側牧場", log: "封鎖線以東還有活物。今晚的湯，得靠自己的刀。", target: 1, rewardGold: 10, rewardLabel: "✦ 10", progress: (s) => Number(s.stats.pastureVisited) },
  { chapter: 2, title: "第一份獵物", log: "風雪會掩去血跡，但飢餓不會。", target: 1, rewardGold: 20, rewardLabel: "✦ 20", progress: (s) => s.stats.cowsKilled },
  { chapter: 3, title: "把肉帶回來", log: "別在雪地清點收穫；凍僵的人守不住任何東西。", target: 3, rewardGold: 0, rewardUnlock: "stall-guide", rewardLabel: "解鎖陳列提示", progress: (s) => s.stats.meatCollected },
  { chapter: 4, title: "點亮紅色攤位", log: "紅燈不是招牌，是告訴迷路的人：這裡還有人活著。", target: 3, rewardGold: 25, rewardLabel: "✦ 25", progress: (s) => s.stats.meatDeposited },
  { chapter: 5, title: "北境第一筆交易", log: "硬幣再次發出聲音。秩序也許還沒有死透。", target: 1, rewardGold: 30, rewardUnlock: "defense-shop", rewardLabel: "✦ 30 · 防線商店", progress: (s) => s.stats.sales },
  { chapter: 6, title: "生意必須活下去", log: "肉品、委託與守夜所得，都是讓肉舖活下去的收入。", target: 200, rewardGold: 50, rewardUnlock: "employee-shop", rewardLabel: "✦ 50 · 員工招募", progress: (s) => s.stats.totalEarned },
  { chapter: 7, title: "第一位同伴", log: "名冊多了一個名字，火堆旁也多了一道影子。", target: 1, rewardGold: 60, rewardLabel: "✦ 60", progress: employeeCount },
  { chapter: 8, title: "炸開第二牧場", log: "炸藥驚醒了林子；樹後的角，比記錄裡更粗。", target: 1, rewardGold: 0, rewardUnlock: "strong-cattle", rewardLabel: "強化牛 · 高產肉", progress: (s) => Number(s.pasture2Unlocked) },
  { chapter: 9, title: "換一把能活命的刀", log: "刀刃會鈍。會回到手裡的斧，才配得上這場暴風。", target: 1, rewardGold: 75, rewardLabel: "✦ 75", progress: (s) => Number(s.weapon === "axe" || s.weapon === "smg") },
  { chapter: 10, title: "三角防線", log: "弩矢、寒霜、火藥。三種聲音，組成封鎖區的新鐘聲。", target: 3, rewardGold: 100, rewardUnlock: "tower-upgrade", rewardLabel: "✦ 100 · 塔升級", progress: towerCount },
  { chapter: 11, title: "第五次鐘響", log: "第五次清點屍體時，我們不再發抖。", target: 5, rewardGold: 125, rewardLabel: "✦ 125", progress: (s) => s.wave },
  { chapter: 12, title: "無人也能運轉", log: "就算我倒在雪裡，肉舖的燈也會繼續亮。", target: 3, rewardGold: 180, rewardUnlock: "automation", rewardLabel: "✦ 180 · 全自動徽記", progress: employeeCount },
  { chapter: 13, title: "暴風中段", log: "第十五夜後，無線電只剩我們的呼號。", target: 15, rewardGold: 250, rewardUnlock: "repair", rewardLabel: "✦ 250 · 修復壁壘", progress: (s) => s.wave },
  { chapter: 14, title: "武裝最後防線", log: "把剩下的子彈排好。北方那個巨大輪廓正在靠近。", target: 2, rewardGold: 350, rewardUnlock: "final-alert", rewardLabel: "✦ 350 · 終局警報", progress: (s) => Number(s.weapon === "smg") + Number(Math.max(...Object.values(s.towers)) >= 3) },
  { chapter: 15, title: "讓黎明留下", log: "第三十次鐘聲穿過風牆。這次，回聲來自活人。", target: 30, rewardGold: 0, rewardUnlock: "north-watcher", rewardLabel: "戰役破關 · 北境守望者", progress: (s) => s.wave },
] as const;

export interface LoopQuestDefinition {
  id: string;
  title: string;
  description: string;
  available: (state: RuntimeState, context: LoopQuestContext) => boolean;
  target: (wave: number) => number;
  rewardBase: number;
  rewardPerWave: number;
}

export interface LoopQuestContext {
  wave: number;
  enemyCount: number;
  startingStock: number;
  startingHealth: number;
  hasStockThreat: boolean;
}

export const LOOP_QUESTS: readonly LoopQuestDefinition[] = [
  { id: "stock-safe", title: "完整貨架", description: "有存貨且有蠻屍威脅時，本波不損失存貨", available: (_s, c) => c.startingStock > 0 && c.hasStockThreat, target: () => 1, rewardBase: 20, rewardPerWave: 2 },
  { id: "tower-kills", title: "箭雨校準", description: "由防禦塔擊殺殭屍", available: (s) => towerCount(s) > 0, target: (wave) => 3 + Math.floor(wave / 3), rewardBase: 20, rewardPerWave: 3 },
  { id: "player-kills", title: "親手清場", description: "由玩家親手擊殺殭屍", available: () => true, target: (wave) => 2 + Math.floor(wave / 5), rewardBase: 25, rewardPerWave: 3 },
  { id: "healthy-wall", title: "不退防線", description: "以 75% 以上壁壘完成具奔行者威脅的一波", available: (_s, c) => c.wave >= 4 && c.startingHealth >= 75, target: () => 1, rewardBase: 25, rewardPerWave: 2 },
  { id: "frost-hits", title: "寒霜驗證", description: "以寒霜塔命中殭屍", available: (s) => s.towers.frost > 0, target: (wave) => 5 + wave, rewardBase: 20, rewardPerWave: 2 },
  { id: "cannon-combo", title: "爆破紀錄", description: "高密度夜襲中，單次砲擊命中至少 3 隻", available: (s, c) => s.towers.cannon > 0 && c.enemyCount >= 18, target: () => 1, rewardBase: 35, rewardPerWave: 2 },
] as const;

export function towerUpgradeCost(id: TowerId, level: number): number {
  return TOWERS.find((tower) => tower.id === id)!.price + level * 70;
}
