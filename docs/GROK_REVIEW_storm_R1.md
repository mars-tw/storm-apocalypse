# 《暴風啟示錄》對抗稽核報告 R1

| 項目 | 內容 |
|---|---|
| 對象 commit | `b616da9`（大擴充：15 章任務鏈／6 循環任務／武器鏈／員工×3／牧場 2／塔×3 Lv3／30 波／存檔 v1→v2） |
| 稽核角色 | 遊戲設計監工（只審不改） |
| 稽核日 | 2026-07-13 |
| 主要依據 | `src/game/content.ts`、`src/game/quests.ts`、`src/game/state.ts`、`src/game/StormGame.ts`、`src/game/ui.ts`、`docs/QUEST_DESIGN.md` |
| 方法 | 靜態數值抽取 + 閉式推導（波次 HP／DPS／營收曲線），**未**做真人長線通關實測 |

**總評（一句话）**：前段教學任務鏈合理，中段「累計營收 200」是唯一明顯節奏斷層；經濟幾乎不會破產死局，但中後期戰鬥獎金會碾壓肉品經濟（通脹偏寬鬆）；30 波在「三塔升級 + 玩家出力」下理論可過，在「單弩硬撐」下會在 Boss 波成為數值牆；存檔遷移以欄位補齊為主、邊界大致安全；循環任務可行性篩選有多處設計／實作落差與白嫖漏洞。

嚴重度標籤：`P0` 破壞體驗或可被利用的結構洞 · `P1` 明顯節奏／平衡問題 · `P2` 文件不一致或邊界瑕疵 · `OK` 通過。

---

## 0. 數值速查表（推導基準）

### 0.1 主線章節門檻與獎勵

來源：`content.ts:42-58`（`MAIN_QUESTS`）、`quests.ts:14-28`（結算邏輯）。

| 章 | 目標（程式） | target | 獎勵金 | 解鎖旗標 | 備註 |
|---:|---|---:|---:|---|---|
| 1 | `stats.pastureVisited` | 1 | 10 | — | 進入牧場距離判定 `StormGame.ts:758` |
| 2 | `stats.cowsKilled` | 1 | 20 | — | |
| 3 | `stats.meatCollected` | 3 | 0 | `stall-guide` | 解鎖旗標**無**商店硬閘 |
| 4 | `stats.meatDeposited` | 3 | 25 | — | |
| 5 | `stats.sales` | 1 | 30 | `defense-shop` | 同上，商店始終可見 `ui.ts:243-267` |
| 6 | `stats.totalEarned` | 200 | 50 | `employee-shop` | **僅肉品交易**計入，見 §2 |
| 7 | 員工人數 | 1 | 60 | — | `employeeCount`：`content.ts:39` |
| 8 | `pasture2Unlocked` | 1 | 0 | `strong-cattle` | 花費 260：`StormGame.ts:974-987` |
| 9 | 武器為 axe 或 smg | 1 | 75 | — | smg 須先 axe：`StormGame.ts:943-946` |
| 10 | 塔種類數 | 3 | 100 | `tower-upgrade` | 各建 ≥1，非等級和 |
| 11 | `state.wave` | 5 | 125 | — | 終身波次，可前置完成 |
| 12 | 員工人數 | 3 | 180 | `automation` | 三員工總價 560 |
| 13 | `state.wave` | 15 | 250 | `repair` | 結算時壁壘回 100：`quests.ts:23` |
| 14 | smg + 任一塔 Lv3 | 2 | 350 | `final-alert` | 二元計數加總：`content.ts:56` |
| 15 | `state.wave` | 30 | 0 | `north-watcher` | 破關徽記 |

累計任務賞金（Ch1→14，Ch15 為 0）：**1275**（由上表加總）。

### 0.2 經濟常數

