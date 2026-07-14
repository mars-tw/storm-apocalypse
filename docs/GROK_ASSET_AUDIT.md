# 《暴風啟示錄》3D 素材品質監工報告

| 欄位 | 內容 |
|---|---|
| 文件狀態 | **只審不改（Audit Only）** — 本輪未修改 `public/models/`、`tools/blender/`、`src/` |
| 審核日期 | 2026-07-14 |
| 審核範圍 | 執行期實際載入的 GLB + 文件／截圖可驗證之混搭現況；含 runtime `MeshBuilder` 程序幾何 |
| 量測方式 | 檔案大小盤點、`Blender 5.1` `inspect_animated_assets.py` 回匯 tris／骨架／clip、`CREDITS.md` 來源對照、既有 showcase／R2 截圖目視 |
| 關聯文件 | `CREDITS.md`、`docs/DESIGN_characters.md`、`docs/CODEX_RESPONSE_blender_R1.md`、`docs/CODEX_RESPONSE_blender_R2.md`、`docs/CODEX_RESPONSE_characters.md` |

---

## 1. 一句話結論

本專案已形成 **三層畫風疊加**：

1. **Quaternius CC0**（牛／殭屍／員工原模）：高骨數、有蒙皮、動畫齊全、有機輪廓
2. **本專案 bpy 原創**（塔／攤位／主角／Boss／常客）：純色 PBR、flat shading、剛性分件或 18 骨、無貼圖
3. **Kenney CC0**（松樹／柵欄／雪屋模組）：極簡塊體 + 部分 colormap 貼圖

在 **可讀性與可玩性** 上已達 Alpha 可用；在 **第一印象與風格統一** 上，最大問題不是「整體太醜」，而是 **品質層級顛倒**：場邊的牛與員工比玩家主角更「像成品」，Boss 與具名常客又比雜兵／匿名顧客更「像草稿」。重繪應優先 **對齊中場焦點角色與高潮敵人**，而不是先刷背景樹石。

---

## 2. 資產盤點（現況）

### 2.1 來源矩陣

| 類別 | 路徑／實例 | 來源 | 生成方式 | 執行期角色 |
|---|---|---|---|---|
| 三主角 | `custom/characters/protagonist-*.glb` | 本專案 | **bpy** R2 | 玩家本體；18 骨 + 4 clip |
| 四常客 | `custom/characters/npc-*.glb` | 本專案 | **bpy** 靜態包 | 具名顧客；**無動畫** |
| 三塔 | `custom/tower-*.glb` | 本專案 | **bpy** R2 | 防禦塔；物件 `attack` |
| 肉舖／收銀台／狗屋／肉片／金幣 | `custom/*.glb` | 本專案 | **bpy** R1 | 場景焦點建築與掉落物 |
| Boss 殭屍 | `custom/boss-zombie.glb` | 本專案 | **bpy** R1 靜態 | 第 10 波倍數 Boss；**無骨架／無 clip** |
| 牛 | `cow.glb` | Quaternius CC0 | **CC0** 轉 GLB | 牧場資源；完整 AnimalArmature |
| 一般殭屍 | `zombie.glb` | Quaternius CC0 | **CC0** | 夜襲雜兵；Walk／Attack／Death 等 |
| 獵人／收銀員 | `survivor.glb` / `customer.glb` | Quaternius CC0 | **CC0** | 員工；Idle／Run／Slash 等 |
| 匿名顧客 | `customer.glb` | Quaternius CC0 | **CC0** | 顧客流底模 |
| 自然／牧場 | `pine-*`、`rock`、`fence*`、`campfire-stones` | Kenney Nature Kit CC0 | **CC0** | 背景與圍欄 |
| 雪屋 | `holiday/cabin-*`、`lantern` | Kenney Holiday Kit CC0 | **CC0** + colormap | 肉舖後方房屋 |
| 箭矢 | `tower/arrow.glb` | Kenney TD Kit CC0 | **CC0** | 弩塔投射物 |
| 舊塔身／武器 | `tower/tower-body.glb`、`tower-weapon.glb` | Kenney | **CC0** | **遊戲已不載入**（死資產） |
| 牧羊犬 | runtime `createProceduralDog()` | 本專案 | **bpy 無檔**（Babylon `MeshBuilder`） | 員工；無動畫 |
| 強化牛角／項圈 | runtime 附掛在 `cow.glb` | 本專案 | **MeshBuilder** | 牧場 2 強化牛 |
| 砍刀／斧／SMG | runtime 武器 socket | 本專案 | **MeshBuilder** | 玩家武器；屠夫刀除外（GLB 內建） |

