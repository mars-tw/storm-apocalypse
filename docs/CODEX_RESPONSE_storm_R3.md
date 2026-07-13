# 《暴風啟示錄》R3 Bug 修復回報

基準：`ca58372`。未執行 `git commit`／`git push`。

## 結論

- Bug 1 已修：衝鋒槍在鍵盤與觸控都能立即開火、按住連發，且能對牛與殭屍造成傷害。
- Bug 2 已修：面板開啟時攔截遊戲區事件、關閉後立即恢復；390×844 與 844×390 的面板不再壓住搖桿／攻擊熱區；按鈕在 pointerdown 立即動作並有按壓態。
- `npm run test:smoke`：31/31 PASS，三視口 0 console error。
- `npm run build`：TypeScript 零錯且 Vite build 成功。

## Bug 1 根因與排除

### 章節硬鎖：排除

R2 實際門檻是完成 Ch9（`SHOP_UNLOCK_CHAPTER.smg = 9`），不是 Ch14。判定接受 `quest.chapter > 9` 或 `quest.completed` 含 9；購買端與 UI 使用同一個 `hasCompletedChapter`。Playwright 注入 Ch14 完成、資金 9999、目前武器為斧後：

- 修前／修後皆 `Ch14 save unlocks SMG — enabled=true`。
- 購買後皆為 `weapon=smg, money=9639`。

因此不是 unlock id 對不上或 Ch9→後續章節鏈失效。

### 開火鏈：確認為主因

修前 `InputController` 只在第一次非 repeat `keydown` 排一發；觸控攻擊鈕也只在一次 `pointerdown` 排一發。遊戲雖替 SMG 設了 0.28 秒 cooldown，卻沒有「仍按住」狀態可以再次呼叫攻擊。另有兩個不一致：牛只吃一次 2 傷害（不是描述的 2×3），牛射程 10、殭屍射程 13。

修前自動化證據：

- 鍵盤長按：`keyboard SMG damages cow — cowsKilled 1→1`（FAIL）。
- 觸控長按：`touch SMG damages cow — cowsKilled 1→1`（FAIL）。
- 觸控高波殭屍：`playerKills 0→0`（FAIL）。

### 動畫／切武器狀態：排除

購買後 state 與存檔都切為 `smg`，武器模型重建成功，首次攻擊也能進入 `performAttack`；沒有卡在斧或 Slash 狀態。故不是切換動畫／狀態機鎖死。

### 修法

- 輸入層新增 `startAttack`／`stopAttack`／`isAttackHeld`。
- Space、E 與觸控攻擊鈕都在按下時立即排第一發；僅 SMG 在 held 期間依 0.28 秒 cooldown 連發，近戰仍是一按一擊。
- `keyup`、`pointerup`、`pointercancel`、視窗失焦都清除 held；攻擊鈕使用 pointer capture，避免手指滑出後卡住連發。
- SMG 對牛套用完整 2×3 burst；牛／殭屍皆為遠程鎖定（牛 16、殭屍 13）。
- canvas 增加只讀 smoke 指標（武器、攻擊次數、活殭屍、擊殺數），可直接驗證 runtime 傷害，不必等待波結束才落盤。

## Bug 2 根因與修法

### 根因

- 面板開關只等 `click`，沒有 pointerdown 即時動作。
- 手冊／整備開啟時沒有事件攔截層；點面板外的遊戲區會直接送到 canvas。
- 修前 390×844 整備面板的理論底緣為 `154 + 574 = 728`，搖桿頂緣為 `717`，重疊 11px。
- 攻擊鈕只有瞬時 `:active`，沒有可由輸入生命週期驗證的持續按壓 class；搖桿也沒有按壓視覺態。

修前自動化證據：

- `panel responds on pointerdown — open-before-pointerup=false`（FAIL）。
- `open panel blocks gameplay — canvas-pointerdown=1`（FAIL）。
- `closed panel restores gameplay — canvas-pointerdown=2`（FAIL；開啟時那一下已穿透）。
- `attack pressed state — is-pressed=false`（FAIL）。

### 修法

- 全畫面 `#app`／HUD 仍維持 `pointer-events:none`；只有實際按鈕、搖桿、開啟的卡片可互動。
- 新增僅在觸控面板開啟時為 `pointer-events:auto` 的 `panel-scrim`：攔截 canvas、點擊即關面板；關閉後回到 `pointer-events:none`。
- 面板開關、關閉與波次鈕改為 pointerdown 立即動作；`click.detail === 0` 保留鍵盤／輔助技術操作，避免 pointerdown+click 雙觸發。
- 所有按鈕加 `.is-pressed` 視覺態與 `touch-action: manipulation`；攻擊鈕與搖桿另有明顯縮放／亮度回饋。
- 390×844 面板 settled box 為 `x75 y154 304×538`，底緣 692；搖桿頂緣 717。844×390 面板為 `x510 y124 320×166`，底緣 290；攻擊鈕頂緣 303。兩者皆不重疊。

## 修後證據

完整命令：`npm run test:smoke`，結果 `31/31 checks passed; 0 failed`。

| 視口／路徑 | 關鍵結果 |
|---|---|
| 1440×900／鍵盤 | 購槍 9999→9639；立即攻擊 0→2；長按 2→11；牛 1→2；殭屍玩家擊殺 0→2；0 console error |
| 390×844／觸控 | pointerdown 即開；面板開啟 canvas=0、關閉 canvas=1；按壓態 true；長按 11→22；牛 1→2；殭屍玩家擊殺 0→4；0 console error |
| 844×390／觸控 | 面板／控制熱區不重疊；開啟 canvas=0、關閉 canvas=1；搖桿與攻擊鈕命中正常；0 console error |

Smoke 會用真實鍵盤、虛擬搖桿與攻擊鈕事件。因 Babylon headless 軟體 WebGL 可能低於 2 FPS，腳本 URL 帶 `?smoke=1`；這只在 Vite DEV 將品質固定為低並放寬模擬 dt 上限，正式 build 仍使用原本 0.05 上限。

## 重跑

```powershell
npm ci
npm run test:smoke
npm run build
```

可用 `$env:SMOKE_SCENARIO='390×844'` 只跑單一視口；預設會跑完整三視口。

主要異動：`src/game/input.ts`、`src/game/ui.ts`、`src/game/StormGame.ts`、`src/styles.css`、`scripts/test-smoke.mjs`，並加入 Playwright dev dependency 與 `test:smoke` npm script。
