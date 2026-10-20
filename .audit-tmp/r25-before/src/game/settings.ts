import type { QualityPreference } from "./quality";

export const SETTINGS_KEY = "storm-apocalypse-settings-v1";
export const SETTINGS_VERSION = 1;

export interface PlayerSettings {
  version: number;
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: QualityPreference;
  screenShake: boolean;
}

export const DEFAULT_SETTINGS: Readonly<PlayerSettings> = {
  version: SETTINGS_VERSION,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  muted: false,
  quality: "auto",
  screenShake: true,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function volume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function quality(value: unknown): QualityPreference {
  return value === "low" || value === "medium" || value === "high" || value === "auto" ? value : "auto";
}

export function loadSettings(): PlayerSettings {
  try {
    const raw = record(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
    return {
      version: SETTINGS_VERSION,
      masterVolume: volume(raw.masterVolume, DEFAULT_SETTINGS.masterVolume),
      sfxVolume: volume(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      muted: typeof raw.muted === "boolean" ? raw.muted : DEFAULT_SETTINGS.muted,
      quality: quality(raw.quality),
      screenShake: typeof raw.screenShake === "boolean" ? raw.screenShake : DEFAULT_SETTINGS.screenShake,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
  } catch {
    // 設定儲存失敗不能阻斷離線遊玩。
  }
}
