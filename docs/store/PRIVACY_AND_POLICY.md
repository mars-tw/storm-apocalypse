# 隱私與原生缺件稽核

日期：2026-10-15。程式來源 VERIFIED；原生安裝包與商店宣告一致性 BLOCKED。

## 實際行為與請求

本作沒有登入、廣告、分析 SDK、購買、追蹤識別碼、相機、麥克風、定位或聯絡人介面。localStorage 保存戰役、設定、守夜章與鮮肉佈局紀錄，資料不送到開發者伺服器。清除 App 資料／解除安裝會失去紀錄。儲存失敗時可繼續當次遊戲，但不能保證重開保留。

| 請求／功能 | 用途與處理 |
|---|---|
| 原本 `src/styles.css` 的 fonts.googleapis.com（進而可能下載 Google 字型） | **已移除**。原始碼與新打包版不再請求外部字型，使用裝置字型 |
| HTML、JS、CSS、GLB、PNG、WebP、SVG | 同源遊戲程式與素材；原生包由本機 WebView 提供。網站首次載入仍需要網站可連線，不宣稱網站版已有完整離線快取 |
| `src/game/music.ts` 的 `audio/bgm-day.ogg`、`bgm-night.ogg` | 同源音訊；音檔不存在時回退本機 WebAudio 合成，沒有錄音或資料上傳。缺檔的 fallback 不等於外部網路依賴 |
| WebAudio | 於裝置內合成音效與配樂，不讀取麥克風。背景／暫停會關閉配樂，返回後恢復 |
| Vite WebSocket | 僅開發模式熱更新；正式 dist 無此開發連線，不是玩家分析 |
| canonical、Open Graph URL | 頁面 metadata，非遊戲執行時資料上傳；未將其當作玩家追蹤 |

`reviewer-path.json` 保存實際請求清單。`offline-only.json`／`offline-built-package.png` 為 Chromium 離線、由測試攔截器從 dist 讀檔的本機包模擬；它驗證程式與素材不依賴遠端服務，**不等於已測過 iOS／Android 原生安裝包**。

## 唯讀 native-kit

範圍：`game-store-publisher/native-kit/apps/storm-apocalypse/`；未修改任何檔案。

- `ios/App/App/PrivacyInfo.xcprivacy`：NSPrivacyTracking=false；NSPrivacyCollectedDataTypes 空陣列；UserDefaults reason `CA92.1`。`project.pbxproj` 已將清單加入 Resources。
- `package.json`：Capacitor core／ios／android 8.5.2；app 8.1.2；preferences 8.0.1。未發現廣告或分析直接依賴；未宣稱已審完所有遞迴原生 SDK。
- `capacitor.config.json`：webDir=web；localhost 同源；無遠端 server.url；Android allowMixedContent=false、webContentsDebuggingEnabled=false。
- `AndroidManifest.xml`：主檔沒有敏感權限；仍須檢查新包的 merged manifest，不能只看來源主檔就宣稱最終權限為空。
- Xcode 來源仍是 marketing version 1.0.1／build 2。本 repo bump 到 0.3.0 不會自動改原生版本；目前不能把舊包當成 R25。

上述 tracking／collected-data 宣告與本輪已移除字型外連的遊戲來源方向一致。最終封存檔內所有 SDK 的 required-reason API、隱私清單合併結果、資料安全表實際值，仍未驗證。

## Google 資料安全草稿（PREPARED）

依目前來源，草稿為「不收集、不分享使用者資料；不含廣告；不建立帳號」。本機遊戲進度不是傳送離開裝置的收集項目。若發布網站或新增 SDK，必須重新核對。[Google 官方資料安全說明](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)要求開發者對實際 App 與 SDK 行為負責；此檔不是 Play Console 已設定的證據。

## 缺件與邊界

BLOCKED：新 iOS／Android build、簽章、archive 隱私清單與 merged manifest；實機飛航模式、強制關閉重開、背景音訊／中斷恢復、15～30 分鐘長局與低記憶體檢查；有效的公開隱私政策／支援網址及商店實際表單讀回。沒有讀取或更改商店帳號，不將未知填成已通過。

本作含喪屍戰鬥與狩獵，不定位兒童類；本輪沒有對其他兒童遊戲加改家長關卡。內容分級與帳號所有者身分需由正式提交線核對。[Apple 審查準則](https://developer.apple.com/app-store/review/guidelines/)仍適用，文件與測試不能保證核准。
