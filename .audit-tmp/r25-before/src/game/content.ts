import type { EmployeeId, NamedCustomerId, ProtagonistId, RuntimeState, TowerId, WeaponId } from "./state";

export interface ShopItem<T extends string> {
  id: T;
  name: string;
  description: string;
  price: number;
  upgradePrice?: number;
  upgradeDescription?: string;
}

export interface ProtagonistDefinition {
  id: ProtagonistId;
  name: string;
  persona: string;
  passive: string;
  passiveDescription: string;
  runSummary: string;
  openingLine: string;
  victoryLine: string;
  defeatEarlyLine: string;
  defeatLateLine: string;
  model: string;
  portrait: string;
}

export const PROTAGONISTS: readonly ProtagonistDefinition[] = [
  {
    id: "butcher_matron",
    name: "屠夫老闆娘",
    persona: "沒秤就沒公道，沒公道就只剩搶。",
    passive: "賣肉 +10%",
    passiveDescription: "每筆肉品交易收入提升 10%",
    runSummary: "這局：肉舖更快堆出第一座塔",
    openingLine: "秤要準。今天的肉，還有人等。",
    victoryLine: "秤還是準的。第三十次鐘聲裡，我把刀擦乾淨掛回門後——明天，照常開店。",
    defeatEarlyLine: "肉還溫著，燈就滅了。把攤子收好——我們從第一塊肉重新賒起。",
    defeatLateLine: "撐到這麼晚才滅燈，不丟人。刀我磨好了，下一次，鐘聲數到底。",
    model: "custom/characters/protagonist-butcher-matron.glb",
    portrait: "images/characters/protagonist-butcher-matron.png",
  },
  {
    id: "vet_sniper",
    name: "退伍狙擊手",
    persona: "子彈會用完，但準星還在腦子裡。",
    passive: "武器傷 +1",
    passiveDescription: "你的武器每次命中額外 +1 傷害",
    runSummary: "這局：你的刀與槍更疼，守夜更像獵人",
    openingLine: "風向不對。先保住燈，再談子彈。",
    victoryLine: "三十聲，一聲不差。槍管涼下來的時候，雪也停了。",
    defeatEarlyLine: "太快了。這不是敗仗，是偵察——記下牠們的路線。",
    defeatLateLine: "彈殼埋進雪裡，燈滅在第三十次鐘聲前。記下風向。下一次，我提前兩秒開火。",
    model: "custom/characters/protagonist-vet-sniper.glb",
    portrait: "images/characters/protagonist-vet-sniper.png",
  },
  {
    id: "mech_youth",
    name: "機械師少年",
    persona: "齒輪比人誠實，轉不動就換。",
    passive: "塔費 -10%",
    passiveDescription: "建造與升級防禦塔費用九折",
    runSummary: "這局：三角防線比較不傷本",
    openingLine: "塔架歪了半指……我先焊，你們先撐。",
    victoryLine: "塔架最後還是歪半指。可是它站著，我們也都站著。",
    defeatEarlyLine: "圖紙沒錯，是料不夠。撿回零件——齒輪還轉得動。",
    defeatLateLine: "焊點是撐到最後才裂的。這版圖紙留著，下一台會更硬。",
    model: "custom/characters/protagonist-mech-youth.glb",
    portrait: "images/characters/protagonist-mech-youth.png",
  },
] as const;

export interface NamedCustomerDefinition {
  id: NamedCustomerId;
  name: string;
  role: string;
  preference: string;
  arrivalLine: string;
  arrivalLineMid: string;
  arrivalLineHigh: string;
  affinityBonus: string;
  friendMark: string;
  friendMarkName: string;
  weight: number;
  model: string;
}

export const NAMED_CUSTOMERS: readonly NamedCustomerDefinition[] = [
  { id: "lao_zhou", name: "老周", role: "廢鐵收購", preference: "偏好：好肉／份量感", arrivalLine: "夠秤就行。封鎖線外面……更黑。", arrivalLineMid: "你們的秤，比封鎖線裡任何一把都老實。今天多收一份。", arrivalLineHigh: "外頭誰問北邊還有沒有活人，我就說：有，他們的燈最亮。", affinityBonus: "每筆肉品交易 +1 金", friendMark: "friend-lao-zhou", friendMarkName: "廢鐵之友", weight: 0.12, model: "custom/characters/npc-lao-zhou.glb" },
  { id: "nurse_lin", name: "林護理", role: "醫務夜班", preference: "偏好：穩定供貨", arrivalLine: "帳篷裡還有人醒著。給我能下鍋的。", arrivalLineMid: "昨晚的湯讓兩個傷員退了燒。同一份，再來一次。", arrivalLineHigh: "今晚換我守攤子前半夜。你們去睡——醫囑。", affinityBonus: "壁壘受擊時 8% 機率減免 1 傷", friendMark: "friend-nurse-lin", friendMarkName: "夜班燈火", weight: 0.12, model: "custom/characters/npc-nurse-lin.glb" },
  { id: "kid_bao", name: "小包", role: "雪屋孩子", preference: "偏好：便宜／人情", arrivalLine: "我數過三次……這次夠不夠？", arrivalLineMid: "阿姨說你們的燈是全區最亮的。我帶了她縫的手套——換半份就好。", arrivalLineHigh: "今晚換我守攤子前面那段路。誰靠近，我就搖鈴。", affinityBonus: "賣肉時 5% 機率多付 5 金", friendMark: "friend-kid-bao", friendMarkName: "雪屋守護", weight: 0.11, model: "custom/characters/npc-kid-bao.glb" },
  { id: "scout_he", name: "何偵察", role: "北境巡邏", preference: "偏好：戰備充足", arrivalLine: "北面有動靜。你們的燈，別滅。", arrivalLineMid: "巡邏圖上，我把你們標成了補給點。別讓我改回去。", arrivalLineHigh: "司令部問哪裡能當前哨。我報了這裡——連你們的鐘聲一起。", affinityBonus: "所有擊殺賞金 +1", friendMark: "friend-scout-he", friendMarkName: "北境眼線", weight: 0.10, model: "custom/characters/npc-scout-he.glb" },
] as const;