| 項目 | 數值 | 檔案:行 |
|---|---|---|
| 開局資金 | 35 | `state.ts:87` |
| 肉價（無／有收銀員） | 20／25 | `StormGame.ts:893-896` |
| 普通牛 HP／產肉／重生 | 3／3／7s | `StormGame.ts:589-593,840` |
| 強化牛 HP／產肉／重生 | 9／6／12s | `StormGame.ts:1051-1053,840` |
| 牧場 2 | 260 | `StormGame.ts:976-980`；UI `ui.ts:261` |
| 武器 | 砍刀 0、迴旋斧 120、衝鋒槍 360 | `content.ts:10-14` |
| 員工 | 獵人 140、收銀 190、牧犬 230 | `content.ts:16-20` |
| 塔建造 | 弩 60、霜 110、砲 160 | `content.ts:22-26` |
| 塔升級公式 | `price + level * 70` | `content.ts:77-79` |
| 單塔 0→3 全滿 | 弩 390、霜 540、砲 690；三塔 1620 | 由公式推導 |
| 清波獎金 | `28 + wave*12 + (wave%10==0?120:0)` | `StormGame.ts:1396-1397` |
| 擊殺賞金 | walker 6／runner 8／brute 14／boss `100+wave*5` | `StormGame.ts:1277` |
| 波開始壁壘回復 | `min(100, baseHealth+12)` | `StormGame.ts:1195` |

### 0.3 波次與 DPS（閉式推導）

敵人數：`min(42, 4+ceil(wave*1.22)) + (wave%10==0?1:0)` — `StormGame.ts:1197-1198`  
基礎 HP：`3+floor(wave*0.72)`，倍率 boss×8／brute×2.35／runner×0.72 — `StormGame.ts:1265-1266`  
類型規則：`StormGame.ts:1256-1262`  
塔傷害／射速：`StormGame.ts:1300,1321`

| 波 | 敵數 | 總 HP（約） | 擊殺+清波金 | 理想 3 塔 Lv1 清場 | 3 塔 Lv3+SMG |
|---:|---:|---:|---:|---:|---:|
| 1 | 6 | 18 | 76 | ~2s | <1s |
| 5 | 11 | 60 | 160 | ~7s | ~2s |
| 10 | 18 | 277 | 554 | ~34s | ~7s |
| 15 | 23 | 347 | 390 | ~43s | ~9s |
| 20 | 30 | 727 | 826 | ~89s | ~18s |
| 25 | 35 | 877 | 612 | ~108s | ~22s |
| 30 | 42 | 1348 | 1092 | ~166s | ~33s |

理想 DPS 忽略彈道飛行、換靶、集火過殺與走位；實戰會明顯變慢。W1–30 戰鬥累計金幣約 **12920**（遠高於任務賞金與肉舖營收）。

玩家 DPS（單目標理論）：砍刀 ≈3.2、斧 ≈3.3（但可 AOE）、SMG ≈21.4 — 武器 CD／傷害見 `StormGame.ts:770-801`。

---

## 1. 任務鏈節奏（15 章）

### 1.1 曲線是否合理

| 區段 | 判定 | 說明 |
|---|---|---|
| Ch1–5 教學 | **OK** | 牧場→殺牛→拾肉→陳列→收銀，門檻低、獎勵小，符合「不打斷操作的教學」設計（`QUEST_DESIGN.md:5-6`）。 |
| Ch6 營收 200 | **P1** | 見 §1.2；約需 **10 筆**無收銀肉販（200÷20）。與前後章相比是最長的「純時間門檻」。 |
| Ch7–10 建設導向 | **OK（偏緊）** | 員工 140 → 牧場 260 → 斧 120 → 三塔 330，若**完全不打波**會吃力；但波次無章節硬鎖（只需任一塔，`StormGame.ts:1193`），可與經營交錯，整體可過。 |
| Ch11／13／15 波次 | **OK（可前置）** | 以 `state.wave` 終身值判定（`content.ts:53,55,57`）。先打波再推章會「瞬間完成」，屬文件已聲明的終身累計原則（`QUEST_DESIGN.md:31`）。 |
| Ch12 三員工 | **OK** | 總價 560，但 W1–10 戰鬥金已約 2000，資金足夠；卡的是「要不要買齊」而非賺不到。 |
| Ch14 終局武裝 | **OK** | SMG 360 + 單塔升满约 330（自 Lv1 弩），Ch13 獎 250 + 中後期波獎可負擔；且把戰力與 Ch15 對齊是正確節奏。 |

