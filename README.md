# 暴風啟示錄 Storm Apocalypse

雪地末世「放置經營 × 塔防」3D 網頁遊戲。玩家依 15 章「生存手冊」在牧場獵牛、經營肉舖、雇用員工、擴建三種防禦塔，守住 30 波完整殭屍戰役。

## 啟動

```bash
npm install
npm run dev
```

正式建置：

```bash
npm run build
npm run preview
```

## 操作

- `WASD`／方向鍵：移動
- `Space`／`E`／右下攻擊鍵：揮砍
- `B`：資金足夠時建造／升級獵風弩塔
- `N`／畫面下方波次鍵：啟動夜襲
- 桌機／手機：右側「整備」面板購買武器、員工、牧場 2 與三種塔
- 手機：左下觸控搖桿、右下攻擊鍵；「手冊／整備」按鈕開關面板

資金、波次、任務、循環委託、武器、員工、牧場與塔等級會儲存在瀏覽器 localStorage；舊 MVP 存檔會自動遷移。

素材與授權見 [CREDITS.md](CREDITS.md)，後續規劃與已知缺口見 [docs/ROADMAP.md](docs/ROADMAP.md)。
