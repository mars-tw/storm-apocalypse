# Storm Apocalypse R6 交付報告

日期：2026-07-14

版本：`0.2.0`
基準：`ad4f727`（R4，68/68 smoke）

## 結論

R6 已完成 Blender UI 產線、三端介面換裝、重複模型／材質／投射物優化，以及玩家與敵人的命中幀／死亡回收時序修正。最終 `npm run test:smoke` 為 **74/74 全綠**；同機、同負載、三跑取中位的 W25 量測為：

| 視口 | R4 p95 | R6 p95 | R4 draw calls | R6 draw calls | R6 閘門 |
| --- | ---: | ---: | ---: | ---: | --- |
| 1440×900 桌機 | 50.0 ms | **16.8 ms** | 1,562 | **391** | PASS（≤18 ms） |
| 390×844 手機 | 16.7 ms | **16.7 ms** | 214 | **183** | PASS（≤18 ms） |

R6 桌機 draw call 中位下降 74.97%，手機下降 14.49%。桌機在持續低於 55 FPS 時會於第一階降級卸載即時陰影、Glow、Bloom、FXAA/MSAA 管線並補上 blob shadow；這是桌機 p95 從 50.0 ms 降至 16.8 ms 的主要出貨保護。

量測用每跑全新 Playwright Chromium context、固定 W25 存檔、無 DevTools，三跑無 console/page error。主機不是獨占實驗室機器，當時仍有使用者 Chrome 程序；因此數據可作同機 before/after 與本輪閘門證據，但仍建議部署後補一輪指定桌機 GPU 與實體手機的硬體驗收。

## A. Blender UI 設計與產線

### 共用視覺語言

`tools/blender/ui_kit.py` 的 `STORM_UI_PRESET` 是所有 R6 渲染的單一來源：

- 名稱：`R6 Sandstorm Foundry`
- Blender：5.1 headless `bpy`
- Renderer：EEVEE；透明 icon／立繪使用 Film Transparent
- 色彩管理：AgX、Medium High Contrast
- Turntable：62 mm、yaw -28°、pitch 17°
- Key：`#FFC58A`／920 W／4.2 m
- Fill：`#70B3C4`／430 W／5.0 m
- Rim：`#F06735`／720 W／3.0 m
- 色票：night `#07131A`、steel `#242B2C`、rust `#8F3B1F`、sand `#C18652`、ice `#79C3D2`、signal `#E36D3E`
- 所有新 GLB 匯出沿用既有 `character_forward=True`／root 轉 180° 朝向規約；沒有改回舊軸向。

完整參數、檔案尺寸、bytes、SHA-256 在 `public/images/ui/render-preset-r6.json`，可由產線重建，不依賴手工後製。

### 產出素材清單

圖示全部先載入現有 GLB，再以共用 turntable／三點光渲染 256×256 透明 PNG；三把原先沒有可載入模型的武器，先由 `tools/blender/weapon_pack.py` 生成可替換 GLB，遊戲內也改用相同模型。

- 塔：`tower-ballista`、`tower-frost`、`tower-cannon`
- 武器：`weapon-machete`、`weapon-axe`、`weapon-smg`
- 主角能力：`skill-butcher`、`skill-sniper`、`skill-mechanic`
- 員工能力：`skill-hunter`、`skill-cashier`、`skill-dog`
- 個別圖示：`public/images/ui/icons/*.png`，共 12 張 256×256
- Atlas：`ui-atlas-low.png` 512×384、`medium` 768×576、`high` 1024×768
- 武器 GLB：`public/models/custom/weapons/{machete,axe,smg}.glb`

現行遊戲沒有另外定義「主動技能」資料；本輪依實際內容把三位主角被動與三種員工自動化能力全部圖像化，沒有虛構不存在的技能。

三位角色以既有 18-bone rig 擺不同英雄姿勢，不以整張圖平移／旋轉假裝姿勢：

