# Storm Apocalypse R8｜角色藝術總修交付報告

日期：2026-07-14

## 交付結論

R8 已把 R6 的程序化素體改造成可重建的精品 stylized low-poly 角色系統。三主角現在有獨立剪影、完整五官與表情、3 主色＋1 accent 色票、依材質分類的 PBR 回應、COLOR_0 體塊漸層、磨損與刮痕，以及指定的角色立繪姿勢。三色殭屍、Boss 與四名常客也同步完成敘事配件與動畫換皮。

所有角色沿用共用 18-bone 骨架與既有 clip／root 180° 規約；正式 smoke、headed WebGL、typecheck、build 與 desktop/mobile 三跑中位 p95 均通過。

## 三主角藝術決策

| 角色 | 剪影與姿態 | 色票（3 主色＋accent） | 臉部與敘事件 |
| --- | --- | --- | --- |
| 屠夫老闆娘 | 寬肩厚腰、圍裙大平面、頭巾尾、大砍刀與掛肉鉤；立繪為扛刀、另一手叉腰 | `#962D3D` / `#31434A` / `#D2A78F`；accent `#E4A340` | 眼白、琥珀虹膜、瞳孔、下壓眉、鼻口與額面皺紋；牛血圍裙、磨損補片、黃銅記號與屠宰工具說明她是守店的老闆娘而非一般戰士 |
| 退伍狙擊手 | 瘦高長腿、軍帽、風衣分叉下擺、長圍巾尾與橫向長槍；立繪為單膝持槍瞄遠 | `#40513E` / `#252D30` / `#704A31`；accent `#72C3C5` | 眼白、灰青虹膜、瞳孔、警戒眉、鬍渣與面部疤痕；舊軍帽、馬鞍皮、胡桃木槍托與冷色瞄具建立退伍軍人的克制感 |
| 機械師少年 | 矮小大頭、大護目鏡、外露工具背包與高舉扳手、過大手套；立繪為蹲坐修理零件 | `#536473` / `#2A313C` / `#9B6737`；accent `#F47A27` | 眼白、榛色虹膜、瞳孔、好奇眉、雀斑；訊號橘工具、青色鏡片、背包捲材與扳手把「從廢料堆做出希望」寫進輪廓 |

純黑剪影證據見 [`after-silhouette-three-heroes.png`](evidence/R8/after-silhouette-three-heroes.png)。三者即使移除顏色與臉部，仍可由體型、頭部件、武器長寬比與背部道具直接辨識。

## 材質與體塊

- 每個零件在 Blender 生成時寫入 `StormGradient` vertex color，匯出為 GLB `COLOR_0`；上亮下暗的壓縮漸層兼作 baked AO/value breakup，避免均勻平色。
- 合併後的主角每人只保留一個 skinned mesh、4–5 個共用 physical surface primitives：skin roughness `0.68`、cloth `0.91`、leather `0.72`、metal roughness `0.29`／metallic `0.78`、lens roughness `0.24`。非金屬件 metallic 均為 `0`。
- 布料下擺、圍裙補片與外套邊緣使用獨立磨損色幾何；刀面、槍件、工具與 Boss 裝甲加入高亮刮痕線及倒角捕光。
- 出貨色票與表面規約已寫入 [`render-preset-r8.json`](../public/images/ui/render-preset-r8.json)，preset 名稱為 `R8 Character Foundry`。

## 敵人、Boss 與 NPC

### 三種殭屍

- Ash：灰綠腐皮、暗紅破衣、殘破路牌／鉚釘。
- Frost：藍灰凍皮、冷色破衣、外露肋骨與凍結脊柱。
- Rust：黃褐腐皮、鏽紅破衣、水桶頭盔與垂掛鎖鏈。
- 共用恐怖錨點為破衣三角下擺、胸肩傷口、外露臂骨、斷顎、錯位牙與三爪手；每隻都有 `Idle`、`Walk`、`Idle_Attack`、`HitReact`、`Death`，攻擊傷害仍只在 active impact 時點發生。

### Boss

Boss 改為 4.15m 壓迫體型，使用厚胸腹、非對稱肩甲、熔爐核心／格柵、鋼筋冠、鎖鏈與掛鉤建立「移動屠宰爐」輪廓；保有 walk、attack、hurt、death 反應。

### 四名常客

- 老周：斗笠、煙斗與廢料袋。
- 林護理：護士帽、硬殼醫療包與紅十字。
- 小包：過大拼布背包與捲毯。
- 何偵察：雙筒望遠鏡、披風與備用短刃。

四人都已換成同一套 18-bone `Idle`／`Walk` 管線，步行會真正改變腿與手臂姿勢，不以整張模型上下晃動冒充動畫。敵人／Boss／NPC 合照見 [`after-enemy-boss-npc-cast.png`](evidence/R8/after-enemy-boss-npc-cast.png)。

## Rig、朝向與效能策略