// R17（辯論裁決 B-01 縮幅）：北境電台——里程碑波間廣播（純文案，零數值）
export const WAVE_DISPATCHES: ReadonlyArray<{ wave: number; line: string }> = [
  { wave: 1, line: "電台載波剛穩下來：「聽得到的人，把燈點著。今晚起，我們一起數鐘聲。」" },
  { wave: 5, line: "電台雜訊裡擠出半句人聲：「……燈還亮著就回覆。」你把發電機油門又推了一格。" },
  { wave: 6, line: "廣播換了個更啞的嗓子：「白幕要來了。看不見的時候，聽你們自己的鐘。」" },
  { wave: 10, line: "第十次鐘聲。老周說南邊有車燈閃了三下——三下，是活人的暗號。" },
  { wave: 15, line: "電台唸了一串名字，都是撐過半程的據點。唸到你們時，訊號特別清楚。" },
  { wave: 20, line: "「第二十波。」廣播頓了頓：「還在的，都已經是老兵了。」" },
  { wave: 25, line: "遠處傳來別的鐘聲——不是你們的。原來這片雪原上，不止一盞燈。" },
  { wave: 29, line: "第 1,276 日。這次無線電很清楚：「看得到你們的燈。撐過今晚。」" },
  { wave: 30, line: "電台安靜了三秒，然後所有頻道一起響：「第三十聲。北境，天亮了。」" },
] as const;

// R18 C-01：波前動員線——與 WAVE_DISPATCHES 完成線成對（開波時播），維持里程碑節奏、不灌水安靜波
export const WAVE_EVE_DISPATCHES: ReadonlyArray<{ wave: number; line: string }> = [
  { wave: 5, line: "電台壓低聲音：「第五波是試金石。塔架要是會晃，現在就去焊。」" },
  { wave: 10, line: "開波前，老周把鐵門拉了半掩：「第十波起，牠們開始懂得繞路了。」" },
  { wave: 15, line: "林護理把繃帶捲塞進你口袋：「中場之後，別再逞英雄。」" },
  { wave: 20, line: "電台：「第二十波。守到這裡的人，名字都會被記住。」" },
  { wave: 25, line: "何偵察在雪裡比了個手勢：北面來的，比昨晚多一倍。" },
  { wave: 29, line: "小包搖了搖鈴鐺：「再兩聲就好。阿姨說燈亮著，天就會亮。」" },
  { wave: 30, line: "所有頻道靜默三秒——然後齊聲：「最後一波。北境在看著你們。」" },
] as const;

export const WEAPONS: readonly ShopItem<WeaponId>[] = [
  { id: "machete", name: "砍刀", description: "近距離單體揮砍 · 傷害 2", price: 0 },
  { id: "axe", name: "迴旋斧", description: "360° 橫掃 · 傷害 3", price: 120 },
  { id: "smg", name: "衝鋒槍", description: "遠程掃射 · 傷害 2×3", price: 360 },
] as const;

export const EMPLOYEES: readonly ShopItem<EmployeeId>[] = [
  { id: "hunter", name: "獵人", description: "Lv1 · 自動牧牛 · 1 傷／1.45s", price: 140, upgradePrice: 120, upgradeDescription: "攻速 1.10s · 移動更快" },
  { id: "cashier", name: "收銀員", description: "Lv1 · 快速結帳 · 每筆 +5", price: 190, upgradePrice: 150, upgradeDescription: "結帳 0.28s · 每筆 +8" },
  { id: "dog", name: "牧羊犬", description: "Lv1 · 自動拾肉回攤", price: 230, upgradePrice: 160, upgradeDescription: "優先鮮度 · 一次搬 2 份" },
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
  employeeUpgrade: 12,
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

export function towerCostForState(state: RuntimeState, id: TowerId, level: number): number {
  const listPrice = level === 0
    ? TOWERS.find((tower) => tower.id === id)!.price
    : towerUpgradeCost(id, level);
  return state.protagonistId === "mech_youth" ? Math.ceil(listPrice * 0.9) : listPrice;
}
