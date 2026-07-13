# 《暴風啟示錄》全面健檢監工報告 R2

| 項目 | 內容 |
|---|---|
| 對象 commit | `276ae16`（R4：手機霧／效能／dt clamp／blob shadow／自動降解析） |
| 基準對照 | R3 `cf1e709`、R1 數值稽核 `docs/GROK_REVIEW_storm_R1.md`、R4 自述 `docs/CODEX_RESPONSE_storm_R4.md` |
| 稽核角色 | 遊戲技術／內容監工（**只審不改**） |
| 稽核日 | 2026-07-13 |
| 主要依據 | `src/game/StormGame.ts`、`input.ts`、`state.ts`、`ui.ts`、`content.ts`、`quests.ts`、`docs/ROADMAP.md` |
| 方法 | 靜態碼審 + 閉式推導（波次同屏數／dt 時間步／品質偵測分支）；**未**跑真機長壓與真人 30 波通關 |
| 範圍 | (1) R4 副作用 (2) 30 波後期 instancing 效能 (3) 內容缺口排序 (4) 下一輪最划算 3 步 |

**總評（一句話）**：R4 對「乳白霧＋低幀不能玩」的方向正確且可觀；但 **`detectQuality` 的 `cores <= 4` 會把大量桌機／筆電誤判成低檔**（連帶 blob shadow、無後製、且可能自動 0.65×），是目前最大的副作用。`dt` 上限 0.1 對戰鬥「精度」可接受、對「手感粒度」有輕微變粗，不像作弊或判定崩壞。30 波後期真正風險不在松樹 instance，而在 **每隻殭屍獨立 `instantiateActor`＋AnimationGroup、波中屍體延遲 dispose、箭矢／彈體無池化**。內容上 **音效仍是零**，體感缺口遠大於存檔匯出與成就。

嚴重度：`P0` 明顯誤傷／結構風險 · `P1` 中後期可感問題 · `P2` 打磨／文件漂移 · `OK` 通過。

---

## 0. R4 變更對照（審核錨點）

| 主題 | 實作位置 | R4 意圖 | 本輪判定 |
|---|---|---|---|
| 低檔霧／色調 | `StormGame.ts` ctor + `updateAtmosphere` | 深藍灰低密度霧，避免乳白一層 | **OK**（與 R4 取證敘述一致；靜態碼路徑清楚） |
| 零即時陰影 → blob | `addActorShadows` / `createBlobShadow` | 砍 shadow map 成本 | **OK**（有代價見 §1.2） |
| 渲染比 ≤1× + Tier 降檔 | ctor `renderPixelRatio` + `monitorMobilePerformance` | 持續 <28 FPS 降 0.8／0.65 | **P0/P1 視入口品質而定** |
| `dt` clamp 0.05→0.1 | `runRenderLoop` | 10–20 FPS 不再慢動作 | **OK 偏 P2**（精度影響小） |
| 輸入不綁 render | `input.ts` queue/held | 低幀不丟攻擊 | **OK**（R3 已奠基，R4 敘述正確） |
| GLB 併發 3／5 | `initialize` workers | 降啟動尖峰 | **OK** |
| HUD 低檔 10 Hz | `update` `uiUpdateTimer` | 降 DOM 成本 | **OK** |

Smoke／build 本輪**未重跑**；以 repo 現況與 R4 自述 `31/31`、`tsc` 零錯為參考，不重複背書真機 FPS。

---

## 1. R4 副作用深審

### 1.1 自動降檔：桌機會不會被誤降？

#### 1.1.1 入口品質 `detectQuality`（比 auto Tier 更關鍵）

```1945:1956:src/game/StormGame.ts
  private detectQuality(): "低" | "中" | "高" {
    if (this.smokeMode) return "低";
    const coarse = matchMedia("(pointer: coarse)").matches;
    const touch = navigator.maxTouchPoints > 0 || coarse;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    if (mobileUa || touch && window.innerWidth <= 1024 || memory <= 3 || cores <= 4) return "低";
    if (coarse || memory <= 6 || cores <= 6) return "中";
    return "高";
  }
```