**金錢／時間門檻曲線（概念）**

```
教學(1-5) ──卡一下──> 營收200(6) ──建設坡(7-10)──> 波次檢查點(11)
                                              └─ 全自動(12) ─ 波15(13) ─ 武裝(14) ─ 波30(15)
```

中段「建設坡」斜率取決於玩家是否穿插夜襲；設計允許穿插，故**預設路徑合理**，純經營路徑偏磨。

### 1.2 卡關死點

| ID | 嚴重度 | 問題 | 依據 |
|---|---|---|---|
| Q-DEAD-6 | **P1** | **Ch6 是唯一明顯「賺得到錢但章節卡住」的點**：`totalEarned` **只**在顧客買肉時累加（`StormGame.ts:893-896`）。擊殺賞金與清波獎金只加 `money`（`StormGame.ts:1374,1396-1397`），**不加** `totalEarned`。玩家若先狂打波、錢破千，手冊仍可能停在 `50/200`，體感像壞掉。 | `content.ts:48`；`StormGame.ts:893-896` vs `1374` |
| Q-DEAD-8 | **P2** | Ch8 一次掏 260，若剛雇獵人（140）又三塔全建，現金會緊。但肉無限再生 + 可打波，**非死局**，屬節奏頓挫。 | `StormGame.ts:974-980`；`content.ts:16-26` |
| Q-DEAD-econ | **OK** | 不存在「錢歸零且無法再產金」的破產死局：牛免費重生、擊殺有賞金。 | `StormGame.ts:832-840,1374` |

**結論**：沒有「第 X 章要求的錢數學上賺不到」的硬死點；有「第 6 章指標與玩家直觀『有錢』脫鉤」的軟卡關。

### 1.3 跳章／連跳漏洞

| ID | 嚴重度 | 問題 | 依據 |
|---|---|---|---|
| Q-SKIP-SEQ | **OK** | 主線嚴格依 `state.quest.chapter` 單線前進，`while` 只結算**當前章**達標者（`quests.ts:16-25`）。無法在章號上跳過未完成章。 | `quests.ts:14-25` |
| Q-SKIP-LIFE | **P2（設計允許）** | 終身指標使 **Ch11／13／15 可在抵達該章當幀連跳**（甚至與 Ch14 同幀若 `wave>=30`）。`processQuests` 每幀呼叫（`StormGame.ts:721,1458-1462`），載入後亦呼叫（`StormGame.ts:274`）。舊檔高波次玩家重做前段後，波次章會「免費」。 | `content.ts:53,55,57`；`QUEST_DESIGN.md:31` |
| Q-SKIP-SOFTLOCK | **P1（產品）** | 幾乎所有 `rewardUnlock` **不硬鎖商店**（`ui.ts:243-267` 無讀 `quest.unlocks`）。玩家可在 Ch5 前建塔、Ch6 前雇人、Ch9 前買斧——任務變「事後認證」。文件稱此為相容舊檔的引導非硬鎖（`QUEST_DESIGN.md:32`），但會讓 15 章節奏被玩家打亂，**教學章可能被波次壓力蓋過**。 | `ui.ts:243-267`；`content.ts:45-56` |
| Q-SKIP-AXE | **OK** | SMG 強制先斧（`StormGame.ts:943-946`）；Ch9 接受 axe∥smg（`content.ts:51`），無跳過武器鏈。 | 同上 |
| Q-SKIP-14 | **OK** | Ch14 需 smg **與** 塔 Lv3 兩項（`content.ts:56`），無法只買槍或只升級就過。 | `content.ts:56` |
| Q-DOUBLE-REWARD | **P2** | 結算時 `money += rewardGold` **不**檢查是否已在 `completed` 內；`completed` 只防重覆 push（`quests.ts:18-19`）。正常遊玩章號單調遞增無雙領；**篡改存檔把 chapter 調回**可重領賞金。 | `quests.ts:18-22` |

### 1.4 與設計文件落差