`public/models/` 合計約 **37 GLB／5.74 MiB**，仍低於專案既有體積預算；**品質瓶頸在風格與動畫契約，不在容量**。

### 2.2 關鍵量測（Blender 回匯）

| 資產 | Tris | 骨架 | Clips（節錄） | Bytes（約） | 風格層 |
|---:|---:|---:|---|---:|---|
| `survivor.glb` | **9,458** | 43 | Idle／Run／Slash… | 875 KB | Quaternius |
| `customer.glb` | **9,001** | 43 | Idle／Walk… | 947 KB | Quaternius |
| `zombie.glb` | **7,902** | 50 | Walk／Idle_Attack／Death… | 831 KB | Quaternius |
| `cow.glb` | **2,530** | 42 | Eating／Walk／Death… | 1.86 MB | Quaternius |
| `protagonist-vet-sniper.glb` | 956 | 18 | idle／run／attack_* | 153 KB | bpy R2 |
| `tower-cannon.glb` | 984 | 0（物件） | attack | 98 KB | bpy R2 |
| `tower-ballista.glb` | 896 | 0 | attack | 92 KB | bpy R2 |
| `protagonist-mech-youth.glb` | 864 | 18 | idle／run／attack_* | 148 KB | bpy R2 |
| `protagonist-butcher-matron.glb` | 850 | 18 | idle／run／attack_* | 142 KB | bpy R2 |
| `butcher-stall.glb` | 768 | 0 | — | 87 KB | bpy R1 |
| `tower-frost.glb` | 536 | 0 | attack | 62 KB | bpy R2 |
| `boss-zombie.glb` | **464** | **0** | **無** | 53 KB | bpy R1 |
| `doghouse.glb` | 328 | 0 | — | 40 KB | bpy R1 |
| `npc-lao-zhou.glb` | **300** | **0** | **無** | 35 KB | bpy 靜態 |
| `cash-register.glb` | 292 | 0 | — | 34 KB | bpy R1 |
| `pine-a.glb` | 230 | 0 | — | 17 KB | Kenney |
| `cabin-wall.glb` | 84 | 0 | — | 8 KB | Kenney |

**解讀**

- 雜兵殭屍 tris ≈ 玩家主角 **9×**；員工原模 ≈ 主角 **10×**。
- Boss（高潮）tris **低於**一般殭屍 **17×**，且 **無任何動畫**。
- 具名常客為靜態分件；匿名顧客卻有完整 Walk／Idle——**敘事上更重要的臉反而更假**。
- 牛仍是場上「最像有生命」的有機體，會壓過塔與主角的低模剪影。

### 2.3 目視證據（既有截圖）

| 觀察 | 來源 |
|---|---|
| 主角為無五官／極簡頭＋配色配件；選角卡可辨人設但「玩具感」強 | `docs/screenshots/blender-r2/hero-selection-r2.png` |
| 牛體輪廓圓滑、陰影連續；主角與攤位為硬邊純色塊 | `docs/screenshots/blender-r1-showcase.png`、R2 進場截圖 |
| 雪屋為 Kenney 雪頂模組；攤位為暖木＋紅白棚，接縫可接受但材質語言不同 | 同上 |
| 夜襲下塔 emissive 可讀；遠距殭屍為綠色有機剪影，Boss 未在同框驗證動畫 | `docs/screenshots/blender-r1-night.png` |

---

## 3. 品質短板排序（嚴重度 ↓）

評分維度：`視線佔比 × 敘事重要性 × 風格落差 × 動畫契約缺口`。