運算子優先序實際為：

```text
mobileUa
  || (touch && innerWidth <= 1024)
  || memory <= 3
  || cores <= 4          ← 單獨即可強制「低」
```

| 案例 | 結果 | 嚴重度 | 說明 |
|---|---|---|---|
| 真手機／平板 UA | 低 | **OK** | 符合 R4 目標 |
| **桌機／筆電 `hardwareConcurrency ≤ 4`**（雙核 HT、舊 i5、不少輕薄筆電、部分迷你 PC） | **低** | **P0** | **不需 touch、不需小視窗**；直接吃完整低檔路徑 |
| 觸控筆電／Surface，`maxTouchPoints>0` 且視窗 ≤1024 | 低 | **P1** | 橫豎分割視窗、外接小螢幕常見 |
| `deviceMemory` 未實作（Firefox 等）→ fallback 4 | 不因 memory 進低 | **OK** | 但 cores 仍可能踩雷 |
| `hardwareConcurrency` 缺省 → `\|\| 4` | **低** | **P1** | 極端環境直接變低 |
| 6 核／6 GB 級 | 中 | **P2** | 合理偏保守 |
| 8 核+、memory>6、非 touch | 高 | **OK** | R4 桌機取證路徑 |

**結論：桌機「被誤降檔」不是理論邊緣，而是條件寫死後的高機率事件。**  
一旦被判「低」：

- 無 `ShadowGenerator`／Glow／Pipeline／FXAA／MSAA  
- 霧／曝光走手機曲線（視覺變「手機版」）  
- `renderPixelRatio ≤ 1`  
- **啟用** `monitorMobilePerformance` 的 0.8／0.65 自動降解析  
- 雪／營火粒子大幅削減、HUD 10 Hz  

R4 文件寫「桌機由真實偵測選高」——在**高核數桌機**成立；**不能推廣為所有桌機**。

#### 1.1.2 執行期 auto Tier（0.8×／0.65×）

```1923:1943:src/game/StormGame.ts
  private monitorMobilePerformance(): void {
    if (this.state.quality !== "低" || !this.started || document.hidden || this.performanceTier >= 2) return;
    ...
    if (fps >= 28) { this.lowFpsSamples = Math.max(0, this.lowFpsSamples - 1); return; }
    this.lowFpsSamples += 1;
    if (this.lowFpsSamples < 3) return;
    this.performanceTier += 1;
    this.renderPixelRatio = this.performanceTier === 1 ? 0.8 : 0.65;
    ...
  }
```

| 項目 | 判定 | 說明 |
|---|---|---|
| 僅 `quality==="低"` 才跑 | **OK** | 真·高／中桌機**不會**被這段降解析 |
| 連續 3 次、每 2s、FPS&lt;28 | **OK** | 約 6s 低幀才降一級；短暫卡頓不易誤觸 |
| **沒有回升** | **P1** | 一旦 Tier 2 鎖死 0.65×，FPS 回穩也不升；誤判桌機最痛 |
| 門檻 28 FPS vs 目標 30 | **P2** | 略嚴；合理偏保守 |
| 同步砍雪／營火 rate | **OK** | 成本正確；氛圍變稀是取捨 |
| 無玩家畫質覆寫 UI | **P1** | 誤判後玩家無法手動拉回「高」 |

**副作用摘要**

1. **P0**：`cores <= 4` → 桌機誤入低檔（比 auto Tier 本身更嚴重）。  
2. **P1**：誤入後可再被鎖 0.65× 且不可逆、無設定選項。  
3. **OK**：真·高檔桌機路徑與 R4 取證敘述相容。

---

### 1.2 Blob shadow 副作用

```1619:1652:src/game/StormGame.ts
  private addActorShadows(actor: Actor): void {
    if (!this.shadows) {
      this.createBlobShadow(actor.root);
      return;
    }
    ...
  }
  // 共用 StandardMaterial、12 邊 Disc、alpha 0.24、parent 在角色 root
```