| ID | 嚴重度 | 落差 |
|---|---|---|
| Q-DOC-UNLOCK | **P2** | 文件寫「解鎖防線商店／員工招募／塔升級」等（`QUEST_DESIGN.md:17-26`），程式僅寫入 `unlocks` 字串陣列（`quests.ts:20`），**UI／購買邏輯未消費**（除 `repair` 回血：`quests.ts:23`）。`stall-guide`、`defense-shop`、`employee-shop`、`tower-upgrade`、`automation`、`final-alert`、`north-watcher`、`strong-cattle` 皆無玩法閘門。 |
| Q-DOC-STALL | **P2** | `stallLevel` 存檔有 1–4（`state.ts:146`），容量 `stallLevel*6`（`StormGame.ts:861`），但**全專案無升級攤位路徑**——殘留欄位。 |

---

## 2. 經濟平衡

### 2.1 回收曲線（摘要）

| 投資 | 成本 | 回收機制 | 粗估回本期 |
|---|---:|---|---|
| 獵人 | 140 | 自動砍牛（1 傷／1.45s，`StormGame.ts:1158-1161`） | 約 7 份肉銷售（140÷20）；有犬後近似被動 |
| 收銀員 | 190 | 單筆 +5 且結帳 0.38s（`StormGame.ts:883,893`） | 慢：靠 +5 需 38 筆；真正價值是吞吐與 Ch12 |
| 牧羊犬 | 230 | 自動拾取並陳列（`StormGame.ts:1171-1184`） | 解放玩家跑圖；與獵人組成 AFK 鏈 |
| 牧場 2 | 260 | 6 肉／次、雙牧場平行 | 中期產能翻倍以上 |
| 斧 | 120 | 清小怪／多牛；任務 Ch9 | 戰鬥向，非經濟 ROI |
| SMG | 360 | ~21 DPS，終局剛需 | 戰鬥向 |
| 三塔 Lv1 | 330 | 波獎主來源 | **W1–5 戰鬥累計約 578 即回本有餘** |
| 三塔全滿 | 1620 | 高波存活 | 由 W1–20 戰鬥金 ~6336 支撐 |

### 2.2 中期通脹 — **P1**

戰鬥經濟遠大於肉舖：

| 來源 | 約略量級 |
|---|---|
| Ch6 要求之肉舖營收 | 200 |
| W1–10 戰鬥總金 | ~2000 |
| W1–30 戰鬥總金 | ~12920 |
| 任務賞金總和 | 1275 |
| 主線關鍵消費（三員工+牧場+斧+SMG+三塔Lv1+一塔升满） | ~1960 |

**判定**：過了第一座塔與數波夜襲後，金錢幾乎不再是稀缺資源；肉價 20、員工價位停留在「前中期規模」，相對波獎迅速貶值。結果：

1. **通脹偏寬鬆**：終局（Ch14 全裝）在正常打波下不會缺錢。  
2. **肉舖系統中後期動機只剩任務／習慣**，經濟意義塌縮。  
3. **不會破產死局**（見 §1.2），但「經營感」被塔防獎金架空。

### 2.3 潛在錯誤配置（非死，但是坑）

| ID | 嚴重度 | 說明 |
|---|---|---|
| E-TIP | **P2** | 文件寫收銀「增加 5 金小費」（`content.ts:18`），實作是 **底價 25 取代 20**（`StormGame.ts:893`），語意一致數值一致；但若玩家理解成「20+5=25 另計」則無問題。 |
| E-TOTAL | **P1** | `totalEarned` 命名／UI「累計營收」與實際「僅肉品營業額」不一致；波獎、擊殺、任務金、循環任務金皆排除。 | `StormGame.ts:896`；`quests.ts:19`；`content.ts:48` |
| E-WAVE-SHOP | **OK** | 夜襲中禁止購物（武器／員工／牧場／塔，`StormGame.ts:942,961,975,990-992`），避免波中爆裝，正確。 |

### 2.4 經濟結論

| 問題 | 判定 |
|---|---|
| 中期通脹 | **是（P1）** — 戰鬥金主導 |
| 破產死局 | **否（OK）** |
| 主線消費可負擔 | **是（OK）** — 前提：穿插打波 |
| 純肉舖養三塔+全員工 | **偏磨（P2）** — 設計未禁止但非預期主路徑 |

---

## 3. 30 波曲線 vs 玩家 DPS

