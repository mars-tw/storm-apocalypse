# CODEX_RESPONSE R18

實作：Claude subagent（Codex 額度封鎖至 7/24）

## 範圍（docs/OPTIM_PLAN_R18.md）

美術＋遊戲內容＋選單/裝置 P1 修正輪。來源：menuscan 全遊戲選單掃描（storm 章節：P0 零、P1×3 全在 844×390 橫向）＋ R17 裁決殘留。

## 完成項目

### L-01 首屏載入指示 <1s 可見（P1／體感掛死 26-40s）
- `index.html`：新增純 HTML/CSS 靜態 `#boot-loader`（固定視口底部置中、不定進度掃光條＋階段文字），首繪即現、零 JS/字型/資產依賴；key-art 渲染觸發 module import 時階段文字切「下載北境引擎」；`ui.ts` 掛載 intro loader 後移除 boot loader。
- `#app` 補 `z-index:20`（真 UX bug：原 z-auto 低於 key-art 預渲染 z1，慢機上背景圖 decode 完成前 intro 掛載後仍被靜態 key-art 蓋住不可互動——R14 modal mutex 探針在載機下命中 `#key-art-prerender` 抓出此問題）。
- 量測：preview＋400KB/s/150ms 節流——`#boot-loader` 於導航 commit 後 900ms 檢查點 visible 且完整落在 844×390 視口（before 同條件同檢查點：無任何載入 UI 元素存在）。smoke 斷言 commit 後 1s 內 visible＋box 在視口內（實測 box=262,331,320×29）。

### L-02 start 按下後載入回饋
- `main.ts`：未 ready 按 start 不再把進度條倒退回 2%；改 `ui.markWaitingForReady()`——按鈕 disabled＋「整 備 中 …／北境資產載入中，就緒後自動進場」，intro 加 `is-waiting` 發光強調；資產分階段回報照舊（串流 0-82%→佈置 86%→光影 96%）。
- 橫向矮視口（pointer:coarse + landscape + max-height:540px）`.intro .loader` 改 fixed 釘視口頂部置中——載入進度永遠在畫面內（menuscan：原本 loader 在摺疊外 543px）。
- smoke 新斷言：延遲 models 資產後點 start → 按鈕鎖定＋loader 在視口內；資產完成後自動進場（intro detached）。

### M-01 橫向 844×390 選角溢出 543px 無捲動暗示
- `.intro--selection` 底部固定漸層遮罩＋`#select-scroll-hint`「▼ 捲動選擇守燈人」浮動指示；`ui.ts` scroll listener 切 `has-more-below`，捲到底自動隱藏。
- 實測 844×390：hint opacity 1、三張角色卡皆可捲到並選取、sticky 確認鈕全程在視口內（y 321-380）、捲到底 hint 消失。

### M-02 出擊準備（整備）面板內容窗 166px → 292px
- 橫向矮視口 `.command-panel` max-height 改 `calc(100dvh - 78px - env(safe-area-inset-bottom))`（開啟時 prep-modal 已隱藏底部控制，無遮擋）。
- 實測 844×390：clientHeight 166 → **292**（scrollHeight 364，殘餘捲動 72px 有 scroll fade 暗示）；390×844 / 1366×768 內容窗 ≥ 內容高、零回歸。
- smoke 新斷言：內容窗 ≥ 280px、面板不出視口、四分頁可切換、捲動暗示開/關正確。

### M-03 P2 批次（掃描殘項）
- 清檔確認 focus 自動捲底把標題捲出：結算與系統選單兩處改 `focus({ preventScroll:true })`＋`scrollIntoView({ block:"nearest" })`。
- 手冊/整備/結算需捲無提示：`.scroll-fade-host` sticky 漸層 ::after（畫在內容層，不被 border-image fill 蓋住），`has-more-below` 控制顯隱。
- 員工描述截斷、HUD 塔鈕省略號：單行 ellipsis 改兩行 line-clamp。
- 44px：storm 掃描 71/71 命中、無 <44px 控制（scan-results.json 複核），無需批次補。