| 排名 | 短板 | 嚴重度 | 現象 | 根因 |
|---:|---|---|---|---|
| 1 | **角色品質階層顛倒** | ★★★★★ | 玩家／常客 bpy 低於員工／牛／雜兵 CC0 | 品牌資產用 bpy 省成本；CC0 直接吃滿動畫包 |
| 2 | **Boss 靜態 vs 雜兵全動** | ★★★★★ | 高潮敵人 464 tris、0 clip；雜兵 7.9k + 16 clip | R1 只交輪廓，未接 R2 骨架產線 |
| 3 | **具名常客無 locomotion** | ★★★★☆ | 老周等靜態；匿名顧客 Walk／Idle | 角色包只出靜態 GLB |
| 4 | **員工視覺非本店 IP** | ★★★★☆ | 獵人＝`survivor`、收銀＝`customer`（Quaternius 槍械末日裝） | 未做員工專屬 bpy／未重塗裝 |
| 5 | **牧羊犬 runtime 積木** | ★★★☆☆ | Capsule＋IcoSphere 拼狗，無 clip | CREDITS 明列程序幾何 |
| 6 | **武器 runtime 積木** | ★★★☆☆ | 斧／SMG／砍刀（非屠夫刀）為 Box／Cylinder | 未進 GLB 產線 |
| 7 | **強化牛角／項圈混接** | ★★☆☆☆ | CC0 牛 + MeshBuilder 角與發光環 | 變體未進 bpy |
| 8 | **建築材質語言分裂** | ★★☆☆☆ | 攤位純色 vs 雪屋 colormap | Kenney 貼圖路徑 vs bpy 無貼圖策略 |
| 9 | **塔／攤位細節停在 R1–R2 可讀線** | ★★☆☆☆ | 剪影 OK，近距偏空 | 刻意壓 tris；可選升級 |
| 10 | **死資產與未修剪動畫** | ★☆☆☆☆ | `tower/tower-*` 未載入；cow／zombie 帶大量未用 clip | 轉檔未裁剪；非畫面直接問題 |

### 3.1 風格風險矩陣

| | 純色 flat bpy | Quaternius 有機蒙皮 | Kenney 塊體±colormap |
|---|---|---|---|
| **優** | 可重跑、品牌可控、體積小 | 動畫可信、生命感強 | 便宜填景、風格穩定 |
| **劣** | 近距空洞、臉部弱 | 與 bpy 並排顯「過精」或「別遊戲」 | 與 bpy 暖木攤位接縫跳色 |
| **建議定位** | **主角／塔／攤／Boss／員工／犬** 的正式標準 | 過渡填充；重繪時可 **降級使用或淘汰** | 遠景／圍欄可留；核心 thruput 區逐步 bpy 化 |

**監工立場**：不要把 Quaternius 拉高到「全場標準」再全面重畫——體積與產線會爆。應把 **bpy 低模＋明確剪影＋剛性／18 骨動畫** 定為品牌線，並把仍佔畫面中心的 CC0 角色 **往這條線收斂**（重做或大幅降階／重著色）。

---

## 4. P0–P2 重繪優先清單與規格

> 生成方式欄：`bpy` = `tools/blender/*.py` 可重跑原創；`CC0` = 第三方授權素材（可原包／改著色／僅當參考）；`runtime` = 現況 Babylon 程序幾何（重繪後應消失或僅留特效）。

### 4.1 P0 — 必須先修（中心鏡頭／高潮／身份）

#### P0-1 三主角 R3「可讀人臉＋材質層次」升級

