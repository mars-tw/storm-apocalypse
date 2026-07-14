# Storm Apocalypse R7 熱修交付報告

日期：2026-07-14

版本：`0.2.1`

基準：`94fcb8f`（R6，74/74 smoke）

## 結論

R7 已修復兩個 P0，未修改 R6 的模型、動畫、UI 圖產、CSS 視覺或遊戲數值：

- headed 實體 Chrome 高畫質路徑進遊戲 30 秒：`GL warnings=0`。
- 手機／平板 CTA 與遊戲提示改為「虛擬搖桿移動 · 揮砍鈕攻擊」，不再出現 `WASD`。
- 桌機 CTA 與遊戲提示保留 `WASD`。
- 正式 smoke 由 74 項增至 **78/78 PASS**；另有可選 headed Chrome smoke **3/3 PASS**。
- `typecheck`、production build、秘密掃描皆通過。

## P0-1：WebGL 警告風暴

### 根因

R6 的正式 smoke 使用 `?smoke=1` 並以 headless Chromium／SwiftShader 執行；`smokeMode` 會直接選低畫質，因此不會建立桌機 PCF shadow、Glow 與後製管線，也不會走 headed 硬體 GPU 的嚴格 sampler 驗證。

headed Chrome 重現顯示第一筆錯誤約在頁面建立後 `+13s` 出現，正好是進場後連續三次 2 秒低 FPS 取樣觸發第一階自動降級的時點。R6 在該階直接 `ShadowGenerator.dispose()`：PCF depth texture 被刪除，但 Babylon 的凍結／非同步替換 effect 仍有 draw 使用 `sampler2DShadow`。嚴格 WebGL2 驅動會把當下 texture unit 的其他貼圖視為不相容，因而在每個 `glDrawElements` 報：

```text
GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and sampler type (signed/unsigned/float/shadow).
```

A/B 驗證結果：保留 PCF sampler 與 depth texture 時為 0 warning；只要在降級過渡中關閉／刪除該 sampler 資源，就可重現 warning。動態雪地、UI atlas 與 KTX/Basis 不是這次 transition 根因：

- 雪地是 Canvas `DynamicTexture`，R7 額外明確指定 normalized `TEXTUREFORMAT_RGBA`。
- UI atlas 由 CSS 載入，不進 Babylon WebGL sampler。
- `public/` 沒有 `.ktx`、`.ktx2` 或 `.basis` 產物，執行期未觸發 Basis/KTX 資產路徑。

另發現 R6 材質去重只以貼圖顯示名稱當 signature；例如 holiday 與 tower 都有名為 `colormap` 的不同 PNG，存在錯併與未來格式不相容風險。

### 修法

1. PCF sampler 合約在自動降級時保持不變：shadow map 改為 `refreshRate = 0`（render-once）並 `resetRefreshCounter()`，因此不再支付每幀 shadow pass。
2. `setDarkness(1)` 隱去保留的 PCF map，既有 blob shadow 接手視覺；Glow／後製卸載與 0.8／0.65 render scale 降階仍照 R6 邏輯執行。
3. 相容的 depth texture 保留在 GPU，避免舊 effect 過渡 draw 失去合法 `sampler2DShadow` 綁定；代價只有該 target 的固定記憶體，不恢復每幀 shadow render 成本。
4. 有 active texture 的匯入材質不再參與結構式去重；無貼圖 Blender 材質仍維持 R6 去重收益。
5. 雪地 DynamicTexture 明確宣告 `Constants.TEXTUREFORMAT_RGBA`，避免未來重構誤傳 integer format。

### headed Chrome 驗證

新增指令：

```powershell
npm run test:smoke:headed
```

模式條件：Playwright `chromium.launch({ headless:false, channel:'chrome' })`、1440×900、一般 URL（移除 `?smoke=1`）、deviceScaleFactor 1、進場後等待 30,000 ms；蒐集 console warning/error 與 pageerror，對 `GL_INVALID`、`WebGL`、`glDraw`、sampler/texture format、too-many-errors 做失敗閘門。

R6／修復前重現摘要：

```text
Chrome 150.0.7871.115
state={quality:高, shadow:blob, postEffects:off, performanceTier:2, renderScale:0.65}
GL warnings=12（後續對照曾達 31）
FAIL: glDrawElements sampler/texture mismatch
```

R7 最終輸出：

```text
PASS [headed Chrome 1440×900] 30 seconds produce zero WebGL warnings
browser=150.0.7871.115
state={"quality":"高","shadow":"blob","postEffects":"off","performanceTier":"2","renderScale":"0.65"}
GL warnings=0
3/3 checks passed; 0 failed
```

dev server 另有一筆非 GL 的 404 resource 訊息（約 `+3.7s`），不符合任何 WebGL/GL sampler gate；production build 資產完整，正式 78 項 smoke 的 console error 斷言皆為 0。

## P0-2：觸控裝置提示

### 根因與修法

- CTA 已有觸控分流，但遊戲內 `#context-prompt` 初始 HTML 仍硬編碼 `WASD`。
- 裝置判斷集中為 `detectTouchMode()`，先看 `userAgentData.mobile`、行動 UA 與 iPadOS Macintosh+touch，再以 primary／any coarse pointer、窄視口 touch 作 fallback。
- 判斷沒有使用 `hardwareConcurrency`。
- CTA 與遊戲提示共用同一 `touchMode` 結果；UI 標記升為 `R7`。

新增四項 E2E 斷言：

```text
PASS [hints/desktop 1440×900] CTA keeps desktop WASD hint
PASS [hints/desktop 1440×900] game prompt keeps desktop WASD hint
PASS [hints/mobile 390×844] CTA uses touch hint without WASD
PASS [hints/mobile 390×844] game prompt uses touch hint without WASD
```

## 驗證結果

| 指令 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS；僅既有 Vite absolute public URL／large chunk warning |
| `npm run test:smoke` | **78/78 PASS** |
| `npm run test:smoke:headed` | **3/3 PASS；30 秒 GL warnings=0** |
| 高信心秘密 pattern 掃描 | **0 命中** |

## 變更範圍

- `src/game/StormGame.ts`：PCF 降階生命週期、RGBA 雪地格式、保守材質去重。
- `src/game/ui.ts`：device-type-first 觸控偵測與兩處提示文案。
- `scripts/test-smoke.mjs`：4 項提示斷言與可選 headed Chrome 30 秒 GL gate。
- `package.json`／`package-lock.json`：版本 `0.2.1` 與 headed smoke 指令。

未 push；依交付要求只建立本地 commit。
