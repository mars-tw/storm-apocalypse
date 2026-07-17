import weatherConfig from "./weatherProfiles.json";
import type { QualityLevel } from "./quality";

export type WeatherIntensity = "low" | "medium" | "high";

export interface WeatherProfile {
  farRate: number;
  nearRate: number;
  minSize: number;
  maxSize: number;
  nearMinSize: number;
  nearMaxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  gravity: [number, number, number];
  direction1: [number, number, number];
  direction2: [number, number, number];
  color1: [number, number, number, number];
  color2: [number, number, number, number];
  fogDayAdd: number;
  fogNightAdd: number;
  contrast: number;
  exposure: number;
  veilAlpha: number;
  vignetteWeight: number;
  bloomWeight: number;
}

export const WEATHER_PROFILES = weatherConfig.intensities as Record<WeatherIntensity, WeatherProfile>;
export const WEATHER_QUALITY_DENSITY = weatherConfig.qualityDensity as Record<QualityLevel, number>;
export const WEATHER_ADAPTIVE_DENSITY = weatherConfig.adaptiveDensity as Record<"0" | "1" | "2", number>;

export function parseWeatherIntensity(value: string | null): WeatherIntensity | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

export function productionWeatherIntensity(waveActive: boolean, event: string | undefined): WeatherIntensity {
  if (!waveActive) return "low";
  if (event === "whiteout" || event === "boss") return "high";
  return "medium";
}

export function weatherBehaviorSignature(profile: WeatherProfile): string {
  return JSON.stringify({
    minSize: profile.minSize,
    maxSize: profile.maxSize,
    nearMinSize: profile.nearMinSize,
    nearMaxSize: profile.nearMaxSize,
    minLifeTime: profile.minLifeTime,
    maxLifeTime: profile.maxLifeTime,
    gravity: profile.gravity,
    direction1: profile.direction1,
    direction2: profile.direction2,
    color1: profile.color1,
    color2: profile.color2,
    fogDayAdd: profile.fogDayAdd,
    fogNightAdd: profile.fogNightAdd,
    contrast: profile.contrast,
    exposure: profile.exposure,
    veilAlpha: profile.veilAlpha,
    vignetteWeight: profile.vignetteWeight,
    bloomWeight: profile.bloomWeight,
  });
}
