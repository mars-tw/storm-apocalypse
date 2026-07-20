# OPTIM_PLAN R18（美術＋遊戲內容＋選單/裝置 P1 修正）

日期：2026-07-19。實作：Claude subagent（Codex gpt-5.6-sol 額度封鎖至 7/24）。
來源：menuscan/PLAN_DRAFT.md storm 章節（13 畫面×2 視口掃描：P0 零、P1×3 全在 844×390 橫向）＋ OPTIM_PLAN_R17 裁決殘留。
本輪適用 game-optimization-round 技能：聚焦美術/選單/裝置/內容節奏，固定閘門照舊（typecheck+build、smoke 全綠、秘掃、版本 bump、三視口證據）。

## 修正清單（逐項可驗收）

### L-01【P1／體感掛死】首屏載入指示 <1s 可見
- 現況：index.html 只有 key-art 預渲染；main.ts 動態 import（vendor ~Babylon 大包）期間零載入 UI；橫向 844×390 選角畫面的 loader 在摺疊外 543px。
- 修法：index.html 加入純 HTML/CSS 靜態 `#boot-loader`（階段文字＋不定進度條，首繪即現，零 JS 依賴）；key-art 渲染後更新階段文字「下載北境引擎」；UI 掛載後由 intro loader 接手並移除 boot loader。
- 驗收：Playwright 新斷言——`#boot-loader` 於導航後 1s 內 visible 且完整落在 844×390 視口內。

### L-02【P1／26-40s 零回饋】start 按下後載入回饋
- 現況：`markInteractive()` 先開放 start；按下後資產仍在載，僅摺疊外的小 loader 有動靜（觀感當機 26-40s）。
- 修法：start 按下且 game 未 ready 時→按鈕 disabled＋文案改「整備中 · 北境資產載入中」；intro 加 `is-waiting` 狀態，loader 在橫向矮視口固定於視口內（fixed）永遠可見；資產載入分階段回報照舊（串流 0-82%→佈置 86%→光影 96%）。
- 驗收：Playwright——點 start 後（未 ready 時）按鈕 disabled 且 `#loading-text` 在視口內可見。

### M-01【P1】橫向 844×390 選角溢出 543px 無捲動暗示
- 修法：`.intro--selection` 底部漸層遮罩＋「▼ 捲動選擇守燈人」浮動暗示（捲到底自動隱藏，scroll listener 切 `is-scroll-end`）；sticky 確認鈕維持 R16 行為。
- 驗收：Playwright 844×390——初始暗示可見；可捲動選到三位角色各卡；確認鈕全程可點；捲到底暗示消失。

### M-02【P1】整備面板內容窗僅 166px（內容 364px）
- 修法：橫向 (pointer:coarse)+(max-height:540px) 下 `.command-panel` max-height 改 `calc(100dvh - 76px - env(safe-area-inset-bottom))`（開啟時 prep-modal 已隱藏底部控制，無遮擋）；面板加 CSS scroll-shadow 捲動暗示。
- 驗收：Playwright 844×390 開整備→內容窗高 ≥ 280px（原 166px）；四分頁可切換；1366×768/390×844 不回歸。

### M-03【P2 批次】掃描殘項
- 清檔確認 focus 自動捲底把標題捲出：`focus({ preventScroll:true })`＋`scrollIntoView({ block:"nearest" })`（結算與系統選單兩處）。
- 手冊/結算需捲無提示：`.quest-panel`、`.result__card`、`.command-panel` 套 CSS scroll-shadow。
- 員工描述截斷、HUD 塔鈕省略號：`white-space:normal` 兩行 clamp 取代單行 ellipsis。
- 44px：掃描 71/71 命中、無 <44px 控制（scan-results.json 複核），不需批次補。

### A-01【美術／程序化打磨】
- UI 視覺語言統一：字級階收斂（7px 說明字全面升 8px：shop-item/tower-dock/regular-list/loop-quest/performance-chip），統一最小可讀字級；金色強調與 --line 邊框語彙維持既有。
- 武器圖示可辨識度：武器/攻擊鈕圖示加 saturate/contrast 濾鏡＋鈕內 radial 冰光底盤，深底上剪影更清楚。
- 戰場光照層次：skyLight.specular 歸零（去除半球光平面高光）、sun.specular 收暖降強（雪地爆白高光收斂）、高畫質 contrast 1.08→1.10；不動資產管線、不動 weatherProfiles.json。
- 驗收：before/after 三視口證據圖；smoke 光照相關 dataset 斷言不回歸。

### C-01【遊戲內容】波次間敘事節奏＋顧客回饋（R17 裁決通過方向延伸，非 Codex 佇列）
- 波前動員線：`WAVE_EVE_DISPATCHES`（波 5/10/15/20/25/29/30 開波時的預告短句，與 B-01 完成線成對，維持里程碑節奏、不灌水安靜波）。
- 顧客好感回饋可視化：`addCustomerAffinity` 在無門檻事件時補輕量 toast「{名} 好感 +n（x/10）」（每客每波上限 2 次，既有 allowance 天然限流）。
- 驗收：smoke 純資料斷言（條數/波號對應/文案非空）＋接線斷言。

## 出貨閘門
1. `npm run build`（含 typecheck）＋ `npm run test:smoke` 全綠（152＋新增斷言）。
2. 版本 bump 0.2.8→0.2.9；grep 舊版號歸零（歷史 docs/evidence 除外）。
3. 秘密掃描零命中。
4. 證據 before/after（390×844、844×390、1366×768）入 docs/evidence/r18/；歷史 evidence 不動。
5. 報告 docs/CODEX_RESPONSE_R18.md；main 分支繁中 commit，不 push。
