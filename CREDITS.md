# 《暴風啟示錄》素材與授權

本專案程式碼為本專案從零撰寫。下列第三方美術素材均依其發布頁面所示，以 **Creative Commons Zero v1.0 Universal（CC0 1.0）** 釋出，可用於個人及商業用途，無須署名。本檔仍保留來源與作者資訊，方便追溯與感謝作者。

CC0 法律文字：<https://creativecommons.org/publicdomain/zero/1.0/>

## Quaternius — Ultimate Animated Animals Pack

- 作者：Quaternius
- 來源：<https://quaternius.com/packs/ultimateanimatedanimals.html>
- 原始下載：<https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk>
- 授權：來源頁明列 CC0
- 使用內容：`Cow.gltf`
- 成品：`public/models/cow.glb`
- 使用動畫：`Eating`、`Walk`、`Idle_HitReact1`、`Death`

## Quaternius — Zombie Apocalypse Kit

- 作者：Quaternius
- 來源：<https://quaternius.com/packs/zombieapocalypsekit.html>
- 原始下載：<https://drive.google.com/drive/folders/1mWP6sCHun7OUMHQeDNZLrXTteXlzWg_t>
- 授權：來源頁明列 CC0
- 使用內容：`Characters_Matt_SingleWeapon.gltf`、`Characters_Lis_SingleWeapon.gltf`、`Zombie_Basic.gltf`
- 成品：`public/models/survivor.glb`、`public/models/customer.glb`、`public/models/zombie.glb`
- 使用動畫：玩家 `Idle / Run / Slash`；顧客 `Idle / Walk`；殭屍 `Walk / Idle_Attack / HitReact / Death`

## Kenney — Nature Kit

- 作者：Kenney
- 來源：<https://kenney.nl/assets/nature-kit>
- 原始下載：<https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip>
- 授權：來源頁與壓縮包內 `License.txt` 均明列 CC0
- 使用內容：低模松樹、岩石、木柵欄、柵門、營火石圈
- 成品：`public/models/pine-a.glb`、`pine-b.glb`、`rock.glb`、`fence.glb`、`fence-gate.glb`、`campfire-stones.glb`

## Kenney — Tower Defense Kit

- 作者：Kenney
- 來源：<https://kenney.nl/assets/tower-defense-kit>
- 原始下載：<https://kenney.nl/media/pages/assets/tower-defense-kit/a402493eaa-1726471567/kenney_tower-defense-kit.zip>
- 授權：來源頁與壓縮包內 `License.txt` 均明列 CC0
- 使用內容：方形塔身、弩砲、箭矢
- 成品：`public/models/tower/`

## Kenney — Holiday Kit

- 作者：Kenney
- 來源：<https://kenney.nl/assets/holiday-kit>
- 原始下載：<https://kenney.nl/media/pages/assets/holiday-kit/3976a6496a-1733923970/kenney_holiday-kit.zip>
- 授權：來源頁與壓縮包內 `License.txt` 均明列 CC0
- 使用內容：雪屋牆／門／窗／屋頂模組、燈籠、長椅
- 成品：`public/models/holiday/`

## 轉檔與保留方式

- 原始包只放在 `tools/asset_sources/`，該目錄已列入 `.gitignore`。
- Quaternius 自包含 glTF 以 `@gltf-transform/cli` 封裝成 GLB，未改造動畫或重製網格。
- Kenney GLB 保留原始網格；使用外部調色盤貼圖的套件保留其 `Textures/colormap.png` 相對路徑。
- 成品 `public/models/` 目前約 5 MB，低於 15 MB 預算。

## Alpha 擴充的程序模型

- 迴旋斧、衝鋒槍與槍口火光由 Babylon.js 基礎幾何在執行期組合，未加入第三方素材。
- 寒霜塔核心、火砲炮管、強化牛角與牧羊犬低模由 Babylon.js 基礎幾何在執行期組合，未加入第三方素材。
- 獵人與收銀員沿用上列 Quaternius Zombie Apocalypse Kit 的 CC0 角色；強化牛沿用 Ultimate Animated Animals Pack 的 CC0 牛模型。
- 場景、角色與殭屍皆從單一 `AssetContainer` 來源建立實例；沒有複製 GLB 檔。`public/models/` 總量維持約 4.93 MB，低於 25 MB 上限。
- 以 glTF-Transform 4.4.1 檢視最大兩個動畫檔：`cow.glb` 1.86 MB（13 段動畫）、`zombie.glb` 0.83 MB（15 段動畫），皆無外部貼圖依賴或必要擴充。現階段總資產僅 4.70 MiB，動畫 keyframe 佔比高，因此保留標準 GLB，避免為少量網格收益額外加入 Draco／Meshopt 解碼器與首屏成本。