| 項目 | 判定 | 說明 |
|---|---|---|
| 相對 512–2048 shadow map | **OK** | 正確的手機 P0 取捨 |
| 材質共用 | **OK** | 避免每隻一張 material |
| 每動態角色 +1 mesh／+1 draw（或 batch 視 driver） | **P2** | W30 滿場 ~40+ blob，仍遠低於 shadow pass |
| 半透明填色 | **P2** | 重疊角色時 overdraw；通常仍划算 |
| Boss／牛半徑放大、依 scale 反補償 y | **OK** | 邏輯自洽 |
| 靜態場景（松／屋／柵）低檔無投影 | **P2** | 「飄浮感」；可接受 |
| 中／高檔仍用即時陰影 | **OK** | 路徑分離清楚 |

**無戰鬥邏輯副作用**（不影響 hitbox、AI、存檔）。主要是視覺與少量透明 overdraw。

---

### 1.3 `dt` clamp 0.1 對戰鬥判定精度

```291:295:src/game/StormGame.ts
    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, this.smokeMode ? 0.5 : 0.1);
      this.update(dt);
      this.scene.render();
    });
```

#### 時間語意

| 實際 FPS | 每幀真實耗時 | 模擬 `dt` | 遊戲時間 vs 真實時間 |
|---:|---:|---:|---|
| ≥20 | ≤50ms | 不觸頂 | 1:1 |
| 15 | ~67ms | 0.067 | 1:1 |
| 10 | 100ms | **0.1（觸頂）** | 1:1（R4 目標：不再慢動作） |
| 5 | 200ms | **仍 0.1** | **遊戲只跑一半速**（殘留慢動作） |

R4 把 50ms→100ms 上限，修好 **10–20 FPS 被砍半** 的問題；**極低幀（&lt;10）仍會慢動作**——合理保險，避免單幀瞬移。

#### 與各系統的交互

| 系統 | 行為 | 精度／手感影響 | 判定 |
|---|---|---|---|
| 玩家近戰距離（砍 2.7／斧 3.5） | 每幀快照 `Distance`，非連續掃掠 | 最大步長 ≈ `4.15×0.1≈0.42` m；遠小於攻擊半徑，**幾乎不會「穿模漏砍」** | **OK** |
| SMG CD 0.28、held 每幀一次 | 低幀下每幀最多開一梭；節奏仍由 CD 用遊戲時間扣 | 10 FPS 時 CD 約 3 幀；DPS 與 60 FPS 同量級 | **OK** |
| 殭屍攻城 `attackTimer` | `-= dt`，觸發後重置 0.58–1.15 | 大 `dt` 可能略提早一幀結算，**不會同幀連打兩下** | **OK** |
| 塔 CD／彈道 `progress += dt*2.65` | 飛行約 0.38s | 落點仍在 `progress≥1`；量化略粗，無明顯穿透作弊 | **OK** |
| 移動／鏡頭 lerp `min(1, dt*k)` | 大 dt 單幀轉更多 | 低幀「頓一下轉到位」，非判定錯誤 | **P2** |
| 固定時間步／sub-step | **無** | 非決定論重播級精度；本專案不需要 | **P2** |
| `setTimeout` 特效（槍口 70ms、屍體 1700ms） | 真實時間，不受 `dt` clamp | 低幀時動畫與邏輯略脫鉤 | **P2** |

**結論：`dt` 0.1 不是戰鬥平衡炸彈。**  
- 對「能不能打中／會不會多算傷害」：**低風險**。  
- 對「10 FPS 是否跟得上手」：R4 選擇正確（寧可大步，不要全身慢動作）。  
- 殘留：**&lt;10 FPS 仍慢動作**；手感變「一幀一格」屬預期。

文件漂移：**R3 回報仍寫正式 build `dt` 上限 0.05**（`CODEX_RESPONSE_storm_R3.md`），已被 R4 覆寫——屬 **P2 文件不同步**。

---

## 2. 30 波後期 × Instancing 效能風險

### 2.1 同屏量級（閉式）

`tryStartWave`：