| 欄位 | 規格 |
|---|---|
| 現況 | 850–956 tris；18 骨；4 clip；頭為 ico 無五官；選角靠配件色塊 |
| 問題 | 第一印象最弱；被牛／員工壓過 |
| 生成方式 | **bpy**（延續 `hero_rig_factory.py`／`build_animation_r2.py`） |
| 不做 | 不上高模貼圖、不改被動數值、不換骨架命名契約 |
| 目標 tris | **≤ 1,200**／人（與 R2 契約對齊，可吃滿預算） |
| 骨架／clip | 維持同構 18 骨；`idle`／`run`／`attack_melee`／`attack_ranged` 幀範圍可微調不可改名 |
| 造型 | 依 `DESIGN_characters.md`：圍裙秤錘／軍綠單眼護目／橙框護目工具帶；**補：眉稜、鼻樑、下顎剪影、手掌分指可選（4–6 面）** |
| 材質 | 純色 Principled 為主；允許 **2–4 階色塊**（陰影色／污漬色／金屬）仍無外部貼圖 |
| 驗收 | 選角卡 3 秒可辨身份；遊戲 12–18m 鏡頭下與牛並排時「仍像主角」；smoke 四 clip 契約全綠 |
| 輸出 | `public/models/custom/characters/protagonist-*.glb` + 選角 PNG 重烘 |

#### P0-2 Boss 殭屍「可動高潮體」

| 欄位 | 規格 |
|---|---|
| 現況 | 464 tris、0 骨、0 clip；靠縮放當 Boss |
| 問題 | 雜兵會走會打會倒，Boss 像雕像滑行 |
| 生成方式 | **bpy**（新建 `boss_zombie_r2.py` 或擴充 `boss_zombie.py`；可共用簡化 14–18 骨，**不必**與主角同構） |
| 替代方案（較低優先） | **CC0** 改裝重型殭屍 + 重著色（若堅持 bpy 品牌線則不採） |
| 目標 tris | **800–1,600**（可比雜兵低，但剪影與裝甲可讀） |
| Clips | 最少 `walk`／`attack`／`hit`／`death`（名稱對齊 `StormGame` 現用或同步改 runtime 映射） |
| 造型 | 維持裝甲板、鏽斑、肩刺、ember 眼；體型 ≥ 一般殭屍 1.4× 世界尺度 |
| 驗收 | 第 10 波 Boss 進場有 walk、命中有 hit／death；遠距剪影可與雜兵區分 |
| 輸出 | 覆寫 `custom/boss-zombie.glb` |

#### P0-3 具名四常客 locomotion 對齊

| 欄位 | 規格 |
|---|---|
| 現況 | 300–370 tris 靜態；匿名顧客用 `customer.glb` 有 Walk／Idle |
| 問題 | 越重要的臉越假 |
| 生成方式 | **bpy**（`character_factory` + 輕量 12–18 骨或物件 root 搖擺 + 腿循環） |
| 目標 tris | **≤ 600**／人 |
| Clips | 最少 `idle`、`walk`（可選 `wave` 結帳） |
| 造型 | 維持老周／林護理／小包／何偵察既有色票與道具 |
| 驗收 | 進場走位不再「溜冰」；與匿名顧客切換時風格同屬 bpy 線 |
| 輸出 | 覆寫 `custom/characters/npc-*.glb` |

#### P0-4 員工專屬模型（獵人／收銀員）

| 欄位 | 規格 |
|---|---|
| 現況 | `survivor.glb`／`customer.glb`（Quaternius，≈9k tris，槍械末日裝） |
| 問題 | 視覺上像外來 demo 角色，與肉舖 IP 衝突 |
| 生成方式 | **bpy** 首選；過渡期可用 **CC0 重著色**（僅當排期不夠） |
| 目標 tris | **≤ 900**／人；骨架 18 骨或與主角同構以便共享 clip |
| Clips | 獵人：`idle`／`run`／`slash`；收銀：`idle`／`walk`（可共用常客） |
| 造型 | 獵人＝防寒斗篷＋簡易刀；收銀＝圍裙＋錢袋／算盤意象；**避免現代突擊步槍剪影** |
| 驗收 | 雇用後不再誤認「玩家用舊主角模」；體積合計不因 2×9k 員工爆表 |
| 輸出 | 新建 `custom/characters/staff-hunter.glb`、`staff-cashier.glb`（runtime 路徑一併換——**實作階段**） |

> **P0 不建議**：整包替換所有 Kenney 樹石、重做牛。牛是經濟迴圈核心且動畫成本高；應在 P1 做「風格降噪」而非全面重建模。