- 主角、NPC、殭屍與 Boss 沿用 `root → pelvis/spine/chest/neck/head + L/R arms/legs` 的共用 18 bones；換皮不換骨。
- 三主角保留 `idle`、`run`、`attack_melee`、`attack_ranged` 四 clips 與 `WeaponSocket`。
- custom character／zombie／Boss 在 runtime 使用 `Vector3.Backward()` 對應匯出 root 的 180° 規約；smoke 三角色向右移動與攻擊時皆斷言 mesh forward `(+1.000, 0.000)`。
- 遠距動畫 LOD 只會暫停超過近距範圍、且不在前五近距名額內的 `Walk`；攻擊、受傷、死亡、近景走路與物理 root 永不暫停。
- R8 主角與殭屍各合併為單一 skinned mesh，共用少量材質；HUD 改為 10Hz 狀態發布，遊戲輸入、命中、物理與動畫仍逐 frame。第一階自動 fallback 使用 R6 既有的 `0.65` render scale；PCF depth texture/sampler 保持存活，headed Chrome 驗證無 sampler 競態。

## 成品面數

以下數字使用 smoke 直接解析成品 GLB index accessor，而不是 Blender 場景估算。

| 資產 | Tris | 預算 | 骨架／clips |
| --- | ---: | ---: | --- |
| 屠夫老闆娘 | 3,204 | 3,000–6,000 | 18 / 4 |
| 退伍狙擊手 | 3,724 | 3,000–6,000 | 18 / 4 |
| 機械師少年 | 3,376 | 3,000–6,000 | 18 / 4 |
| Zombie Ash | 1,216 | 1,200–2,500 | 18 / 5 |
| Zombie Frost | 1,360 | 1,200–2,500 | 18 / 5 |
| Zombie Rust | 1,324 | 1,200–2,500 | 18 / 5 |
| Plated Brute Boss | 4,296 | ≤8,000 | 18 / 5 |

## 三跑效能量測

條件：Chromium ANGLE D3D11、wave 25、warm-up 8,000ms、sample 6,000ms；原始資料見 [`performance-r8.json`](evidence/R8/performance-r8.json)。出貨判定採三跑 p95 中位數。

| Profile | Run 1 | Run 2 | Run 3 | p95 中位 | FPS 中位 | DC 中位 | 結果 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Desktop 1440×900 | 33.3ms | 16.8ms | 16.8ms | **16.8ms** | 56 | 339 | PASS ≤18ms |
| Mobile 390×844 | 16.8ms | 16.8ms | 16.7ms | **16.8ms** | 60 | 146 | PASS ≤18ms |

六次量測的 browser errors 都是 `0`。Desktop 第一跑有單次 33.3ms p95，但依既定「三跑中位」出貨規則，中位為 16.8ms。

## 測試與出貨閘

| 指令／檢查 | 結果 |
| --- | --- |
| `npm run test:smoke` | **78/78 PASS**；R8 預算、色票、18 bones、clips、三英雄 forward/attack/return-to-idle 全綠 |
| `npm run test:smoke:headed` | **3/3 PASS**；Chrome 150、30 秒、`GL warnings=0` |
| `npm run typecheck` | PASS（由 build 前置步驟再次執行） |
| `npm run build` | PASS；僅既有 public absolute URL 與 large chunk 警告 |
| in-app localhost 視覺驗證 | PASS；console warn/error `0`、屠夫 `idle`、四 clips 齊全、forward `(0, 1)` |
| 秘密掃描 | 0 命中（提交前執行） |

headed 測試仍會看見一筆非 WebGL 的本機 404 資源訊息，但不屬於 GL/sampler 警告；正式 smoke 的 page console errors 為 0。

## 證據與重建入口

- Before/after 四視角：[`R8 evidence`](evidence/R8/)
- 三張最終立繪：[`after-butcher-matron-hero-art.png`](evidence/R8/after-butcher-matron-hero-art.png)、[`after-vet-sniper-hero-art.png`](evidence/R8/after-vet-sniper-hero-art.png)、[`after-mech-youth-hero-art.png`](evidence/R8/after-mech-youth-hero-art.png)
- 主選單：[`after-menu-background.png`](evidence/R8/after-menu-background.png)
- 線上視角：[`online-gameplay-r8.png`](evidence/R8/online-gameplay-r8.png)
- 主角生成器：`tools/blender/hero_rig_factory.py`
- NPC 生成器：`tools/blender/character_factory.py`
- 三色殭屍：`tools/blender/zombie_r8.py`
- Boss：`tools/blender/boss_zombie.py`
- STORM_UI_PRESET 與所有 UI 重渲染：`tools/blender/ui_kit.py`
- 可重建證據圖：`tools/blender/r8_evidence.py`

## 素材來源與授權

R8 新增與重製的角色、敵人、Boss、配件、材質、立繪、選單背景與圖示均由本專案 bpy 程序自建，沒有引入 Quaternius、PolyPizza、Kenney 或其他外部模型／貼圖，因此本輪沒有新增第三方授權項目，也沒有直接搬運開源素材上架。

本輪只建立本地 commit，不 push。
