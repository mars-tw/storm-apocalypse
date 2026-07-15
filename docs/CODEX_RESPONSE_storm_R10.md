# Storm Apocalypse R10：員工／顧客／牧羊犬正規化

日期：2026-07-15

## 結論

R10 已把獵人、收銀員、匿名遊蕩顧客與牧羊犬全部換成自建 Blender stylized low-poly GLB。人類沿用 R8 的 `StormGradient`、5 類共用 surface response、18-bone rig 與匯出 root 180° 規約；牧羊犬改為 19-bone 四足 rig，步行以對角步態交替四肢。強化牛的牛角、發光項圈與吊牌改為 428-tris Blender GLB 子資產，不再由 Babylon `MeshBuilder` 即時拼裝。

R8 三主角與 R9 UI/UX 未修改。完整三視口 smoke 為 **110/110 PASS**；加入最終 wiring gate 後另跑資產＋844×390 情境為 **22/22 PASS**。headed Chrome 為 **7/7 PASS**，typecheck/build 均通過。

## 單位美術規格

| 單位 | 剪影／角色辨識 | 主色／輔色／accent | Tris | Rig | Clips |
| --- | --- | --- | ---: | ---: | --- |
| 獵人 | 寬簷獵帽、手持長獵槍、斜背彈帶、剪羊毛領與膝甲 | moss `#3F5144`／saddle `#754A2D`／rust `#A94B38`、brass `#D89A38` | 3,224 | 18 | `idle`, `walk`, `run`, `attack` |
| 收銀員 | oxblood 長圍裙、收據口袋、腰掛找零盤與硬幣、遮陽帽 | storm blue `#405B66`／oxblood `#963D45`／mustard `#D3A03D`、receipt `#D8CBA7` | 3,096 | 18 | `idle`, `walk`, `run` |
| 顧客・旅人 | 毛帽、長圍巾、側背包、保溫瓶與派克扣 | brown `#6C4939`／storm teal `#5F7880`／rust `#C75B3C` | 3,212 | 18 | `idle`, `walk`, `run` |
| 顧客・採集者 | 肩披巾、耳罩、手提籃與採集束 | teal `#3F6662`／mustard `#D1A13B`／red `#A44A43` | 3,156 | 18 | `idle`, `walk`, `run` |
| 顧客・難民 | 條紋斗篷、床卷背包、毛帽與手杖 | ochre `#6A5A3C`／storm blue `#4E7180`／orange `#C86538` | 3,136 | 18 | `idle`, `walk`, `run` |
| 牧羊犬 | 尖耳、厚胸毛、sable 面罩與尾巴、teal 項圈 | sable `#4A3528`／tan `#B87942`／cream `#D1B58A`、teal `#4D8C8F` | 3,092 | 19 | `idle`, `walk`, `run` |
| 強化牛配件 | 分段骨角、ember 項圈、brass 吊牌與發光寶石 | bone `#D7B77A`／ember `#9D3827`／brass `#D9A23D` | 428 | — | — |

所有 R10 人／犬 GLB 均落在 3,000–4,000 tris；煙霧測試直接解析 GLB JSON 驗證面數、骨數、clip 名稱，以及角色 root quaternion 的 180° 規約。

## 動畫與接線

- 人類視覺 rig 與 gameplay actor root 分離；遊戲只移動 actor root，`walk/run` 由骨架提供足部接觸、passing pose 與手臂反擺。
- 犬的四足骨架包含 spine/chest/neck/head、四組 upper/lower/paw 與兩節尾骨。`walk` 以左前＋右後／右前＋左後交替，不再出現剛性腿滑行。
- `updateStaff()` 會在收銀員與犬移動時播 `walk`、停靠時播 `idle`；獵人追牛播 `run`。
- 獵人攻擊補上 anticipation／impact／recovery。傷害延後至第 9 frame（`9/24s`）才結算，不在輸入／起手時立刻扣血。
- 匿名顧客由 traveler／forager／refugee 三款等權抽選；既有四位 R8 具名顧客維持不動。
- `StormGame.ts` 已無 `survivor.glb`、`customer.glb`、`createProceduralDog()`、`strong-cow-horn-material` 或 `strong-cow-ember-collar` 路徑。
- 強化牛繼續使用既有 cow 動畫；新 `strong-cow-accessories.glb` 掛在 cow actor root，取代 runtime MeshBuilder 配件。

## 驗收

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test:smoke` | 完整三視口 **110/110 PASS**；最終資產／wiring＋844×390 subset **22/22 PASS** |
| `npm run test:smoke:headed` | **7/7 PASS**；30 秒 WebGL warnings = 0 |
| browser 實機 localhost | R10 員工 clips、動畫狀態與 forward dataset 正常；畫面已存證 |
| console／page errors | smoke 0；headed 無 WebGL 錯誤（既有單一 404 非 GL 訊息） |

## 效能量測

條件與 R8 證據對齊：Chromium ANGLE D3D11、wave 25、warm-up 12,000ms、sample 6,000ms、desktop/mobile 各三跑。報表位於 [`performance-r10.json`](evidence/R10/performance-r10.json)。

正式保留的三跑結果為：desktop `33.4 / 50.1 / 50.0ms`（中位 50.0ms、335 DC、595 meshes），mobile `16.8 / 16.8 / 16.8ms`（中位 16.8ms、149 DC、203 meshes，**PASS ≤18ms**）。本次工作階段的 desktop D3D11 p95 尚未重現 R8 的 16.8ms，但場景負載並未回歸：R8 desktop 為 338 DC／604 meshes、mobile 為 143 DC／196 meshes，且 R10 所有 browser errors 為 0。另以 tier-2 大幅裁減 active meshes 的診斷也沒有改善 desktop p95，確認此輪瓶頸不是新 GLB 幾何；該無效裁減已撤回，沒有把視覺降級留在產品程式碼。R10 smoke/showcase 專用的 staff dataset 也已限制在診斷模式，shipping/perf 路徑不再每 frame 產生排序與字串；此修正讓 mobile 三跑恢復 60 FPS／16.8ms。

因此本報告不把 `p95 ≤18ms` 宣稱為通過；其餘驗收全綠。乾淨 D3D11 三跑報表已保留，供後續在無 GPU 競用環境重驗。

## 證據

- 舊 Quaternius 員工／顧客＋舊剛性犬：[`before-r10-outsider-cast.png`](evidence/R10/before-r10-outsider-cast.png)
- 新 R10 stylized cast：[`after-r10-stylized-cast.png`](evidence/R10/after-r10-stylized-cast.png)
- 同光源上下列對照：[`before-after-r10-normalization.png`](evidence/R10/before-after-r10-normalization.png)
- browser 實機線上視角：[`online-gameplay-r10.png`](evidence/R10/online-gameplay-r10.png)

## 缺件揭露

建模、rig、clips、配件 GLB、接線與證據均無缺件。唯一未達門檻為本工作階段的 D3D11 p95；已如實保留量測資料，沒有用靜態整張平移、剛性犬位移或修改統計方式冒充完成。
