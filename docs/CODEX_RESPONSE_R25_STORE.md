# R25 暴風啟示錄商店優化驗收

日期：2026-10-15。版本 **0.3.0**，介面 R25。起始 commit `7c1e9f7`。計畫：[OPTIM_PLAN_R25.md](OPTIM_PLAN_R25.md)。

**Apple 4.3 風險：高。** 本輪把鮮肉引怪變成開場可玩的選位流程，修正 W29，準備可追溯資料；帳號整批 4.3／4.2.6 退件、與敵潮／塔防作品的共同結構、內容提供者身分與外部 beta 證據仍未解決。不將改介面或雜湊不同當成 Apple 認可的重大改變，亦不保證 Google 核准。[Apple 官方準則](https://developer.apple.com/app-store/review/guidelines/)仍須以最後安裝包與實際提交身分核對。

本機功能與自動化驗證 **VERIFIED**；商店文件 **PREPARED**；新原生包、實機、外部 beta、專屬新圖示與出貨效能 **BLOCKED**。沒有 push、部署、商店操作、訊息傳送、服務派工、憑證讀取或修改其他 repo。全程背景／無頭；只有單一執行者，不冒稱獨立模型覆核。

## 三項主要改進

1. **鮮肉佈局在開場直接可玩。** 新增肉舖戰術單，選西側攔截／中央聚攏／東側繞行，在真實世界座標設置誘餌；首次領取永久試守弩塔後，從實際第一波開始。第一隻生成時投出免費邊角料，敵人沿原有骨架走路改追鮮肉；至少引來兩隻不同敵人後保存戰術單完成紀錄。俯視鏡頭短暫顯示引怪區域，再回到角色。原有拖曳投餌、狩獵、搬肉、營業與手冊可繼續，沒有審查員專用模式。
2. **W29 原紅燈已修正。** 滿配固定種子由 40／60＝66.7% 改為 35／60＝58.3%；新種子 34／60＝56.7%。所有精英壓境事件（W9／14／19／29）生成間隔縮短 0.027 秒，讓護衛隊更集中；W24 仍是白幕事件。保留 HP、移速、傷害、敵種與所有原門檻，沒有針對 W29 改血量，也沒有改種子或放寬斷言。W30 固定 53.3%、新種子 55.0%，仍符合原門檻與非遞增要求。
3. **離線、存檔與產品識別更完整。** 移除 Google Fonts 外連、玩家畫面的 FPS／DC／開發輪次、等級英文縮寫；保留裝置字型。背包與貨架肉量加入本機存檔，兼容舊檔；暫停／背景事件保存狀態並關閉配樂。新增選位、取消與委託完成三種 WebAudio 提示音。新卡片會與整備／手冊／世界操作介面互斥，避免遮住按鈕。

## 驗證與證據

集中目錄：[evidence/r25-store/](evidence/r25-store/)。最終來源雜湊與計數：[validation-summary.json](evidence/r25-store/validation-summary.json)。

| 指令／驗證 | 結果 | 證據 |
|---|---|---|
| `npm run build`，包含 `tsc --noEmit` | VERIFIED，0 error；保留既有大 chunk 警告 | `build.txt` |
| `npm run test:smoke` | VERIFIED，196／196；含角色骨架、命中幀、hurt／death、模態、手機操作、RWD | `smoke-final.txt`、`smoke-results.json` |
| `npm run test:r24-mobile` | VERIFIED，74／74；取消／多指／旋轉、塔位、自然清波與永久補給 | `r24-mobile-final.txt`、`r24-mobile-results.json` |
| `npm run test:r24-rules` | VERIFIED，14／14 | `r24-rules.txt`、`r24-rules-results.json` |
| `npm run test:r23-feedback` | VERIFIED，7／7 | `r23-feedback.txt` |
| `npm run test:r25-rules` | VERIFIED，8／8；試守塔不可重領、非法選位、舊檔遷移、肉量保存與損壞／寫入失敗、精英節奏 | `r25-rules.txt`、`r25-rules.json` |
| `npm run test:r25-store` | VERIFIED，83／83；空白存檔冷啟動→引導→真引怪→自然清首波→暫停／補給／返回→重開 | `reviewer-path-verified.txt`、`reviewer-path.json` |
| `npm run test:simulation-fidelity` | VERIFIED，0.496／0.510 秒各 1,001 次生成，誤差 0.0000% | `simulation-fidelity.txt` |
| `npm run sim:balance` 固定與新種子各 720 局 | VERIFIED，兩組原閘全綠，跨組差異 ≤原 15 個百分點上限 | `balance-fixed.json`、`balance-fresh.json`、`balance-cross-seed.json` 與同名 txt |
| 秘密掃描／版本／diff | VERIFIED，秘密 0 命中，package／lock／README 為 0.3.0，`git diff --check` 通過 | `secret-scan.json`、`release-checks.json` |

合計 **382 項功能檢查全綠**，另有平衡與生成時鐘驗證。既有測試沒有刪除；只同步精確版本、12 個音效 cue、精英間隔與戰術鏡頭的來源契約，原數值斷言未放寬，鏡頭契約另增加戰術 FOV 條件。

審查路徑尺寸：375×667（iPhone SE 級）、430×932（大螢幕）、1032×1376（13 吋 iPad 級）、1376×1032（iPad 橫式）、768×1024。選位／開始／暫停與返回控制均檢查可命中、在視口內且至少 44px；既有測試另覆蓋 844×390、1366×600。各尺寸自動化約 5.2～7.8 秒完成首張引怪戰術單，**並發載量測，僅供參考**；這不是首次下載或真人新手表現的統計。

離線測試開啟 Chromium offline，由測試攔截器從正式 `dist` 讀取本機檔案，實際完成引怪目標，沒有遠端回退。另做瀏覽器凍結／恢復後的存檔與暫停可用性檢查。這些是 WebView 本機包的模擬，**沒有測過新的原生安裝包**。網站版本身未新增 service worker，不宣稱首次無網路可從遠端網站載入。

早期跑測保留失敗紀錄：原 W29 紅燈、音效／鏡頭來源契約尚未同步、戰術卡遮擋與開發伺服器中斷。本輪修正遮擋並停用審查測試伺服器熱更新，凍結來源後完整重跑。截圖檢視另發現 iPad 觸控提示被舊 top／bottom 定位拉成長條，已加上內容高度約束與五視口高度斷言，並提高返回按鈕文字對比。`smoke-final.txt`、`reviewer-path-verified.txt` 與 summary 是最終結果；不以早期部分檢查假稱完成。R24 歷史證據已還原，重跑結果另存 R25。

平衡候選與校準過程保留在 `elite-*-candidates.json`、`elite-calibration.json` 與 `scripts/analyze-r25-elite.mjs`。固定與 fresh 兩組都曾參與候選分析，因此不能稱為未見種子的獨立驗證，也不取代實際玩家測試。

## 文件、素材與識別

- [DIFFERENTIATION.md](store/DIFFERENTIATION.md)：逐款比較工作單全部同帳號作品，特別處理塔防、灰燼護航與 Crackveil；競品用官方商店資料，避免「全球唯一」無據宣稱。
- [SHARED_ASSETS_AUDIT.md](store/SHARED_ASSETS_AUDIT.md)：130 個本作執行期候選檔的擴大 SHA-256 比對無完全相同檔；列出標準框架、字型、授權來源與原生包比較限制。沒有把無命中等同視覺獨創。
- [STORE_COPY_ZH_TW.md](store/STORE_COPY_ZH_TW.md)、[APP_REVIEW_NOTES_EN.md](store/APP_REVIEW_NOTES_EN.md)：繁中名稱／副標／說明／關鍵字與英文三分鐘路徑，另列九題需要真實證據的缺口；只有草稿，未上傳。
- [PRIVACY_AND_POLICY.md](store/PRIVACY_AND_POLICY.md)：網路請求、localStorage、Google 資料安全草稿、原生隱私清單及缺件。native-kit 清單已有 tracking=false、collected data 空陣列、UserDefaults CA92.1，且被 Xcode Resources 引用；僅唯讀，不宣稱新 archive 已驗收。
- [SCREENSHOT_PLAN.md](store/SCREENSHOT_PLAN.md)：六張實際操作圖在 [screenshots/](store/screenshots/)，兩種輸出分別為 1290×2796 與 2064×2752，各三張，尺寸與 SHA-256 見 `screenshot-manifest.json`。已逐張檢視，沒有注入金錢／波次、合成不存在的玩法或產圖冒充截圖。
- before 使用原 HEAD 的來源封存、空白存檔與相同 430×932／DPR 3 無頭環境，見 `before-iphone-entry.png`、`before-iphone-day.png`、`before-source.json`。不是拿補給滿配畫面比較新手勝率。

美術／人物／地圖沿用現有正式低多邊形 3D 資產，沒有新增方塊角色或整張圖晃動動畫；按鈕、選單、技能主改為肉舖戰術單與引怪選位。動作流暢度由既有骨架／命中幀守門回歸。專屬誘餌與守夜委託圖示仍 **BLOCKED**；可用工具未暴露可指定並核對的 `gpt-image-2` slug，本輪沒有產圖／派工，也沒有偽造 manifest。新增三種提示音為本機合成，見 [asset-manifest.json](store/asset-manifest.json) 與 CREDITS。

## 效能與未完成清單

**並發載量測，僅供參考**：桌機／手機各三跑，p95 三跑中位為 **33.4ms／16.7ms**。原始工具 allProfilesPass=false，沒有改寫成通過；並發環境無法做出貨效能結論，待全部線路結束後於閒置機器重測。見 `performance-raw.json`、`performance-context.json`、`performance.txt`。大 chunk 警告仍在，長局溫控未驗證。

BLOCKED：

1. 專屬誘餌與守夜委託新圖示；正式資產／聽感的實機審查。
2. 新 iOS／Android 打包、簽章、原生版本 bump、merged manifest／archive 隱私清單與最終商店宣告核對。唯讀 native-kit 仍是 **1.0.1／build 2**，不含本輪變更。
3. iPhone／iPad／Android 真機、飛航模式、背景切換、強制關閉、低記憶體與 15～30 分鐘手感／溫控；瀏覽器模擬不能替代。
4. 外部 TestFlight beta 的真實回饋與改善紀錄、內容提供者／提交者身分、公開支援與隱私政策網址。沒有杜撰 Apple 九題答案。
5. 全補給對後段曲線的影響：既有模擬不使用新增補給或誘餌戰術，不能用這組勝率宣稱所有策略都已平衡；一般配置 W29／30 仍為 0%，屬保留的難度／體驗風險。

只提交本輪明確路徑；起始既有 `.audit-tmp/` 與 `docs/playtest/` 未追蹤資料保留、不暫存。本機提交後不推送、不部署、不重送商店。