---

### 4.2 P1 — 中期對齊（員工生態／武器／敵人主題）

#### P1-1 牧羊犬正式 GLB

| 欄位 | 規格 |
|---|---|
| 現況 | runtime Capsule 狗；無動畫 |
| 生成方式 | **bpy** 首選（與狗屋同色票）；或 **CC0** 小動物包低模犬 + 重著色 |
| 目標 tris | **≤ 500**；clips：`idle`／`run`（可選 `carry` 口叼肉示意） |
| 輸出 | `custom/characters/staff-dog.glb`；移除 `createProceduralDog` 網格 |

#### P1-2 武器包（砍刀／迴旋斧／SMG）

| 欄位 | 規格 |
|---|---|
| 現況 | `MeshBuilder` 積木；屠夫刀除外 |
| 生成方式 | **bpy**；綁 `WeaponSocket` |
| 目標 tris | 每把 **≤ 120**；金屬／木柄純色；斧可讀刃面、SMG 可讀彈匣 |
| 輸出 | `custom/weapons/{machete,axe,smg}.glb` |

#### P1-3 一般殭屍「暴風化」

| 欄位 | 規格 |
|---|---|
| 現況 | Quaternius 綠皮經典僵；動畫優秀但主題偏通用 |
| 生成方式 | **方案 A（省）CC0**：保留網格／骨架，**只換材質色票**（凍傷灰藍、破布褐）；**方案 B（一貫）bpy**：swarm LOD **≤ 600 tris** + walk／attack／death |
| 建議 | Alpha→Beta 用 A；若 P0 全轉 bpy 線再上 B |
| 驗收 | 與 Boss、雪地夜色同色溫；遠距仍可辨「敵」 |

#### P1-4 強化牛配件正式化

| 欄位 | 規格 |
|---|---|
| 現況 | 角／項圈 runtime 掛在 CC0 牛上 |
| 生成方式 | **bpy** 子物件匯出或 **CC0 牛** 場景內固定掛點 mesh |
| 目標 | 角 ≤ 80 tris×2；項圈 emissive 可控；死亡時一併隱藏 |
| 輸出 | `custom/props/strong-cow-kit.glb` 或寫入變體腳本 |

#### P1-5 牛風格降噪（可選但高價值）

| 欄位 | 規格 |
|---|---|
| 現況 | 2,530 tris + 13 clips（多數未用）佔 1.86 MB |
| 生成方式 | **CC0 保留網格** + glTF-Transform **prune 未用動畫**；或 **bpy** 重做 ≤ 800 tris 四足 + Eating／Walk／Hit／Death |
| 建議 | 先 prune clip（工程向）；若仍壓過主角再 bpy 降模 |

---

### 4.3 P2 — 打磨與清理（建築／環境／殘件）

#### P2-1 肉舖攤位 R2（雪地 thruput 區）

| 欄位 | 規格 |
|---|---|
| 現況 | 768 tris 可讀；與 Holiday 雪屋材質語言不同 |
| 生成方式 | **bpy** |
| 目標 | ≤ 1,200 tris；棚布可加 1 層雪帽；掛肉微動畫可選；燈 emissive 維持 |
| 輸出 | 覆寫 `butcher-stall.glb` |

#### P2-2 收銀台／狗屋／肉片／金幣 micro-pass

| 欄位 | 規格 |
|---|---|
| 生成方式 | **bpy** |
| 目標 | 各維持 ≤ 300 tris；收銀台按鍵區可讀；肉片脂肪層對比；金幣厚度與 emissive 夜間可辨 |
| 優先 | 低；P0 完成後再做 |

#### P2-3 三塔 R3 細節

| 欄位 | 規格 |
|---|---|
| 現況 | 536–984 tris + `attack` 已夠辨識 |
| 生成方式 | **bpy** |
| 目標 | 維持 ≤ 1,000；可加雪積、螺栓、彈藥箱等 **剪影級** 細節；不改 `AimPivot` 契約 |
| 優先 | 低 |

#### P2-4 環境冬景一致化

