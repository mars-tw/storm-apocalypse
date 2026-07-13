import { EMPLOYEES, MAIN_QUESTS, TOWERS, WEAPONS, towerUpgradeCost } from "./content";
import { currentLoopDefinition, currentMainQuest, type QuestCompletion } from "./quests";
import type { EmployeeId, RuntimeState, TowerId } from "./state";

type ShopCategory = "weapon" | "employee" | "pasture";

export class UiController {
  readonly joystick: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly money: HTMLElement;
  private readonly meat: HTMLElement;
  private readonly stock: HTMLElement;
  private readonly wave: HTMLElement;
  private readonly performance: HTMLElement;
  private readonly baseHealth: HTMLElement;
  private readonly baseHealthFill: HTMLElement;
  private readonly questPanel: HTMLElement;
  private readonly questChapter: HTMLElement;
  private readonly questTitle: HTMLElement;
  private readonly questLog: HTMLElement;
  private readonly questProgress: HTMLElement;
  private readonly questProgressFill: HTMLElement;
  private readonly questReward: HTMLElement;
  private readonly loopQuest: HTMLElement;
  private readonly loopTitle: HTMLElement;
  private readonly loopCopy: HTMLElement;
  private readonly loopProgress: HTMLElement;
  private readonly loopProgressFill: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly commandPanel: HTMLElement;
  private readonly waveButton: HTMLButtonElement;
  private readonly attackButton: HTMLButtonElement;
  private readonly toastHost: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultCopy: HTMLElement;
  private readonly resultStats: HTMLElement;
  private renderedChapter = 0;

  onStart: () => void = () => undefined;
  onAttack: () => void = () => undefined;
  onWave: () => void = () => undefined;
  onReset: () => void = () => undefined;
  onShopAction: (category: ShopCategory, id: string) => void = () => undefined;
  onTowerAction: (id: TowerId) => void = () => undefined;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="vignette"></div>
      <header class="hud hud--top">
        <div class="brand-mark"><span class="brand-mark__sigil">✦</span><span><b>暴風啟示錄</b><small>STORM APOCALYPSE</small></span></div>
        <div class="resources">
          <div class="resource resource--gold"><span>✦</span><div><small>資金</small><b id="hud-money">35</b></div></div>
          <div class="resource"><span>🥩</span><div><small>背包</small><b id="hud-meat">0 / 6</b></div></div>
          <div class="resource"><span>▤</span><div><small>攤位存貨</small><b id="hud-stock">0 / 6</b></div></div>
        </div>
        <div class="hud-status"><div class="wave-chip"><small>30 波戰役</small><b id="hud-wave">黎明 · 0 / 30</b></div><small id="performance-chip">高畫質</small></div>
      </header>

      <button class="panel-toggle panel-toggle--quest" id="quest-toggle" aria-label="開關生存手冊">手冊</button>
      <aside class="quest-panel" id="quest-panel">
        <div class="quest-panel__line"><span id="quest-chapter">生存手冊 · 01 / 15</span><i></i><button id="quest-close" aria-label="收合生存手冊">×</button></div>
        <h2 id="quest-title">前往東側牧場</h2>
        <p class="quest-log" id="quest-log">封鎖線以東還有活物。今晚的湯，得靠自己的刀。</p>
        <div class="quest-meter"><span>任務進度</span><b id="quest-progress">0 / 1</b><i><em id="quest-progress-fill"></em></i></div>
        <div class="quest-reward"><span>完成獎勵</span><b id="quest-reward">✦ 10</b></div>
        <div class="base-meter"><span>肉舖壁壘</span><b id="base-health">100%</b><i><em id="base-health-fill"></em></i></div>
        <section class="loop-quest" id="loop-quest" hidden>
          <span>本波委託</span><b id="loop-title">完整貨架</b><p id="loop-copy">本波不損失攤位存貨</p>
          <div><i><em id="loop-progress-fill"></em></i><small id="loop-progress">0 / 1</small></div>
        </section>
      </aside>