- `protagonist-butcher-matron{,-medium,-low}.png`
- `protagonist-vet-sniper{,-medium,-low}.png`
- `protagonist-mech-youth{,-medium,-low}.png`
- 尺寸分別為 512×768、384×576、256×384；選角卡以 `<picture>` 依視口切檔。

主選單場景與視差層：

- `menu-background.png` 1920×1080、`medium` 1280×720、`low` 960×540
- `menu-dust.png` 1920×1080、`medium` 1280×720、`low` 960×540
- 場景沿用肉舖、塔、角色與末日世界觀，改為暖沙塵 key light／冷霜 rim light，沒有重設計角色。

9-slice chrome：

- `panel-9s.png`、`button-9s.png`、`danger-button-9s.png`，皆 192×192
- 鏽蝕鋼框、刮磨、沙塵斑駁參數由 Blender 程序材質生成；已套在 HUD、任務／波次、商店、攻擊與主選單 CTA。

### UI 佈局

- 桌機 1440×900：任務在左、商店在右、波次與攻擊分離；實看圖示與 9-slice 正常。
- 平板 1024×768：面板仍保留安全邊距與獨立捲動，不遮中央玩法區。
- 手機 390×844／橫向 844×390：任務與商店改 44 px 以上 toggle，面板避開搖桿／攻擊熱區。
- 全域互動目標最小 44×44 px；正式 smoke 逐對比較可見按鈕，最小邊距為手機搖桿對波次按鈕 10 px，要求為 ≥8 px，零重疊。

## B. 效能優化

### Draw call／資源生命週期

- AssetContainer 材質用 class、標準化名稱、albedo、metallic、roughness、texture signature 去重；場景建完後 freeze 可凍結材質。
- 重複靜態 GLB 改 `doNotInstantiate: false`，樹、柵欄、商店零件等共享 geometry／hardware instances。
- 遠山改單一 source mesh 加 instances。
- 靜態 root 標記後 freeze world matrix；動態肉品、武器、投射物明確排除。
- 僵屍類型色材質共用，不再逐隻建材質。
- 弩箭、霜彈、砲彈改物件池；霜／砲 projectile material 共用且 freeze，命中後 disable 回池而非 dispose／重建。
- 55 FPS 門檻連續三個樣本未達時：卸載 shadow generator、GlowLayer、DefaultRenderingPipeline，角色補 blob shadow，render scale 進入 0.8；第二階為 0.65。

### 貼圖與 UI 記憶體預算

| Tier | UI atlas | 立繪 | 主選單背景 | 動態雪地 texture | 招牌 texture scale |
| --- | --- | --- | --- | ---: | ---: |
| low | 512×384／176,609 B | 256×384 | 960×540 | 256 | 0.50 |
| medium | 768×576／371,995 B | 384×576 | 1280×720 | 384 | 0.75 |
| high | 1024×768／609,277 B | 512×768 | 1920×1080 | 512 | 1.00 |

遊戲內商店／HUD 不載 12 張散圖，而使用單一對應 tier atlas；角色與背景才保留視口切檔。完整 bytes/hash 見 preset manifest。

### 粒子預算

| Tier | 暴雪 capacity / emitRate | 營火 capacity / emitRate |
| --- | ---: | ---: |
| low | 160 / 36 | 40 / 24 |
| medium | 640 / 150 | 90 / 58 |
| high | 1,200 / 340 | 140 / 90 |

自適應 Tier 1／2 會再把雪降為 24／12、環境粒子降為 12／6。

### 三跑量測條件與原始證據

- Windows、Chromium ANGLE d3d11、headless、deviceScaleFactor 1
- 固定 W25 存檔；自然生成至 11–14 隻 active zombies，三跑中位皆為 14 隻
- 每跑新 context；8,000 ms 暖機；6,000 ms rAF 採樣；三跑取中位
- 桌機：1440×900、desktop UA、high quality
- 手機：390×844、Android mobile UA、touch、low quality
- R4 與 R6 使用同一 `scripts/measure-performance.mjs` 與相同條件
- 原始 JSON：`docs/evidence/R6/perf-before.json`、`perf-after.json`