| 欄位 | 規格 |
|---|---|
| 現況 | Kenney 松／石／柵可接受 |
| 生成方式 | **CC0 保留** + 執行期或材質色票偏冷；或 **bpy** 2 棵冬松 LOD |
| 建議 | 遠景維持 Kenney；**不要** P0 重畫 |

#### P2-5 雪屋 thruput 接縫

| 欄位 | 規格 |
|---|---|
| 現況 | Holiday colormap 木紋 vs 攤位純色 |
| 生成方式 | **CC0 保留模組**；可選 **bpy 重烤 thruput 牆面** 與攤位同色票 |
| 優先 | 低；僅當錄宣傳片近景需要 |

#### P2-6 死資產與動畫包清理（工程）

| 欄位 | 規格 |
|---|---|
| 項目 | 確認移除載入路徑後刪或移出 `tower/tower-body.glb`、`tower-weapon.glb`；`holiday/bench.glb` 未用則標記 |
| 生成方式 | 非重繪；**資產衛生** |
| 另 | `cow.glb`／`zombie.glb` 未用 clip prune 可省大量 MB |

---

## 5. 建議重繪波次（僅規劃）

```
Wave A（P0）  主角 R3 → Boss 可動 → 四常客 walk → 員工兩模
Wave B（P1）  牧羊犬 → 武器包 → 僵屍暴風化 → 強化牛配件 → 牛 prune/降模
Wave C（P2）  攤位雪化 → 小物 micro → 塔 R3 → 環境色票 → 死資產清理
```

**依賴**

- 主角／員工／常客若共用 18 骨，應先凍結 `animated_asset_utils.py` 骨名再批量出模。
- Boss 若自定骨架，需先定 clip 名稱再改 `StormGame` 映射（實作階段）。
- 每波結束維持：`npm run test:smoke` + 選角／夜襲／Boss 波目視截圖。

**體積守門**

| 檢查 | 建議上限 |
|---|---|
| `public/models/` 總量 | 持續 **&lt; 15 MB**（現 ~5.7 MB，P0 全 bpy 化後仍應 &lt; 8 MB） |
| 單主角 | &lt; 200 KB |
| 單員工／常客 | &lt; 120 KB |
| Boss | &lt; 250 KB（含 4 clip） |
| 禁止 | 為美術引入 Draco／Meshopt **除非**總量逼近上限且已 prune 未用動畫 |

---

## 6. 生成方式決策樹（給後續實作）

```
畫面中心 + 品牌識別（主角／塔／攤／Boss／員工／犬／武器）
  └─ 一律 bpy 原創，可重跑腳本

大量重複 + 已有優秀動畫 + 非 IP 核心（過渡期雜兵／牛）
  └─ CC0 保留網格 → 優先 prune／重著色 → 仍違和再 bpy LOD

遠景填充（樹／石／柵／遠山）
  └─ CC0 Kenney 可長期保留

特效／一次性掛件（槍口火、雪粒子）
  └─ runtime 可留
```

---

## 7. 非本輪項目（明確不改）

- 未修改任何 GLB、bpy 腳本、runtime 載入表
- 未刪死資產（僅標記 P2-6）
- 未改數值、任務、存檔
- 未要求導入付費素材庫

---

## 8. 監工總評

| 面向 | 評級 | 說明 |
|---|---|---|
| 可玩可讀 | **B+** | 塔剪影、攤位 thruput、夜襲 emissive 達標 |
| 風格統一 | **C** | 三來源並存；中心角色品質顛倒 |
| 動畫契約 | **C+** | 主角／塔有契約；Boss／常客／犬缺口大 |
| 產線可維護 | **A-** | bpy 腳本可重跑；CC0 來源文件完整 |
| 體積健康 | **A** | ~5.7 MiB，空間充足可做 P0 升級 |

**總結**：下一個美術里程碑不應是「再多一堆 Kenney 變體」，而是 **把 bpy 品牌線拉到足以壓住 CC0 填充物**——順序固定為 **主角 → Boss → 常客 → 員工**，其餘按 P1／P2 消化。本報告僅供排程與規格凍結；實作另開任務。