### 3.1 成長對照

| 階段 | 預期戰力 | 波壓 | 判定 |
|---|---|---|---|
| W1–5 | 單弩 Lv1（~3.5 DPS）即可 | 總 HP ≤60，無 Boss | **OK**，教學波 |
| W6–10 | 建議第二、三塔；W10 Boss HP≈80 | 三塔 Lv1 理想 ~34s；單弩 Boss TTK 長但 eta 約 30s 仍勉強 | **OK偏緊** |
| W11–15 | 三塔 + 斧；Ch13 修牆 | 總 HP ~350 | **OK** |
| W16–20 | 需升級與玩家輸出；W20 總 HP ~727 | **單弩 Lv1 打 Boss TTK > 到牆時間 → 必漏**（見下） | **P1 數值牆（配置門檻）** |
| W21–30 | SMG + 多塔升級；W30 總 HP ~1348 | 3×Lv3+SMG 理想 ~33s；實戰加彈道／產怪約 19s 產完（`spawnTimer` `StormGame.ts:1217`）仍吃操作 | **P1：可過但非塔放置機** |

### 3.2 洩漏／破牆風險（推導）

- 路徑距離約 22 單位（刷怪 z≈20 → 店，`StormGame.ts:1255,1223`）。  
- Runner 速度 `(0.92+wave*0.025)*1.75`（`StormGame.ts:1267`）：W30 ≈2.9 u/s → **約 7.5s 到牆**。  
- Boss W30 HP = `round((3+21)*8)=192`；單弩 Lv1 DPS≈3.5 → TTK≈55s **>** 到牆 21s → **必進近戰**。  
- 進牆後：Boss 16 傷／1.15s + Brute 10／0.82s（`StormGame.ts:1233-1234,1276`）。1 Boss + 2 Brute 約 **38 壁壘 DPS**，**約 2.6s 融牆**。  
- 寒霜減速 `slowFactor=0.55`（`StormGame.ts:1226-1227`）對高波存活是結構性需求，不是錦上添花。  
- 每波開始 +12 壁壘（`StormGame.ts:1195`）緩和「殘血連戰」，但救不了同波內集火。

| ID | 嚴重度 | 結論 |
|---|---|---|
| W-SOLO-BALLISTA | **P1** | **30 波不是「隨便一座塔掛機就能過」**；W20+ Boss 對低配是數值牆。 |
| W-FULL-BUILD | **OK** | 三塔升級 + 寒霜控場 + SMG 補刀，理論總 DPS 與總 HP 匹配，**可守住**。 |
| W-CH14-ALIGN | **OK** | Ch14 強制 SMG+Lv3 再進入「正式」Ch15 敘事，與終局壓力對齊（但因軟鎖，玩家可未達成就嘗試高波）。 |
| W-COUNT-CAP | **OK** | 敵數 cap 42（`StormGame.ts:1197`）避免無限膨脹；HP 仍隨 `0.72*wave` 線性漲，終盤壓力主要來自 **HP 與速度** 而非數量失控。 |

### 3.3 「30 波守得住嗎？」直接答

- **滿配／接近滿配（三塔≥Lv2–3 + 霜控 + 玩家 SMG）**：**守得住**，屬操作與集火問題，不是無解公式牆。  
- **低配（單弩、無霜、無 SMG）**：**W20／W30 Boss 波會破**——這是配置門檻，不是隨機死。  
- **失敗懲罰**：進度保留（`StormGame.ts:1425`），壁壘不入存檔、重載回 100（`state.ts:198`），重試成本低 → 數值牆不會變成存檔廢檔。

---

## 4. 存檔遷移邊界（v1→v2）

### 4.1 機制概要

| 項目 | 實作 | 檔案:行 |
|---|---|---|
| 存檔鍵 | 仍為 `storm-apocalypse-save-v1` | `state.ts:2` |
| 版本欄 | 寫入 `SAVE_VERSION = 2` | `state.ts:1,143,210` |
| 遷移策略 | **無分版分支**；一律 `migrate()` 清洗＋預設補欄 | `state.ts:115-184` |
| v1 塔 | `towerBuilt:true` → `towers.ballista=1` | `state.ts:117,124,157` |
| 壞 JSON | catch 後 `migrate(DEFAULT_SAVE)` | `state.ts:191-192` |
| 寫入失敗 | 靜默（無痕模式） | `state.ts:231-233` |