| profile | run 1 p95 | run 2 p95 | run 3 p95 | 中位 p95 | FPS 中位 | DC 中位 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| R4 desktop | 50.1 | 50.0 | 50.0 | 50.0 ms | 27 | 1,562 |
| R6 desktop | 16.8 | 16.8 | 16.8 | **16.8 ms** | 58 | **391** |
| R4 mobile | 16.7 | 16.7 | 16.7 | 16.7 ms | 60 | 214 |
| R6 mobile | 16.7 | 16.7 | 16.8 | **16.7 ms** | 60 | **183** |

## C. 動畫鐵律自查

- 主角走／跑：既有 rig 的 `run` 逐幀改變左右大腿、小腿、上臂與前臂，不是整張 sprite bob。
- 近戰：frame 1 idle、frame 7 anticipation、frame 13 strike、frame 19 follow-through、frame 24 settle；runtime 只在 13/24 秒解析傷害。
- 遠程：frame 1 idle、frame 5 aim anticipation、frame 8 fire、frame 10 recoil、frame 14 recovery、frame 18 settle；runtime 只在 8/24 秒解析傷害。
- 揮空：`resolvePlayerAttack()` 找不到 active target 時不呼叫任何 damage function，只顯示落空訊息；`pendingPlayerAttack` 仍維持到 recovery 結束。
- 敵人攻擊：先 `approach → anticipation` 並播放 `Idle_Attack`；只有 anticipation timer 到 active hit window 才扣壁壘，之後進 recovery。Boss 1–10 anticipation、11–16 impact、17–30 recovery，runtime active hit 在 frame 14。
- Hurt：存活敵人受傷立即播 `HitReact`；新 Boss GLB 同樣具 `HitReact`。
- Death：先播 `Death`，以 AnimationGroup 實際 frame range 算 duration；`setEnabled(false)` 排在 duration 後另加 34 ms，波次 recycle 也等 `deathEndsAt`，不會提前回收。
- 新 Boss 是 18-bone、600-triangle articulated model，包含 `Idle`、`Walk`、`Idle_Attack`、`HitReact`、`Death`；不是單張平面變形。

## 驗收

- `npm run typecheck`：PASS
- `npm run build`：PASS（Vite 大 chunk 與 public absolute URL 為 warning，無 error）
- `npm run test:smoke`：**74/74 PASS、0 failed**
- 原 68 項保持全綠；新增 6 項涵蓋 R6 PNG 非佔位、Boss 四類 clip、三張選角卡立繪、三視口按鈕零重疊／≥8 px。
- smoke 實際另驗三位主角各自 run／attack clip、+X mesh facing、one-shot 回 idle、桌機鍵盤、手機 touch/hold、塔 animation LOD、console 0 error。

## 截圖證據

- `docs/evidence/R6/ui-desktop-1440x900.png`：Blender 主選單背景與 CTA
- `docs/evidence/R6/hud-desktop-1440x900.png`：桌機 HUD／商店／atlas 圖示
- `docs/evidence/R6/hud-tablet-1024x768.png`：平板面板安全區
- `docs/evidence/R6/hud-mobile-390x844.png`：手機 HUD、toggle、波次／攻擊間距

## 重建命令

```powershell
blender --background --python tools/blender/weapon_pack.py
blender --background --python tools/blender/boss_zombie.py
blender --background --python tools/blender/ui_kit.py
npm run typecheck
npm run build
npm run test:smoke
node scripts/measure-performance.mjs
```

## 缺件與替換架構

本輪要求的塔、武器、現有能力、三主角、背景、視差層與 9-slice 均已成功產出，沒有用佔位圖冒充完成。未來增加主動技能時，只需在 `ui_kit.py` 的 icon spec 加 GLB／pose，atlas order 與 manifest 會一起重建；CSS 只需新增對應 cell class，不必重做整套介面。
