# 素材來源與第三方授權

本文件記錄《暴風啟示錄》目前版本實際載入或仍保留在 repository 內的第三方素材，以及直接使用的框架、字型與建置工具。除下列第三方項目外，本專案程式碼、`tools/blender/` 程序產線及其原創輸出依根目錄 [MIT License](LICENSE) 發布；第三方素材仍依各自授權條款使用。

## R15 Wave 2 主選單／宣傳 key art

- 原始 master：OpenAI 內建 imagegen（model slug `gpt-image-2`）；嵌入 C2PA `softwareAgent = gpt-image 2.0`。
- Master：`docs/evidence/R15/masters/storm-r15-key-art-gpt-image-2.png`，SHA-256 `4614816946c2cbc6df96d3c956e3633e78d6a9d057bebdfab4de90088c787eab`。
- Runtime／宣傳 derivatives：`public/images/ui/background/menu-background*`、`public/images/cover.png`、`assets/cover.png`；使用 `tools/process_r15_key_art.py` 做中心安全裁切、Lanczos 重採樣與固定 palette 量化，沒有手工或生成式後製。
- 完整 prompt、reference hash、C2PA JSON、runtime hashes 與步驟：`docs/evidence/R15/prompt-template.md`、`docs/evidence/R15/c2pa-verification.json`、`docs/evidence/R15/source-manifest-r15.json`。

## 3D 模型與貼圖

| 來源 | 授權 | 目前用途與檔案 | 稽核狀態 |
| --- | --- | --- | --- |
| [Quaternius — Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `public/models/cow.glb`；舊牛隻保留於 repo，R13 執行期已改載 `public/models/custom/world/cow-*.glb` | 保留但執行期未載入 |
| [Quaternius — Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `survivor.glb`、`customer.glb`、`zombie.glb` 仍保留於 repo；R8/R10 後執行期角色已改載 `public/models/custom/` | 保留但執行期未載入 |
| [Kenney — Nature Kit](https://kenney.nl/assets/nature-kit) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 舊 `pine-*.glb`、`rock.glb`、`fence*.glb` 保留於 repo；`campfire-stones.glb` 仍用於營火 | 僅營火石執行期載入 |
| [Kenney — Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `public/models/tower/arrow.glb` 作弩塔箭矢；`tower-body.glb`、`tower-weapon.glb` 與 colormap 仍在 repo | 箭矢載入中；舊塔未載入 |
| [Kenney — Holiday Kit](https://kenney.nl/assets/holiday-kit) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 舊 `cabin-*.glb` 保留於 repo；`cabin-wreath.glb` 與 `lantern.glb` 仍作 R13 雪屋裝飾 | 僅花環與燈籠執行期載入 |

CC0 素材可用於個人及商業用途，署名並非授權要求；本專案仍保留來源與用途，以便追溯及重建。原始下載包與來源內附授權檔僅保留於已由 `.gitignore` 排除的 `tools/asset_sources/` 本機工作目錄，不隨 repository 發布。

## 字型

| 來源 | 授權 | 用途 |
| --- | --- | --- |
| [Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC)／[Noto Serif TC](https://fonts.google.com/noto/specimen/Noto+Serif+TC) | [SIL Open Font License 1.1](https://openfontlicense.org/) | `src/styles.css` 透過 Google Fonts 載入；分別用於介面內文及標題。repo 未內嵌字型檔，載入失敗時回退至系統繁中字型 |

## 程式框架與開發工具

以下為 `package.json` 的直接依賴或明確使用的素材產線工具；npm 的完整鎖定版本與遞迴相依套件請以 `package-lock.json` 為準。

| 專案 | 版本／角色 | 授權 | 用途 |
| --- | --- | --- | --- |
| [Babylon.js](https://www.babylonjs.com/) | `@babylonjs/core`、`@babylonjs/loaders` 9.16.1 | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | WebGL 3D、GLB 載入、骨架動畫、材質與後製 |
| [Vite](https://vite.dev/) | 8.1.4 | [MIT](https://github.com/vitejs/vite/blob/main/LICENSE) | 開發伺服器與正式版建置 |
| [TypeScript](https://www.typescriptlang.org/) | 7.0.2 | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | 型別檢查與編譯 |
| [Playwright](https://playwright.dev/) | 1.61.1 | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | Chromium smoke 與跨輸入驗證 |
| [Blender](https://www.blender.org/) | 5.1，建置工具 | [GPL-2.0-or-later](https://www.blender.org/about/license/) | 執行 `tools/blender/*.py`，產生 GLB、立繪、UI 與證據圖；Blender 本體未包入 repo |

## 本專案原創素材

- `public/models/custom/`：三主角、四名常客、三種 R8 殭屍、Boss、塔、武器、肉舖與互動道具，由 `tools/blender/*.py` 程序建模及匯出。
- `public/images/`：角色立繪、主選單背景、塵霧層、圖示、atlas 與 9-slice UI，由 Blender 5.1 產線渲染。
- `public/models/custom/world/`：R13 經 Blender MCP `execute_code` 重建的兩頭 19 骨動畫牛與十個剛性世界道具；統一使用 R8 COLOR_0、AgX 證據打光與 roughness 分層。
- `public/images/vfx/r13/`：R13 以 `gpt-image-2` 生成 8 張 opaque master，經本機 chroma-key 去背、despill、edge contract 與 Lanczos runtime resize 產生的原創 RGBA 戰鬥 VFX；prompt、hash、mask 與 alpha QA 記於同目錄 manifest 及 `docs/evidence/R13_art/`。
- `public/favicon.svg`：R12 自製北境閃電圖示，使用 repo 色票與純 SVG 路徑。
- `src/game/audio.ts`：R12 以 WebAudio oscillator、濾波 noise 與 gain envelope 即時合成八類遊戲音效；不載入外部音檔。
- `docs/evidence/R8/`：上述模型與 UI 的 turntable、角色陣容、主選單及遊戲畫面稽核證據。

R8 原創素材沒有直接搬運 Quaternius、Kenney 或其他外部模型／貼圖；第三方 CC0 模型仍以本文件列出的獨立路徑保留。現行 repo 沒有音樂、外部音效檔或內嵌第三方字型檔；R12 音效全部在瀏覽器內即時合成，無新增授權依賴。

## 維護方式

新增或替換素材時，請同步更新本表的來源 URL、授權、用途、檔案路徑與「是否仍由執行期載入」狀態。若素材來源無法確認，不應加入正式發行內容。