- 敵數：`min(42, 4 + ceil(wave×1.22))`，`wave%10==0` 再 +1 Boss  
- **W30**：`4+ceil(36.6)=41`，+Boss → **42**  
- 生成間隔（波中 `state.wave` 仍為 29）：`max(0.38, 0.86 - 29×0.014) ≈ 0.45s`  
- 清光前 dispose 延遲：死亡 1.7s 僅 `setEnabled(false)`，**整波結束後再 1.8s 才 `dispose`**

推導：生成總時間 ≈ 42×0.45 ≈ **19s**；行屍到店距離約 20+ m、W30 移速約 1.6–2.9 m/s → 行軍 **~8–15s**。  
→ **高峰同屏活屍可接近 30–42**，再加玩家／牛×1–2／員工×0–3／顧客／塔體／箭矢。

### 2.2「有 instance」≠「後期免費」

| 路徑 | API | 實際意義 | 後期風險 |
|---|---|---|---|
| 松樹 42、柵欄、小屋件、塔身 | `instantiateStatic` → `instantiateModelsToScene` | 靜態幾何共享（ROADMAP 所稱硬體實例） | **低**（固定成本，波次不增） |
| 殭屍／玩家／牛／員工 | `instantiateActor(..., { doNotInstantiate: false })` | 幾何可 instance，但 **每隻獨立 AnimationGroup／骨架更新** | **高（隨波次線性）** |
| 弩箭 | 每次開火 `instantiateStatic("tower/arrow.glb")` | **無物件池** | **中高**（三塔 Lv3 長線射擊） |
| 霜／砲彈 | 每次 `CreateIcoSphere` + **新 PBRMaterial** | 材質／mesh 分配尖峰 | **中** |
| 死亡屍 | 波中保留 disabled mesh + anim | 波末才批次 dispose | **中**（峰值記憶體／節點數） |
| 低檔 blob | 每角色一 disc | 隨活屍數增加 | **低–中** |
| 雪粒子 | 低 220／中 900／高 1700 | 與波次無關；Tier 再砍 rate | **低**（已被 R4 控） |
| 陰影 | 中 1024／高 2048 PCF；低關閉 | 高檔桌機 W30 仍付 shadow casters×屍數 | **中（高檔）** |

Debug 旗標 `hardwareInstancing: true` 是**宣告式**，不能解讀為「已做 GPU thin-instance crowd」。

### 2.3 風險排序（30 波夜襲）

| ID | 嚴重度 | 風險 | 證據／機制 |
|---|---|---|---|
| PERF-ZOMBIE-SKEL | **P1** | 每屍完整 actor instance + 多段動畫切換（Walk／Hit／Death／Attack） | `spawnZombie` → `instantiateActor`；ROADMAP 仍寫需 crowd／共享骨架 |
| PERF-PROJ-ALLOC | **P1** | 箭矢／彈體每發新建、霜砲每發新 material | `updateTowers` 1387–1398 |
| PERF-CORPSE-HOLD | **P2→P1 長線** | 波中尸体不從 scene 釋放，只 disable | `killZombie` 1471；`completeWave` 1487–1493 |
| PERF-AI-O(n) | **P2** | 每幀每塔 `findNearestZombie`、玩家索敵、斧範圍 filter；n≈40 可接受 | 線性掃描，暫非主因 |
| PERF-SHADOW-HI | **P2** | 高檔每屍 shadow caster | 僅非低檔 |
| PERF-STATIC-OK | **OK** | 松／屋／柵固定 instance 池 | 非 30 波瓶頸 |

**與 R4 關係**：R4 大幅降低**手機固定成本**（陰影／後製／解析／粒子），但**幾乎沒碰波次縮放成本**。真機若在 W1–10 順、W25–30 崩，應優先查殭屍／彈體，而非再砍霧。

### 2.4 粗估（量級，非 benchmark）

假設每殭屍 1 skeleton + 數 mesh instance + 數 AnimationGroup：

- W5：~11 活屍 → 多數手機可撐（R4 後）  
- W20：~30  
- W30：~42 活屍 + 彈幕 +（低檔）42 blob  

