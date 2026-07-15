# storm R11：控制可達性硬化

## 修正摘要

- 底部常駐控制改為 `position: fixed` 貼齊 viewport safe area，避免被 canvas/頁面高度切掉；桌機 1920×1080、1440×780、1366×600、1280×640 與手機 390×844 都納入 smoke 守門。
- 整備/任務面板高度改用 `100dvh` 扣除底部控制保留區；低高度橫向觸控會把面板上緣提前並限制高度，避免遮住 joystick、attack、tower dock、wave。
- 整備分頁按鈕提高到 44px 命中高度；觸控底部 combat dock 間距提高，維持至少 8px 不重疊間隔。
- 3D build-pad 的 world action popover 改為 fixed，顯示後用實際 bounding rect clamp 到 viewport 內。
- 非觸控桌機仍維持桌機 UI；R11 smoke 斷言桌機 `.joystick` 不可見。
- R10 模型/Blender 產線未修改。

## Smoke 守門

新增於 `scripts/test-smoke.mjs`：

- R11 controls 1920x1080 / 1440x780 / 1366x600 / 1280x640 / 390x844。
- 逐一檢查 `tower-ballista`、`tower-frost`、`tower-cannon`、`wave`、`weapon`、`attack`：
  - element 存在且可見。
  - hit target 寬高皆 >= 44px。
  - 中心點在 viewport 內。
  - `document.elementFromPoint(center)` 可 hit 回自身。
  - 控制彼此不重疊。
- 桌機場景額外檢查 `.joystick` 不可見。

## 證據截圖

- `docs/evidence/R11_controls/desktop-1920x1080-controls.png`
- `docs/evidence/R11_controls/laptop-1366x600-controls.png`
- `docs/evidence/R11_controls/mobile-390x844-controls.png`

## 驗證

- `npm run typecheck`：PASS。
- `npm run test:smoke`：PASS，97/97 checks passed。
- `SMOKE_SCENARIO=390×844 npm run test:smoke`：PASS，37/37 checks passed。
- `SMOKE_SCENARIO=844×390 npm run test:smoke`：PASS，22/22 checks passed。

## 備註

- 完整 smoke 保留 R8/R10 靜態資產與動畫契約檢查；動態 hero coverage 仍可用 `SMOKE_SCENARIO=heroes` 單跑，避免與本輪控制守門的多視口 WebGL context 壓力互相污染。
- 版本升至 `0.2.3`。
