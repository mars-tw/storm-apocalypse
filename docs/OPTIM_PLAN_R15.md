# storm R15（Wave 2）主視覺與天候分級最佳化計畫

日期：2026-07-17
範圍：主選單／宣傳 key art、程序性風雪強度視覺分級。不得修改玩法數值、輸入、AI、碰撞、傷害、波次或角色動畫資產。

## 前置與 Wave 1 DoD

- 已全文讀取 `C:/Users/digimkt/Desktop/遊戲/WAVE2_PROTOCOL.md`、`AGENTS.md`、`docs/AUDIT_full.md`。
- worktree 開工前乾淨；版本 `0.2.7`；R13 world/VFX manifests 與 R8 render preset 齊全。
- 現行 smoke 靜態守門回報 `legacy=none`，production fallback 計數為 0；R8/R10/R13 角色、動畫、世界與 VFX manifest 前 12 項均 PASS。
- Wave1 殘留清單：無仍在 shipping runtime 的 fallback 或缺 manifest；`docs/AUDIT_full.md` 所列 Playwright browser 與 favicon 舊問題已由後續版本修復。R15 開工實跑另發現 smoke `reachable()` 不接受 Vite 8 的 base-prefixed entry path，列為測試 harness 殘留並於本輪修復，不改任何斷言。

## Before 基線（修改前）

| 項目 | before 實測 | 判定／after 上限 |
|---|---:|---|
| `assets/cover.png`、`public/images/cover.png` | 1280×640、各 580,263 B、SHA-256 `c10f1239…`，兩份相同 | 仍維持 1280×640 且 byte-for-byte 同步；引用加新內容 hash |
| 桌機主選單高畫質背景 | 1920×1080、2,037,529 B | 新 art；提供同視覺語言的低畫質 preview 與 med/high |
| 桌機主選單風雪層 | 1920×1080、563,337 B | 不再作首屏阻塞資產；程序性／既有層不得阻塞 3 秒焦點 |
| Fast 3G＋4× CPU、1440×900 主視覺 | 130 秒仍未 decode，量測中止；FAIL | performance mark `storm-key-art-rendered` ≤3,000 ms，腳本硬斷言 |
| 同條件 production 首屏可互動 | 240 秒仍未可互動，量測中止；before 下限 >240,000 ms | 不得比 before 下限退步 >10%；另報實際 after 值 |
| CI 同款 smoke | 靜態／契約 12 項 PASS；Vite 8 base rewrite 令 server readiness 20 秒後 FAIL，未進瀏覽器集合 | 修復 readiness 後完整既有邏輯集合 152/152 PASS、0 fail；不放寬 timeout/斷言 |
| p95 最新可信基線 | R13 淨跑 desktop/mobile 三跑中位皆 16.8 ms；R15 開工併發重跑因載入 180 秒 timeout，未取得 frame sample | after 所有樣本 ≤18 ms；本機結果標註「併發、不可信」 |

## 交付工作與逐項驗收

### 1. gpt-image-2 key art 治理

- 內建 imagegen 產出一張無文字、無 watermark 的 16:9 低多邊形北境暴雪 key art；三位主角、最後肉舖、弩／霜／砲塔均置於 2:1 與三視口安全裁切的共同焦點區。
- 原始檔只存 `docs/evidence/R15/masters/`，不得被 runtime 後製覆寫。
- Python 驗證 master C2PA `softwareAgent = gpt-image 2.x`，原始輸出進 `docs/evidence/R15/c2pa-verification.json`；驗不到即作廢重生。
- 確定性後製產出：主選單 high/medium/low、1280×640 cover；記錄 resize/crop/format/quality、master/runtime SHA-256、解析度與 C2PA 摘要至 source manifest，並同步 `CREDITS.md`。
- `assets/cover.png` 與 `public/images/cover.png` 必須 byte-for-byte 相同；`og:image`、Twitter、主選單 runtime 引用使用新 hash query。

### 2. 首屏與硬記憶體預算