與文件（`QUEST_DESIGN.md:62-66`）一致：**鍵名不變、version 欄升級、壞資料回退**。

### 4.2 邊界清單

| ID | 嚴重度 | 邊界 | 行為 | 風險 |
|---|---|---|---|---|
| S-WAVE | **OK** | `wave` | clamp 0–30（`state.ts:123`） | 過大波次不會壞邏輯 |
| S-CHAPTER | **OK** | `quest.chapter` | clamp 1–16（`state.ts:162`）；16 = 無主線（`quests.ts:10-12`） | 合法 |
| S-MONEY | **P2** | `money` | `finite` 下限 0、無合理上限（`state.ts:144`） | 篡改可無限金；正常遊玩無妨 |
| S-TOWER-LV | **OK** | 塔等 | 0–3（`state.ts:124,158-159`） | |
| S-WEAPON | **OK** | 未知武器 | 回退 machete（`state.ts:122`） | |
| S-LOOP | **OK** | loop 物件 | 缺 id 則 null；欄位 clamp（`state.ts:125-134`） | |
| S-COMPLETED | **P2** | `completed[]` | 映射 0–15 且 `filter(Boolean)` 去掉 0（`state.ts:135-137`） | 與 `chapter` **不強制一致**；不影響主線指標（以 chapter 為準） |
| S-UNLOCKS | **P2** | unlocks | 任意字串（`state.ts:138-140`） | 無白名單；目前也幾乎無消費端 |
| S-STATS-V1 | **OK／P2** | v1 無 stats | 狩獵／交易從 0（`state.ts:168-180`） | 舊玩家**必須重做 Ch1–6 經營**，但保留 money／wave／ballista — 符合文件；體感「有波次卻在教殺牛」略割裂（**P2**） |
| S-SESSION | **P1** | **未持久化** | `baseHealth`、`displayedMeat`、`carriedMeat`、`waveActive`、場上殭屍 | `loadState` 固定血 100、肉 0、非戰鬥（`state.ts:196-200`）。**中途重新整理 = 放棄當波、清空攤位存貨**。循環任務若 `loop.wave` 仍指向本波，下次 `assignLoopQuest` 會因同波號直接 return（`quests.ts:31`）而**保留進度**——與「波已中斷」並存，狀態敘事可能怪異。 |
| S-TOWERBUILT | **P2** | `towerBuilt` | 存檔時 **僅** `ballista>0`（`state.ts:214`） | 若只有霜／砲無弩，`towerBuilt` 假，但開波看的是「任一塔>0」（`StormGame.ts:1193`）。殘留欄位語意過時。 |
| S-VERSION-FIELD | **P2** | `raw.version` | **讀取時忽略**，不依 version 做差異遷移 | 未來 v3 若需破壞性轉換，現架構不夠用；v1→v2 靠補欄尚可 |
| S-REPAIR | **OK** | `repair` 解鎖 | 只在**當章結算當下**回血（`quests.ts:23`） | 重載本來就 100，無矛盾 |
| S-BESTWAVE | **OK** | bestWave | `max(best, wave)` 寫回（`state.ts:215`） | |

### 4.3 遷移結論

- **v1 核心進度（錢、波、舊塔）可載入** — 達標。  
- **最大實務風險**是「session 態不存」導致重載丟波／丟貨，而非欄位炸檔。  
- **沒有**依 `version` 的明確升級腳本；目前是「永遠 normalize」。對 R1 可接受，對後續版本是債。

---

## 5. 循環任務可行性篩選漏洞

來源：定義 `content.ts:68-75`；指派 `quests.ts:30-45`；進度 `quests.ts:51-63`；結算觸發 `StormGame.ts:1349-1355,1379-1383,1390-1391`。

### 5.1 篩選現況

