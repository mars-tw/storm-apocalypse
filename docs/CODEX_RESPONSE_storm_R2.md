# 《暴風啟示錄》Grok R2 P0 修復回應

基準：`276ae16`。未執行 `git commit`／`git push`。

## 結論

- 品質偵測已改為裝置類型優先；`hardwareConcurrency <= 4`、低記憶體或硬體資訊缺省不再能單獨把桌機送進完整低檔。
- 無觸控、大視口桌機的最低入口為中檔，保留 1024 shadow map、即時陰影與後製；4 核／4 GB 與缺省硬體資訊桌機皆實測為「中／realtime」。
- 真手機／平板 UA 仍進低檔。R2 指出的觸控筆電小視窗改採交集判斷：小視口 touch 必須再同時符合 `cores <= 4` 或 `memory <= 4` 才進低檔，單靠 touch／視窗寬度不再定生死。
- CPU 核數只保留為中／高檔與小視口觸控裝置的次要參考。所有自動品質現在都沿用每 2 秒採樣、連續三次低於 28 FPS 才降至 0.8×／0.65×的實測降解析路徑；桌機即時陰影不會因規格猜測被預先移除。

## 變更

- 新增 `src/game/quality.ts`，集中可測的品質訊號與判定，明確區分 mobile UA、compact touch、CPU、記憶體與缺省值。
- `src/game/StormGame.ts` 改用新判定，並讓 28 FPS 監測涵蓋低／中／高自動品質，不再只監測已被判低的裝置。
- `scripts/test-smoke.mjs` 新增四組正常產品 URL 品質回歸：
  - 1440×900、4 核／4 GB、非觸控：中檔／realtime。
  - 1440×900、核心與記憶體缺省、非觸控：中檔／realtime。
  - 900×700、小視口 touch、4 核／4 GB 桌面 UA：低檔／blob。
  - 390×844、Android mobile UA：低檔／blob。

## 驗收

- `npm run test:smoke`：`35/35 checks passed; 0 failed`。
- `npm run build`：成功；`tsc --noEmit` 零錯、Vite build 零錯。僅保留既有的大 chunk 尺寸警告。
- `git diff --check`：通過。

本輪未處理 R2 的後期波次池化、音效、手動畫質覆寫等非本次指定項目。