      <button class="panel-toggle panel-toggle--shop" id="shop-toggle">整備</button>
      <aside class="command-panel" id="command-panel">
        <div class="command-panel__head"><div><small>北境補給站</small><b>武裝與自動化</b></div><button id="shop-close" aria-label="關閉整備商店">×</button></div>
        <section><h3>武器鏈</h3><div class="shop-grid">${WEAPONS.map((item) => `<button class="shop-item" data-category="weapon" data-id="${item.id}"><span><b>${item.name}</b><small>${item.description}</small></span><em data-price="weapon-${item.id}"></em></button>`).join("")}</div></section>
        <section><h3>自動化員工</h3><div class="shop-grid">${EMPLOYEES.map((item) => `<button class="shop-item" data-category="employee" data-id="${item.id}"><span><b>${item.name}</b><small>${item.description}</small></span><em data-price="employee-${item.id}"></em></button>`).join("")}</div></section>
        <section><h3>牧場擴張</h3><button class="shop-item" data-category="pasture" data-id="pasture2"><span><b>炸開牧場 2</b><small>強化牛 · 生命 9 · 掉落 6 肉</small></span><em data-price="pasture-pasture2"></em></button></section>
        <section><h3>防禦塔</h3><div class="shop-grid">${TOWERS.map((item) => `<button class="shop-item" data-tower="${item.id}"><span><b>${item.name}</b><small>${item.description}</small></span><em data-price="tower-${item.id}"></em></button>`).join("")}</div></section>
      </aside>

      <div class="context-prompt" id="context-prompt"><kbd>WASD</kbd><span>穿越雪地，前往牧場</span></div>
      <div class="bottom-controls">
        <div class="joystick" aria-label="移動搖桿"><span class="joystick__ring"></span><span class="joystick__knob"></span></div>
        <button class="wave-button" id="wave-button" disabled><small>準備防守</small><b>至少建造一座塔</b></button>
        <button class="attack-button" id="attack-button" aria-label="攻擊"><span>⚔</span><small>揮砍</small></button>
      </div>
      <div class="toast-host" id="toast-host"></div>

      <section class="intro" id="intro">
        <div class="intro__content">
          <span class="intro__overline">北境封鎖區 · 第 1,247 日</span><h1><span>暴風</span>啟示錄</h1><h2>STORM APOCALYPSE</h2>
          <p>在永夜暴雪中狩獵、經營最後一間肉舖，<br>並在三十次鐘聲裡守住僅存的燈火。</p>
          <div class="intro__features"><span>30 波戰役</span><span>經營 × 塔防</span><span>本地存檔</span></div>
          <div class="loader"><i><em id="loading-bar"></em></i><span id="loading-text">喚醒風雪…</span></div>
          <button class="start-button" id="start-button" disabled><span>踏 入 暴 風</span><small>WASD 移動 · 空白鍵攻擊</small></button>
        </div>
        <div class="intro__side"><span>THE LAST BUTCHER</span><i></i><small>TAIPEI / LOCAL SAVE</small></div>
      </section>