| 任務 ID | `available` | 實際門檻 |
|---|---|---|
| `stock-safe` | 永遠 true | 波結束無丟貨 |
| `tower-kills` | `towerCount>0` | 塔擊殺數 |
| `player-kills` | 永遠 true | 玩家擊殺數 |
| `healthy-wall` | 永遠 true | 結束時壁壘 ≥75 |
| `frost-hits` | `towers.frost>0` | 寒霜命中次數 |
| `cannon-combo` | `towers.cannon>0` | 單次爆炸 ≥3 目標 |

指派：`available` 過濾後用 `(wave-1) % length` 輪替；若空則 fallback 第 0 項（`quests.ts:32-33`）。

目標：`min(quest.target(wave), id.includes("kills") ? 5+wave*2 : MAX)`（`quests.ts:34`）。

### 5.2 漏洞與落差

| ID | 嚴重度 | 問題 | 依據 |
|---|---|---|---|
| L-ENEMY-CAP | **P1** | 文件寫「不要求超過**實際敵人數**的擊殺」（`QUEST_DESIGN.md:50`），實作 cap 為 **`5+wave*2` 啟發式**，**從未讀取** `enemiesToSpawn`／敵數公式。目前數值下 `3+floor(w/3)` 與 `2+floor(w/5)` 仍低於敵數，**尚未構成硬不能完成**，但篩選與文件不符，日後改公式易踩雷。 | `quests.ts:34` vs `QUEST_DESIGN.md:50` |
| L-STOCK-FREE | **P1** | **`stock-safe` 在 W1–7 近乎白嫖**：brute 僅 `wave>=8`（`StormGame.ts:1258-1259`），boss 僅每 10 波；且僅 brute／boss 偷貨（`StormGame.ts:1236-1239`）。再者 **開波前把攤位賣空／搬空** → 整場不可能丟貨 → 穩吃獎勵。`available` 未檢查存貨或波段。 | `content.ts:69`；`StormGame.ts:1236-1239,1390` |
| L-WALL-FREE | **P2** | `healthy-wall` 在低波、滿血開波（+12 甚至封頂）時極易達成；無「本波曾受擊」等條件，常成免費金。 | `content.ts:72`；`StormGame.ts:1391,1195` |
| L-CANNON-DENSE | **P1** | `cannon-combo` 只檢查「有砲塔」，**不檢查**敵密度／波次。散開產怪（間隔 0.38–0.86s、x 偏移，`StormGame.ts:1254-1255,1217`）時，低波或殘局只剩 1–2 隻會**結構性失敗**。 | `content.ts:74`；`StormGame.ts:1353-1355` |
| L-FROST-OK | **OK** | frost 有塔才派；命中次數 `5+wave` 靠射速可堆，無明顯不可能。 | `content.ts:73`；`StormGame.ts:1347-1349` |
| L-ROTATE-SHIFT | **P2** | `available.length` 隨建塔變化，同一 `wave` 的 modulo 映射會變，輪替不穩定（非崩潰，但難預測）。 | `quests.ts:32-33` |
| L-REWARD-DOC | **P2** | 文件獎勵表（`QUEST_DESIGN.md:42-47`）與程式不一致：程式統一 `20 + wave * (kills?3:2)`（`quests.ts:40`），**無**文件的「親手 25 起、爆破 35 起」。 | `quests.ts:40` vs `QUEST_DESIGN.md:42-47` |
| L-CLAIM | **OK** | `completed`/`claimed` 防重領；同波 reload 不重派（`quests.ts:31,51-62`）。 | |
| L-WAVE-INDEX | **OK** | 進度要求 `loop.wave === state.wave+1`（`quests.ts:53`），與「進行中波號 = 已清空波數 +1」一致。 | `quests.ts:53`；`StormGame.ts:1196,1393` |

### 5.3 循環任務結論

可行性篩選**只做了「有沒有對應塔」**，沒有做：

1. 敵數 ≥ 擊殺目標（文件承諾未落地）；  
2. 砲擊 AOE 所需密度；  
3. 貨架任務的存貨／敵種前置；  
4. 壁壘任務的威脅度。

因此存在 **白嫖（stock-safe／早期 healthy-wall）** 與 **假可做（cannon-combo 低密）** 兩類漏洞。

---