- 首屏先預載小型、真實同畫風 low preview，完成 decode 後寫 `performance.mark("storm-key-art-rendered")`，再非阻塞升級 medium/high。
- Fast 3G／4× CPU 斷言：焦點 ≤3 秒；TTI 與 before 下限比較，禁止 >10% 回歸。
- 新增素材解壓貼圖：桌機累計 ≤64 MiB；行動檔位累計 ≤32 MiB。報告逐張列 `width × height × 4 bytes`；不得以壓縮檔大小冒充 GPU 記憶體。
- low 仍使用同一 master 的確定性 resize/crop，不可純色替代或換風格。

### 3. 風雪視覺強度與品質檔

- 建立 `low / medium / high` 天候強度 profile，僅調整程序性粒子與後處理視覺參數；生產強度只讀既有 `waveActive`／wave 進度，不回寫或修改任何 gameplay state。
- 品質 `低／中／高` 與天候強度分軌：品質檔只乘粒子 density/capacity；粒子方向、速度、生命期、尺寸、顏色、霧化／後處理與強度判定完全一致。
- canvas dataset／debug snapshot 暴露天候強度、品質、兩層粒子 rate、profile 參數，供自動斷言；dev-only query 可固定強度與品質以取得可重複證據，不進 production 行為。
- 最高強度下，HUD 文字對比 ≥4.5:1、敵人 silhouette 與命中回饋可讀性通過像素／DOM 斷言；不改 hit frame、hitbox、hurt/death 或任何角色動畫。

### 4. 命令化證據

- 新增 R15 視覺驗收腳本，輸出 JSON pass/fail 與截圖：
  - key art 1366×600、390×844、844×390 安全裁切 bbox；
  - 新底圖文字區域自動對比 ≥4.5:1；
  - 天候低／中／高同場景對照；
  - 品質 low／med／high 並排，且 profile 行為參數相同、僅 density 不同；
  - high 天候敵人／HUD／命中回饋可讀性。
- 證據存 `docs/evidence/R15/`；程序性 pipeline 參數與 color palette、prompt、reference hash、source manifest 一併入 evidence。

### 5. 快取、回滾與全量回歸

- 所有更換的 runtime 圖片引用加 `?v=<sha256 前 8 碼>`；repo 無 PWA/SW，故 cache name／offline precache 為 N/A，報告附掃描證據。
- 版本升至 `0.2.8`、UI marker 升 `R15`；grep 舊 shipping 版本號歸零（歷史 evidence/docs 除外）。
- 執行 `npm run typecheck`、`npm run build`、package.json 的 CI 同款 `npm run test:smoke`；既有邏輯集合必須 152/152 全綠。
- 角色動畫資產不改；smoke 既有逐幀姿勢、attack anticipation/impact/recovery、impact-frame damage、hurt/death 回收守門全部保留。
- 秘密掃描 `sk-proj|sk-|xai-`（排除 `.git`、`node_modules`）零命中。
- rollback：回切 R15 單一繁中 commit 即恢復 R14 runtime、舊 art、manifest 與引用；本輪只本地 commit，不 push。

## 完成後結果

| 閘門 | code-freeze 後結果 |
|---|---|
| imagegen／C2PA | gpt-image-2 master；`softwareAgent = gpt-image 2.0`；PNG CRC 全有效 |
| cover／OG | 兩份 cover byte-identical；SHA-256 `326a67a2…`；OG／Twitter query 同步 |
| Fast 3G＋4× CPU | key art 287.4 ms；首次可互動 14,564.1 ms；PASS |
| decoded texture | desktop 9,712,640 B／mobile 1,418,240 B；PASS |
| RWD／對比／天候 | 19/19 PASS；high 敵人 1.97、命中 1.80、HUD 最低 5.8:1 |
| 品質不變量 | high 天候 low／med／high 僅 density 0.32／0.68／1.00 不同；behavior／post signature 相同 |
| p95 | desktop 16.8／16.7／16.7 ms；mobile 16.8／16.7／16.7 ms；六筆全 ≤18 ms |
| CI smoke | 152/152 PASS、0 failure |
| 靜態稽核 | typecheck、production build、秘密、舊 marker、PWA/SW、diff-check 全 PASS |

完整證據索引：`docs/evidence/R15/validation-r15.md`。