若無 pool／共享骨架，**CPU 動畫與 draw 隨 n 近線性**；R4 的 0.65× 只能救 fill-rate，**救不了 40 具骨架 update**。

---

## 3. 內容缺口排序

現況掃描：

| 缺口 | 現況 | 玩家可感度 | 實作成本 | 優先序 |
|---|---|---|---|---|
| **音效** | `public/audio/` **空**；`src` **無** Sound／AudioEngine／mp3／ogg 引用；ROADMAP「美術與聲音」仍待做 | **極高**（靜音動作遊戲＝演示感） | 中（MVP 8–15 個 one-shot + 1 環境 loop 即可） | **#1** |
| **存檔匯出／匯入** | 僅 `localStorage` `storm-apocalypse-save-v1`；有 `resetSave`；**無** JSON 下載／貼上／雲 | 中（換機、清資料、debug、社群存檔） | **低**（schema 已是純 JSON `SaveState`） | **#2** |
| **成就** | 僅有任務 unlock 字串（如 `north-watcher`）、`campaignWins`／lifetime stats；**無**成就面板／通知／常駐收集冊 | 中低（破關已有結算文案；缺「收集慾」與再玩鉤子） | 中（資料易、UI／條件／持久化要一輪） | **#3** |

### 3.1 音效（#1，理由）

- 武器三種、塔三種、牛／屍／買賣／UI toast **全無聽覺回饋**。  
- R3/R4 大量投資手感與效能，但 **「砍中／清波／破關」仍像默片**。  
- 與 Babylon 整合成本可控；不必等完整 Foley 管線。  
- ROADMAP 已列為已知缺口；**體感 ROI 最高**。

建議 MVP 分層（供下輪估點，非本輪實作）：

1. UI：按鈕、購物成功、任務完成、波次警報  
2. 戰鬥：近戰揮擊／命中、SMG、屍死亡、壁壘受擊  
3. 世界：低音量風雪 loop、營火（可後做）

### 3.2 存檔匯出（#2）

- `saveState` 已序列化完整進度（金錢、波次、塔、任務、stats）。  
- 缺：匯出檔、匯入校驗（可重用 `migrate`）、失敗提示。  
- 對「長線 30 波 + 本機 only」是**風險對沖**（瀏覽器清站資料＝全毀）。  
- 比成就更接近「保護玩家時間」。

### 3.3 成就（#3）

- 任務鏈 15 章 + 循環委託 **已覆蓋主進度敘事**。  
- 成就較適合第二曲線：速通、零傷 Boss、純塔清場、累計擊殺里程碑等。  
- 在音效與存檔安全之前，成就較像「錦上添花」。

### 3.4 其他仍存在的內容／系統缺口（次於上表，供排程）

| 項目 | 備註 |
|---|---|
| 畫質手動切換 | 與 §1.1 誤判直接相關，屬**設定**而非敘事內容 |
| 塔出售／移位、正式 navmesh | ROADMAP 已列 |
| PWA／離線 | 有 local save 但無 install 殼 |
| 經濟／節奏（R1：Ch6 營收門檻、後期戰鬥金通脹） | R2 未重跑數值表；R1 結論多半仍成立 |
| 循環任務白嫖／篩選落差 | 見 R1；本輪未複驗每一條 `available` |

---

## 4. 下一輪最划算 3 步

依 **玩家可感提升 ÷ 工程風險／工時**，建議嚴格只做這三步（由高到低）：

### 步驟 A — 修正品質入口 + 手動覆寫（半日級）

**為什麼最划算**：一條 `cores <= 4` 可能讓 R4 的「桌機高檔取證」在真實玩家機器上失效；修偵測比再砍特效更能保護桌機體驗。

建議方向（設計層，不實作）：

1. **拿掉或放寬**「僅 cores≤4 → 低」；改為 `(mobileUa || 小屏 touch) && (cores≤4 || memory≤4)` 這類**行動裝置交集**。  
2. 設定列：`低／中／高／自動`，寫入 `localStorage`。  
3. Auto Tier：**允許 FPS 穩定後回升一級**，或至少在選單顯示「效能降級中」。