      <section class="result" id="result" hidden><div class="result__card">
        <span>暴風戰報</span><h2 id="result-title">黎明仍在</h2><p id="result-copy"></p><div class="result-stats" id="result-stats"></div>
        <button id="result-button">帶著進度重整</button><button class="text-button" id="reset-button">清除進度並重開</button>
      </div></section>`;

    const get = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
    this.joystick = root.querySelector<HTMLElement>(".joystick")!;
    this.intro = get("intro");
    this.loadingBar = get("loading-bar");
    this.loadingText = get("loading-text");
    this.startButton = get("start-button");
    this.money = get("hud-money");
    this.meat = get("hud-meat");
    this.stock = get("hud-stock");
    this.wave = get("hud-wave");
    this.performance = get("performance-chip");
    this.baseHealth = get("base-health");
    this.baseHealthFill = get("base-health-fill");
    this.questPanel = get("quest-panel");
    this.questChapter = get("quest-chapter");
    this.questTitle = get("quest-title");
    this.questLog = get("quest-log");
    this.questProgress = get("quest-progress");
    this.questProgressFill = get("quest-progress-fill");
    this.questReward = get("quest-reward");
    this.loopQuest = get("loop-quest");
    this.loopTitle = get("loop-title");
    this.loopCopy = get("loop-copy");
    this.loopProgress = get("loop-progress");
    this.loopProgressFill = get("loop-progress-fill");
    this.prompt = get("context-prompt");
    this.commandPanel = get("command-panel");
    this.waveButton = get("wave-button");
    this.attackButton = get("attack-button");
    this.toastHost = get("toast-host");
    this.result = get("result");
    this.resultTitle = get("result-title");
    this.resultCopy = get("result-copy");
    this.resultStats = get("result-stats");

    this.startButton.addEventListener("click", () => this.onStart());
    this.attackButton.addEventListener("pointerdown", (event) => { event.preventDefault(); this.onAttack(); });
    this.waveButton.addEventListener("click", () => this.onWave());
    get("result-button").addEventListener("click", () => location.reload());
    get("reset-button").addEventListener("click", () => this.onReset());
    get("shop-toggle").addEventListener("click", () => {
      this.questPanel.classList.remove("is-open");
      this.commandPanel.classList.toggle("is-open");
    });
    get("shop-close").addEventListener("click", () => this.commandPanel.classList.remove("is-open"));
    get("quest-toggle").addEventListener("click", () => {
      this.commandPanel.classList.remove("is-open");
      this.questPanel.classList.toggle("is-open");
    });
    get("quest-close").addEventListener("click", () => this.questPanel.classList.remove("is-open"));
    this.commandPanel.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".shop-item");
      if (!button || button.disabled) return;
      const tower = button.dataset.tower as TowerId | undefined;
      if (tower) this.onTowerAction(tower);
      else this.onShopAction(button.dataset.category as ShopCategory, button.dataset.id ?? "");
    });
  }

  setLoading(progress: number, text: string): void {
    this.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    this.loadingText.textContent = `${text} · ${Math.round(progress * 100)}%`;
  }

  markReady(): void {
    this.setLoading(1, "風雪已就緒");
    this.startButton.disabled = false;
    this.startButton.classList.add("is-ready");
  }

  enterGame(): void {
    this.intro.classList.add("is-leaving");
    window.setTimeout(() => this.intro.remove(), 900);
  }

  update(state: RuntimeState): void {
    this.money.textContent = state.money.toString();
    this.meat.textContent = `${state.carriedMeat} / 6`;
    this.stock.textContent = `${state.displayedMeat} / ${state.stallLevel * 6}`;
    this.wave.textContent = state.waveActive ? `夜襲 · ${state.wave + 1} / 30 · ${state.enemiesRemaining} 敵` : `黎明 · ${state.wave} / 30`;
    this.performance.textContent = `${state.quality}畫質 · ${Math.round(state.currentFps || 0)} FPS · ${state.drawCalls} DC`;
    this.baseHealth.textContent = `${Math.max(0, Math.round(state.baseHealth))}%`;
    this.baseHealthFill.style.width = `${Math.max(0, state.baseHealth)}%`;
    const hasTower = Object.values(state.towers).some((level) => level > 0);
    this.waveButton.disabled = !hasTower || state.waveActive || state.wave >= 30;
    this.waveButton.innerHTML = !hasTower
      ? `<small>準備防守</small><b>至少建造一座塔</b>`
      : state.waveActive
        ? `<small>暴雪警報</small><b>第 ${state.wave + 1} 波交戰中</b>`
        : state.wave >= 30
          ? `<small>北境守住了</small><b>三十波戰役完成</b>`
          : `<small>敵情：${this.waveForecast(state.wave + 1)}</small><b>啟動第 ${state.wave + 1} 波夜襲</b>`;
    this.attackButton.querySelector("span")!.textContent = state.weapon === "smg" ? "⌁" : state.weapon === "axe" ? "◉" : "⚔";
    this.attackButton.querySelector("small")!.textContent = state.weapon === "smg" ? "掃射" : state.weapon === "axe" ? "橫掃" : "揮砍";
    this.updateQuest(state);
    this.updateShop(state);
  }

  private updateQuest(state: RuntimeState): void {
    const quest = currentMainQuest(state);
    if (quest) {
      if (this.renderedChapter !== 0 && this.renderedChapter !== quest.chapter) {
        this.questPanel.classList.remove("quest-slide");
        requestAnimationFrame(() => this.questPanel.classList.add("quest-slide"));
      }
      this.renderedChapter = quest.chapter;
      const progress = Math.min(quest.target, quest.progress(state));
      this.questChapter.textContent = `生存手冊 · ${String(quest.chapter).padStart(2, "0")} / ${MAIN_QUESTS.length}`;
      this.questTitle.textContent = quest.title;
      this.questLog.textContent = `「${quest.log}」`;
      this.questProgress.textContent = `${progress} / ${quest.target}`;
      this.questProgressFill.style.width = `${progress / quest.target * 100}%`;
      this.questReward.textContent = quest.rewardLabel;
    } else {
      this.questChapter.textContent = "生存手冊 · 完成 ✓";
      this.questTitle.textContent = "北境守望者";
      this.questLog.textContent = "「第三十次鐘聲已有回音。這片封鎖區不再只有死人。」";
      this.questProgress.textContent = "15 / 15";
      this.questProgressFill.style.width = "100%";
      this.questReward.textContent = "全章完成";
    }
    const loop = state.quest.loop;
    const definition = currentLoopDefinition(state);
    this.loopQuest.hidden = !state.waveActive || !loop || !definition;
    if (state.waveActive && loop && definition) {
      this.loopTitle.textContent = loop.completed ? `✓ ${definition.title}` : definition.title;
      this.loopCopy.textContent = `${definition.description} · 獎勵 ✦ ${loop.reward}`;
      this.loopProgress.textContent = `${loop.progress} / ${loop.target}`;
      this.loopProgressFill.style.width = `${Math.min(1, loop.progress / loop.target) * 100}%`;
      this.loopQuest.classList.toggle("is-complete", loop.completed);
    }
  }

  private updateShop(state: RuntimeState): void {
    const set = (key: string, text: string, disabled: boolean, active = false): void => {
      const label = this.commandPanel.querySelector<HTMLElement>(`[data-price="${key}"]`);
      const button = label?.closest<HTMLButtonElement>(".shop-item");
      if (!label || !button) return;
      label.textContent = text;
      button.disabled = disabled;
      button.classList.toggle("is-owned", active);
    };
    for (const item of WEAPONS) {
      const owned = item.id === "machete" || item.id === "axe" && state.weapon !== "machete" || item.id === "smg" && state.weapon === "smg";
      const equipped = state.weapon === item.id;
      set(`weapon-${item.id}`, equipped ? "使用中" : owned ? "已擁有" : `✦ ${item.price}`, equipped || owned || state.money < item.price || state.waveActive, equipped);
    }
    for (const item of EMPLOYEES) {
      const owned = state.employees[item.id as EmployeeId];
      set(`employee-${item.id}`, owned ? "已雇用" : `✦ ${item.price}`, owned || state.money < item.price || state.waveActive, owned);
    }
    set("pasture-pasture2", state.pasture2Unlocked ? "已開放" : "✦ 260", state.pasture2Unlocked || state.money < 260 || state.waveActive, state.pasture2Unlocked);
    for (const item of TOWERS) {
      const level = state.towers[item.id];
      const price = level === 0 ? item.price : towerUpgradeCost(item.id, level);
      const text = level >= 3 ? "滿級 Lv.3" : level === 0 ? `建造 ✦ ${price}` : `升級 Lv.${level + 1} · ✦ ${price}`;
      set(`tower-${item.id}`, text, level >= 3 || state.money < price || state.waveActive, level > 0);
    }
  }

  completeQuest(completion: QuestCompletion): void {
    this.questPanel.classList.remove("quest-complete");
    requestAnimationFrame(() => this.questPanel.classList.add("quest-complete"));
    this.toast(`手冊 ${String(completion.chapter).padStart(2, "0")} 完成 · ${completion.reward}`, "warm");
    window.setTimeout(() => this.questPanel.classList.remove("quest-complete"), 760);
  }

  setPrompt(key: string, text: string, visible = true): void {
    this.prompt.innerHTML = `<kbd>${key}</kbd><span>${text}</span>`;
    this.prompt.classList.toggle("is-visible", visible);
  }

  toast(message: string, tone: "warm" | "danger" | "ice" = "warm"): void {
    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    const dot = document.createElement("i");
    const copy = document.createElement("span");
    copy.textContent = message;
    toast.append(dot, copy);
    this.toastHost.append(toast);
    window.setTimeout(() => toast.classList.add("is-out"), 2400);
    window.setTimeout(() => toast.remove(), 2900);
  }

  showResult(won: boolean, copy: string, stats: ReadonlyArray<[string, string]> = []): void {
    this.result.hidden = false;
    this.resultTitle.textContent = won ? "黎明仍在" : "最後的燈熄了";
    this.resultCopy.textContent = copy;
    this.resultStats.replaceChildren(...stats.map(([label, value]) => {
      const item = document.createElement("div");
      const small = document.createElement("small");
      const strong = document.createElement("b");
      small.textContent = label;
      strong.textContent = value;
      item.append(small, strong);
      return item;
    }));
    requestAnimationFrame(() => this.result.classList.add("is-visible"));
  }

  private waveForecast(wave: number): string {
    if (wave % 10 === 0) return "Boss · 重型群";
    if (wave >= 16) return "奔行者＋蠻屍";
    if (wave >= 6) return "行屍＋奔行者";
    return "行屍";
  }
}