### A-01 美術（程序化打磨；生成工具未連線）
- 字級階收斂：7px 說明字全面升 8px（shop-item/tower-dock/regular-list/performance-chip/weapon-button/character-card small），統一最小可讀字級。
- 武器圖示可辨識度：武器/攻擊鈕圖示加 saturate(1.18)/contrast(1.07) 濾鏡＋鈕內 radial 冰光/暖光底盤。
- 戰場光照層次（Babylon 參數微調，不動資產管線/weatherProfiles.json）：`skyLight.specular` 歸零（去除半球光平面亮片）、`sun.specular` 收暖降強（雪地爆白高光收斂）、`shopLight.specular` 暖化（近景不再出現冷白點）。

### C-01 遊戲內容（R17 方向延伸，非 Codex 佇列項）
- 波前動員線 `WAVE_EVE_DISPATCHES`（content.ts 純資料 7 條：波 5/10/15/20/25/29/30，開波 +1.5s 播），與 B-01 完成廣播成對，維持里程碑節奏、不灌水安靜波。
- 顧客好感回饋可視化：`addCustomerAffinity` 非門檻回合補輕量 toast「{名} 好感 +n（x/10）」，既有 allowance（每客每波 ≤2）天然限流。
- smoke 新斷言：資料條數/波號對應/文案長度＋接線靜態契約。

## 閘門結果

| 閘門 | 結果 |
|---|---|
| typecheck | PASS（tsc --noEmit 零錯誤） |
| build | PASS（npm run build＝typecheck＋vite build） |
| smoke | **PASS 166/166**（152 原有＋14 淨新增；第一輪 164/166 抓出 hot-zone 語義過時與 #app z-index 真 bug、tower clip 斷言 TOCTOU，修正後第三輪全綠） |
| 秘密掃描 | PASS（sk-proj/sk-40/xai- 零命中，排除 .git/node_modules） |
| 版本 bump | 0.2.8 → 0.2.9（package.json/lock/README）；UI marker R15 → R18（ui.ts＋smoke 斷言＋system-note）；舊版號 grep 僅餘歷史 docs |
| 證據 | docs/evidence/r18/{before,after}/ 各 8 張（390×844、844×390、1366×768 world/shop-panel＋844×390 首繪節流對照＋選角頂部）；歷史 evidence 未動 |

### smoke 斷言修正附註（伴隨 R18 行為變更）
- `open panel avoids control hot zones` → `avoids visible control hot zones`：prep-modal 開啟時底部控制 visibility:hidden＋inert（前一斷言已驗證不可命中），隱藏控制不再擁有幾何熱區——伸長面板允許覆蓋其原位置。
- `tower fire triggers authored clip`：修 TOCTOU——waitForFunction 命中後另行重讀屬性會錯過短促開火窗口，改原子回傳命中值。

## 修改檔案
- index.html（boot loader）
- src/main.ts（waiting 接線）
- src/game/ui.ts（scroll hint 系統/markWaitingForReady/focus 修正/R18 marker）
- src/game/StormGame.ts（specular 微調/波前動員/好感回饋）
- src/game/content.ts（WAVE_EVE_DISPATCHES）
- src/styles.css（選角暗示/loader fixed/面板高度/scroll fade/字級階/圖示濾鏡）
- scripts/test-smoke.mjs（R18 斷言 ×12）
- package.json / package-lock.json / README.md（0.2.9）
- docs/OPTIM_PLAN_R18.md / docs/CODEX_RESPONSE_R18.md / docs/evidence/r18/

## 殘留風險 / 缺件
- 本機 vite dev server 在多專案並行下會因 dep-cache 鎖死掛住（多個 orphan vite 互鎖）；本輪驗證改用 production smoke bundle＋vite preview（靜態），與線上部署形態一致。dev-server 併發問題屬機況，不入 repo。
- 整備面板橫向仍有 72px 殘餘捲動（內容 364px vs 視窗 292px）——已有 scroll fade 暗示；要零捲動需砍內容密度，留待設計裁決。
- 效能 p95 未量測（audiodg 污染＋並行 smoke 載，量測不可信；依規需淨機重測）。
- D-03 modulepreload 量測票、A-02/A-03/D-01 仍在 Codex 7/24 復工佇列，本輪未觸碰。