驗收：4 核筆電預設不應再無條件進低檔；手機 UA 仍進低檔。

### 步驟 B — 音效 MVP（1–2 日級）

**為什麼**：內容缺口 #1；不碰數值平衡、不重構 30 波，卻立刻改變「成品感」。

範圍控制：

- 10 個以內短音效 + 可靜音開關（設定一併做可與 A 同屏）。  
- 先 UI／命中／死亡／警報；環境 bed 可第二迭代。  
- 注意瀏覽器 autoplay policy：首次點「踏入暴風」後解鎖 AudioContext。

### 步驟 C — 後期單位成本止血（1–2 日級，對準 W25–30）

**為什麼**：R4 已挖掉固定成本；下一單位效能投資應打在**隨波次成長**的曲線。

最小有效集合（擇優，不必一次做完）：

1. **殭屍／箭矢物件池**（波前 prewarm 或死亡回收），禁止每發 `new Material`。  
2. 死亡後較快 `dispose` 或回收進池（不必等整波結束）。  
3. （可選）限制同屏活屍軟上限／生成節奏，或 HitReact 降頻。  

完整 crowd／共享骨架屬更大工程，可排在 C 之後若壓力測試仍不過。

**刻意不放進「最划算 3 步」**：成就系統、塔移位、PWA——ROI 較後。  
**存檔匯出**若步驟 A/B 有餘力，可作 **B′ 半日附帶**（JSON download／file input + `migrate`），成本極低。

---

## 5. 總表與建議決策

| ID | 嚴重度 | 主題 | 一句話 |
|---|---|---|---|
| Q-DETECT-CORES | **P0** | 品質偵測 | `cores<=4` 誤傷桌機／筆電進完整低檔 |
| Q-NO-OVERRIDE | **P1** | 設定 | 無法手動拉回畫質；Tier 只降不升 |
| DT-0.1 | **OK／P2** | 時間步 | 戰鬥精度安全；&lt;10FPS 仍慢動作；手感略粗 |
| BLOB-SHADOW | **OK／P2** | 陰影 | 正確取捨；滿場透明 disc 可接受 |
| PERF-LATE-WAVE | **P1** | W30 | 骨架屍×40 + 無池彈體，R4 未解 |
| CONTENT-SFX | **P1**（產品） | 音效 | 完全缺失，體感最大洞 |
| CONTENT-SAVE-IO | **P2** | 存檔 | 匯出匯入便宜且保護長線進度 |
| CONTENT-ACH | **P2** | 成就 | 可後做；任務鏈已覆蓋主進度 |

**監工結論**

- R4 **值得肯定**：霧色、低檔關陰影／後製、解析階梯、輸入與 dt 補償形成完整「能玩」閉環。  
- 上線／下一輪前，**先修品質誤判**，否則桌機玩家會「被當成手機」且無法自救。  
- 內容投資順序：**音效 → 存檔匯出 → 成就**；工程並行可插 **後期 pool**。  
- 本報告**只審不改**；未改任何原始碼、未 commit、未跑破壞性操作。

---

## 6. 附：關鍵碼錨點（方便 Codex／實作方）

| 主題 | 檔案:區域 |
|---|---|
| dt clamp | `StormGame.ts` ~L291–295 |
| 品質偵測 | `StormGame.ts` ~L1945–1956 |
| 自動降解析 | `StormGame.ts` ~L1923–1943 |
| blob shadow | `StormGame.ts` ~L1619–1652 |
| 生成／攻城／清波 dispose | `StormGame.ts` ~L1271–1494 |
| 塔彈無池 | `StormGame.ts` ~L1373–1444 |
| actor instance | `StormGame.ts` ~L1581–1598 |
| 存檔 | `state.ts` `loadState`／`saveState`／`migrate` |
| 輸入 held／queue | `input.ts` 全文 |
| 音效 | **不存在**（`public/audio/` 空） |

— 監工結束（R2）—
