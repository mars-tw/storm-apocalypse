# storm R13 驗證摘要

## 資產閘門

- Blender MCP 世界組：12 / 12 GLB 通過；2 牛、3 松樹、2 岩石、2 柵欄、雪屋外殼／門／窗各 1，合計 7,930 tris、1,149,912 bytes。
- 兩頭牛各 19 bones，均含 `idle`、`Eating`、`Walk`、`Idle_HitReact1`、`Death`。Walk 為四肢對角步態，hurt／death 為骨架 reaction，physics root 與 visual rig 分離。
- 10 個剛性道具依材質合批；三角面、COLOR_0 與 PBR response 不變。全部 GLB 通過 magic bytes、hash、分類面數預算、COLOR_0、roughness／metallic 與動畫契約。
- VFX：8 / 8 `gpt-image-2` opaque master 完成 chroma-key 去背、despill、edge contract、Lanczos resize；runtime 全為 1024×1024 RGBA PNG，四角 alpha 0、occupancy／bbox／fringe／magic bytes／hash 全通過。
- VFX 難類工時：手動逐像素清理 **0 分鐘**；本機去背參數調校與 alpha QA **10 分鐘**。沒有把自動處理時間冒記為人工修圖。

機械 manifest：

- `public/models/custom/world/manifest-r13.json`
- `public/images/vfx/r13/manifest-r13.json`

## 執行期接線

- 場景已改載 12 個 `custom/world/*.glb`；舊 `cow.glb`、`pine-*.glb`、`rock.glb`、`fence*.glb`、`holiday/cabin-{wall,window,door,roof}.glb` 與 `strong-cow-accessories.glb` 不再由 `StormGame.ts` 引用。
- 牛／殭屍受傷後在 damage function 觸發 snow burst + ground decal；壁壘在 `baseHealth` 實際扣除後、enemy recovery 前觸發 wood splinter + decal + health warning。
- smoke 會驗證 8 張 VFX 已 preload，並在桌機與觸控牛隻受傷 frame 觀察 `vfxEvents > 0`。
- VFX plane 採 unit-quad pool、decal 六槽循環；blob shadow 與殭屍類型附件採共享 instances。既有靜態無動畫攤位／收銀台／狗屋依材質 runtime 合批；未更動角色骨架或動畫 clips。
- 沒有修改角色資產、主角／NPC／殭屍動畫、`src/game/ui.ts` 或 R12.1 HUD 樣式／marker。

## 發布閘門

| 閘門 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `SMOKE_OUTPUT=docs/evidence/R13_art/smoke-r13.json npm run test:smoke` | **141 / 141 PASS** |
| smoke 最低門檻 | 141 ≥ 136，PASS |
| performance desktop 1440×900 | 16.7 / 16.8 / 16.8 ms，median 16.8 ms、186 DC，PASS |
| performance mobile 390×844 | 16.7 / 16.8 / 16.8 ms，median 16.8 ms、139 DC，PASS |
| performance 門檻 | 六跑皆 p95 ≤ 18 ms、console errors 0，PASS |
| 秘密掃描 | `sk-proj-...` / `sk-...` 規則 0 命中，PASS |
| active 版本欄 | `package.json`、lockfile、README 均為 0.2.6，PASS |

效能原始輸出：`docs/evidence/R13_art/performance-r13.json`。初次未合批量測的 desktop p95 為 33.4 ms；合批與 VFX/accessory instancing 後，正式六跑全部落在 16.7–16.8 ms。Windows runner 明確記錄 High priority 與 i3-1215U P-thread affinity，以隔離使用者背景程式；ANGLE、vsync、viewport、Wave 25、warmup、sample 與 18 ms 閘門均未放寬。

## 視覺證據

- `before-showcase.png`：R13 前的舊雪屋、細柵欄、舊松樹與岩石。
- `after-showcase.png`：R13 後的公尺尺度雪屋、積雪木柵欄、三種松樹與岩石場景。
- `world-pack-agx.png`：12 個 GLB 的 Blender 5.1 AgX / R8 warm-key + cold-fill contact sheet。
- `vfx-alpha-contact-sheet.png`：8 個 runtime VFX 的透明底 contact sheet。
- `opaque/`、`rgba-master/`、`masks/`：opaque master、去背 master 與 alpha mask 可追溯證據。
