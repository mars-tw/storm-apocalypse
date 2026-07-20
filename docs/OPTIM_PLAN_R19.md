# OPTIM_PLAN R19：真人試玩直向可讀性修正輪

日期：2026-07-20（Asia/Taipei）
輸入：`docs/playtest/PLAYTEST_R1.md`、`docs/playtest/GROK_PLAYER_CRITIQUE.md` 與 `docs/playtest/shots/`（僅讀取，不納入 R19 commit）

## 決策摘要

| 項目 | 決策 | 理由 |
| --- | --- | --- |
| SA-R1-01 / Grok P0 | 本輪修正並建立三視口 smoke gate | 390×844 核心戰鬥看不到角色姿勢與命中方向，屬阻斷級可讀性缺陷。 |
| SA-R1-03 / P2 | 本輪採低風險緩解 | resize burst 改為 140ms trailing debounce，只在 layout 穩定後重建一次 Babylon render target。 |
| SA-R1-02 / P1 | 不改數值，列入 backlog | 目前只有兩次手動第 30 波樣本，且 repo 沒有固定 seed 注入／重播 harness；直接調生成間隔會把不確定性帶進 W1–29 與既有 smoke。 |

## SA-R1-01：極窄直向戰鬥安全框

### 實作

- 以 canvas 實際 aspect ratio 計算 `portraitBlend`：`aspect >= 0.72` 完全沿用 R18；`aspect <= 0.56` 套用完整窄直向 profile，中間平滑插值。
- 從 `.hud--top` 與 `.bottom-controls` 的實際 bounding rect 建立戰鬥安全框，各留 12px 淨空；不把 CSS 常數複製進相機。
- 窄直向把非戰鬥／戰鬥 radius 由 19／25 漸增最多 3，beta 由 1.02 漸降至 0.82，提高俯角越過近景圍欄。
- 依安全框中心計算 `ArcRotateCamera.targetScreenOffset.y`，讓角色錨點落在上下 HUD 之間；target、beta、radius 與 offset 都逐 frame 平滑收斂。
- physics root、collider、骨架與既有 `idle/run/attack/hurt/death` 管線完全不改；本輪沒有用整張角色圖平移／縮放冒充動畫。

### 驗收

- 390×844 真夜襲：角色完整 bounds 位於 HUD 安全框；可見遮擋採樣至少 2/9；攻擊方向投影至少 30px；攻擊動畫 active frame 截圖。
- 844×390 與 1366×768：profile 必須為 `standard`，角色 bounds、可見採樣與攻擊方向維持既有 framing。
- 證據寫入 `docs/evidence/r19/`，不覆寫歷史 evidence。

## SA-R1-03：旋轉 resize 尖峰

### 實作與界線

- resize event 只刷新便宜的相機安全框快取。
- Babylon `engine.resize()` 延後 140ms；連續事件會取消前一個 timer，最後只做一次 render-target rebuild。
- smoke 以五次 resize burst 驗證：70ms 時 rebuild 不增加，220ms 時只增加一次。
- 此修正降低「CSS layout 與 GPU render-target 重建同幀」風險，但 headless smoke 不等同真人手機 GPU 的 FPS 量測；若實機仍有可感掉幀，下一輪再加 orientation transition 遮罩與 Performance trace。

## Backlog：SA-R1-02 第 30 波平衡

本輪不修改第 30 波生成間隔、敵人 HP、塔傷害、壁壘或終波專屬能力。

安全調整前必須先補：

1. 可注入並記錄的 deterministic seed，包含 spawn type/order、AI 路徑與隨機事件。
2. 至少 10 個固定 seeds；每 seed 對「SMG 前線」「斧守匯流口」「混合走位」各跑至少 5 局，且輸入腳本、滿配存檔與版本 hash 固定。
3. 每局輸出：存活秒數、勝敗、已生成／未生成／擊殺敵數、玩家／各塔擊殺與傷害、壁壘傷害時間線、攻擊 uptime、玩家位置與漏怪路徑。
4. 報告 median、P10、P90 與 seed-by-strategy 矩陣；確認失敗是生成壓縮、特定重型組合、路徑匯流，或輸入吞吐造成。
5. 候選修正一次只動一個變數（例如終波 spawn interval 或一次性終波防守手段），與現況 A/B；W1–29 smoke、事件波與結算橋接不得退化。

建議通過條件：滿配且熟練的固定輸入不再 100% 敗北，但也不得變成 100% 無操作勝利；正式門檻應由上述基線分布決定，而不是由兩局手動樣本反推。

## 發佈閘門

- `npm run typecheck`
- `npm run build`
- `npm run test:smoke`（含既有 R18 與新增 R19 assertions）
- 0.2.10 active version surfaces 一致，舊版號 active grep 零命中
- 秘密掃描零命中
- `main`、file-scoped commit、繁中訊息、指定 Co-Authored-By、不 push