## 6. 跨系統聯動問題（附加）

| ID | 嚴重度 | 說明 |
|---|---|---|
| X-PROCESS-EVERY-FRAME | **P2** | `processQuests` 每幀執行（`StormGame.ts:721`）。功能正確，但高幀下反覆 `find` 主線；非平衡 bug。 |
| X-DOG-QUEST | **OK** | 犬拾取同時加 `meatCollected` 與 `meatDeposited`（`StormGame.ts:1180-1181`），可推進 Ch3–4，符合自動化敘事。 |
| X-SMG-COW | **P2** | SMG 對殭屍 3×2 傷，對牛只呼叫一次 `damageCow(...,2)`（`StormGame.ts:778-784`），與「三連發」表現不完全一致。 |
| X-FAIL-KEEP | **OK** | 戰敗保留永久進度（`StormGame.ts:1425`），降低數值牆挫敗的存檔毀滅感。 |

---

## 7. 總表與優先級建議（只建議，本報告不改碼）

### 7.1 依嚴重度

| 優先 | ID | 主題 |
|---|---|---|
| P1 | Q-DEAD-6 / E-TOTAL | Ch6 `totalEarned` 與戰鬥金脫鉤，節奏最大斷層 |
| P1 | E 通脹 | 波獎碾壓肉價，中後期經營虛化 |
| P1 | W-SOLO-BALLISTA | 低配 20+ 波 Boss 數值牆（滿配可過） |
| P1 | L-STOCK-FREE | 循環「完整貨架」易白嫖 |
| P1 | L-CANNON-DENSE | 砲擊連擊未做密度／波次篩選 |
| P1 | L-ENEMY-CAP | 擊殺 cap 未按真實敵數 |
| P1 | S-SESSION | 重載丟波／丟貨／壁壘 session 態 |
| P1 | Q-SKIP-SOFTLOCK | 解鎖旗標不硬鎖，任務節奏可被打穿 |
| P2 | 文件／獎勵表不一致、stallLevel 死欄位、towerBuilt 語意、篡改重領等 | 見各節 |

### 7.2 設計問題（非實作 bug）一句話

1. **主線想教經營，經濟引擎卻是塔防獎金** → 敘事與數值中心不一致。  
2. **終身波次章 + 軟解鎖** → 老手／舊檔會「章節連跳＋內容已買齊」，15 章儀式感變弱。  
3. **30 波可過性取決於配置門檻**，門檻本身合理，但 UI 未把「霜控／升級／SMG」表達成硬需求（僅 Ch14 事後追認）。

### 7.3 通過項（R1 肯定）

- 15 章單線 `while` 結算清楚，無章號亂跳。  
- 武器鏈 axe→smg 硬限制正確。  
- Ch14 雙條件正確。  
- 夜襲中鎖商店正確。  
- v1 錢／波／舊塔遷移與壞檔回退可用。  
- 循環任務防重領、同波保留指派可用。  
- 戰敗保留進度，避免牆後廢檔。

---

## 8. 附錄：關鍵程式錨點

| 主題 | 位置 |
|---|---|
| 主線定義 | `src/game/content.ts:42-58` |
| 循環定義 | `src/game/content.ts:68-75` |
| 主線結算 | `src/game/quests.ts:14-28` |
| 循環指派／進度 | `src/game/quests.ts:30-63` |
| 存檔遷移 | `src/game/state.ts:1-2,115-184,186-206` |
| 肉價／totalEarned | `src/game/StormGame.ts:893-896` |
| 牧場 2 價格 | `src/game/StormGame.ts:974-987` |
| 開波／敵數 | `src/game/StormGame.ts:1192-1208` |
| 產怪類型與 HP | `src/game/StormGame.ts:1252-1286` |
| 塔 DPS 參數 | `src/game/StormGame.ts:1288-1325` |
| 清波獎 | `src/game/StormGame.ts:1389-1414` |
| 商店 UI 無解鎖閘 | `src/game/ui.ts:243-267` |
| 設計規格 | `docs/QUEST_DESIGN.md` |

---

*本報告為對抗稽核 R1，僅記錄問題與依據，不包含程式修改或數值重配方案實作。*
