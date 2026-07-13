import { Vector2 } from "@babylonjs/core/Maths/math.vector";

export class InputController {
  private readonly keys = new Set<string>();
  private joystick = Vector2.Zero();
  private attackQueued = false;
  private buildQueued = false;
  private waveQueued = false;
  private joystickPointer: number | null = null;
  private joystickCenter = Vector2.Zero();
  private readonly knob: HTMLElement;

  constructor(private readonly joystickZone: HTMLElement) {
    this.knob = joystickZone.querySelector<HTMLElement>(".joystick__knob")!;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    joystickZone.addEventListener("pointerdown", this.onJoystickDown);
    joystickZone.addEventListener("pointermove", this.onJoystickMove);
    joystickZone.addEventListener("pointerup", this.onJoystickUp);
    joystickZone.addEventListener("pointercancel", this.onJoystickUp);
  }

  get movement(): Vector2 {
    const keyboard = new Vector2(
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")),
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")),
    );
    const combined = keyboard.add(this.joystick);
    return combined.lengthSquared() > 1 ? combined.normalize() : combined;
  }

  queueAttack(): void {
    this.attackQueued = true;
  }

  queueBuild(): void {
    this.buildQueued = true;
  }

  queueWave(): void {
    this.waveQueued = true;
  }

  consumeAttack(): boolean {
    const value = this.attackQueued;
    this.attackQueued = false;
    return value;
  }

  consumeBuild(): boolean {
    const value = this.buildQueued;
    this.buildQueued = false;
    return value;
  }

  consumeWave(): boolean {
    const value = this.waveQueued;
    this.waveQueued = false;
    return value;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat && (event.code === "Space" || event.code === "KeyE")) this.attackQueued = true;
    if (!event.repeat && event.code === "KeyB") this.buildQueued = true;
    if (!event.repeat && event.code === "KeyN") this.waveQueued = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onJoystickDown = (event: PointerEvent): void => {
    this.joystickPointer = event.pointerId;
    this.joystickZone.setPointerCapture(event.pointerId);
    const bounds = this.joystickZone.getBoundingClientRect();
    this.joystickCenter.set(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    this.updateJoystick(event);
  };

  private readonly onJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointer) this.updateJoystick(event);
  };

  private readonly onJoystickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    this.joystickPointer = null;
    this.joystick.setAll(0);
    this.knob.style.transform = "translate3d(0, 0, 0)";
  };

  private updateJoystick(event: PointerEvent): void {
    const raw = new Vector2(event.clientX - this.joystickCenter.x, event.clientY - this.joystickCenter.y);
    const radius = this.joystickZone.clientWidth * 0.34;
    const distance = Math.min(raw.length(), radius);
    const direction = raw.lengthSquared() > 0 ? raw.normalize() : Vector2.Zero();
    const visual = direction.scale(distance);
    this.joystick.set(direction.x * (distance / radius), -direction.y * (distance / radius));
    this.knob.style.transform = `translate3d(${visual.x}px, ${visual.y}px, 0)`;
  }
}
