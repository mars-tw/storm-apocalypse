import type { RuntimeState } from "./state";

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
  private readonly baseHealth: HTMLElement;
  private readonly baseHealthFill: HTMLElement;
  private readonly objectiveKicker: HTMLElement;
  private readonly objectiveTitle: HTMLElement;
  private readonly objectiveCopy: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly buildButton: HTMLButtonElement;
  private readonly buildLabel: HTMLElement;
  private readonly waveButton: HTMLButtonElement;
  private readonly attackButton: HTMLButtonElement;
  private readonly toastHost: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultCopy: HTMLElement;

  onStart: () => void = () => undefined;
  onAttack: () => void = () => undefined;
  onBuild: () => void = () => undefined;
  onWave: () => void = () => undefined;
  onReset: () => void = () => undefined;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="vignette"></div>
      <header class="hud hud--top">
        <div class="brand-mark">
          <span class="brand-mark__sigil">✦</span>
          <span><b>暴風啟示錄</b><small>STORM APOCALYPSE</small></span>
        </div>
        <div class="resources">
          <div class="resource resource--gold"><span>✦</span><div><small>資金</small><b id="hud-money">35</b></div></div>
          <div class="resource"><span>🥩</span><div><small>背包</small><b id="hud-meat">0 / 6</b></div></div>
          <div class="resource"><span>▤</span><div><small>攤位存貨</small><b id="hud-stock">0 / 6</b></div></div>
        </div>
        <div class="wave-chip"><small>夜襲進度</small><b id="hud-wave">黎明 · 0 / 3</b></div>
      </header>

      <aside class="objective-panel">
        <div class="objective-panel__line"><span id="objective-kicker">生存手冊 · 01</span><i></i></div>
        <h2 id="objective-title">前往東側牧場</h2>
        <p id="objective-copy">接近牛隻，按空白鍵或攻擊鍵揮動砍刀。</p>
        <div class="base-meter"><span>肉舖壁壘</span><b id="base-health">100%</b><i><em id="base-health-fill"></em></i></div>
      </aside>

      <aside class="build-panel">
        <span class="build-panel__eyebrow">防線建造</span>
        <div class="tower-icon">⌁</div>
        <div><b>獵風弩塔</b><small>自動鎖定殭屍 · 傷害 2</small></div>
        <button id="build-button"><span id="build-label">建造</span><b>✦ 60</b></button>
      </aside>

      <div class="context-prompt" id="context-prompt"><kbd>WASD</kbd><span>穿越雪地，前往牧場</span></div>

      <div class="bottom-controls">
        <div class="joystick" aria-label="移動搖桿">
          <span class="joystick__ring"></span><span class="joystick__knob"></span>
        </div>
        <button class="wave-button" id="wave-button" disabled><small>準備防守</small><b>等待弩塔完工</b></button>
        <button class="attack-button" id="attack-button" aria-label="揮砍"><span>⚔</span><small>揮砍</small></button>
      </div>

      <div class="toast-host" id="toast-host"></div>

      <section class="intro" id="intro">
        <div class="intro__weather"></div>
        <div class="intro__content">
          <span class="intro__overline">北境封鎖區 · 第 1,247 日</span>
          <h1><span>暴風</span>啟示錄</h1>
          <h2>STORM APOCALYPSE</h2>
          <p>在永夜暴雪中狩獵、經營最後一間肉舖，<br>並在鐘聲響起時守住僅存的燈火。</p>
          <div class="intro__features"><span>真實 3D 光影</span><span>經營 × 塔防</span><span>本地存檔</span></div>
          <div class="loader"><i><em id="loading-bar"></em></i><span id="loading-text">喚醒風雪…</span></div>
          <button class="start-button" id="start-button" disabled><span>踏 入 暴 風</span><small>WASD 移動 · 空白鍵揮砍</small></button>
        </div>
        <div class="intro__side"><span>THE LAST BUTCHER</span><i></i><small>TAIPEI / LOCAL SAVE</small></div>
      </section>

      <section class="result" id="result" hidden>
        <div class="result__card">
          <span>暴風戰報</span><h2 id="result-title">黎明仍在</h2><p id="result-copy"></p>
          <button id="result-button">再守一夜</button><button class="text-button" id="reset-button">清除進度</button>
        </div>
      </section>`;

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
    this.baseHealth = get("base-health");
    this.baseHealthFill = get("base-health-fill");
    this.objectiveKicker = get("objective-kicker");
    this.objectiveTitle = get("objective-title");
    this.objectiveCopy = get("objective-copy");
    this.prompt = get("context-prompt");
    this.buildButton = get("build-button");
    this.buildLabel = get("build-label");
    this.waveButton = get("wave-button");
    this.attackButton = get("attack-button");
    this.toastHost = get("toast-host");
    this.result = get("result");
    this.resultTitle = get("result-title");
    this.resultCopy = get("result-copy");

    this.startButton.addEventListener("click", () => this.onStart());
    this.attackButton.addEventListener("pointerdown", (event) => { event.preventDefault(); this.onAttack(); });
    this.buildButton.addEventListener("click", () => this.onBuild());
    this.waveButton.addEventListener("click", () => this.onWave());
    get("result-button").addEventListener("click", () => location.reload());
    get("reset-button").addEventListener("click", () => this.onReset());
  }

  setLoading(progress: number, text: string): void {
    this.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    this.loadingText.textContent = text;
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
    this.wave.textContent = state.waveActive ? `夜襲 · ${state.wave + 1} / 3 · ${state.enemiesRemaining} 敵` : `黎明 · ${state.wave} / 3`;
    this.baseHealth.textContent = `${Math.max(0, Math.round(state.baseHealth))}%`;
    this.baseHealthFill.style.width = `${Math.max(0, state.baseHealth)}%`;
    this.buildButton.disabled = state.towerBuilt || state.money < 60 || state.waveActive;
    this.buildLabel.textContent = state.towerBuilt ? "已完工" : "建造";
    this.waveButton.disabled = !state.towerBuilt || state.waveActive || state.wave >= 3;
    this.waveButton.innerHTML = !state.towerBuilt
      ? `<small>準備防守</small><b>等待弩塔完工</b>`
      : state.waveActive
        ? `<small>暴雪警報</small><b>第 ${state.wave + 1} 波交戰中</b>`
        : state.wave >= 3
          ? `<small>區域安全</small><b>三波防守完成</b>`
          : `<small>鐘聲已就緒</small><b>啟動第 ${state.wave + 1} 波夜襲</b>`;
  }

  setObjective(step: string, title: string, copy: string): void {
    this.objectiveKicker.textContent = `生存手冊 · ${step}`;
    this.objectiveTitle.textContent = title;
    this.objectiveCopy.textContent = copy;
  }

  setPrompt(key: string, text: string, visible = true): void {
    this.prompt.innerHTML = `<kbd>${key}</kbd><span>${text}</span>`;
    this.prompt.classList.toggle("is-visible", visible);
  }

  toast(message: string, tone: "warm" | "danger" | "ice" = "warm"): void {
    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    toast.innerHTML = `<i></i><span>${message}</span>`;
    this.toastHost.append(toast);
    window.setTimeout(() => toast.classList.add("is-out"), 2400);
    window.setTimeout(() => toast.remove(), 2900);
  }

  showResult(won: boolean, copy: string): void {
    this.result.hidden = false;
    this.resultTitle.textContent = won ? "黎明仍在" : "最後的燈熄了";
    this.resultCopy.textContent = copy;
    requestAnimationFrame(() => this.result.classList.add("is-visible"));
  }
}
