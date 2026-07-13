export type QualityLevel = "低" | "中" | "高";

export interface QualitySignals {
  smokeMode: boolean;
  userAgent: string;
  maxTouchPoints: number;
  coarsePointer: boolean;
  viewportWidth: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

function isReported(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function detectDeviceQuality(signals: QualitySignals): QualityLevel {
  if (signals.smokeMode) return "低";

  const touch = signals.maxTouchPoints > 0 || signals.coarsePointer;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(signals.userAgent)
    || /Macintosh/i.test(signals.userAgent) && signals.maxTouchPoints > 1;
  const compactTouchDevice = touch && signals.viewportWidth <= 1024;
  const cores = signals.hardwareConcurrency;
  const memory = signals.deviceMemory;
  const cpuReported = isReported(cores);
  const memoryReported = isReported(memory);
  const constrainedCpu = cpuReported && cores <= 4;
  const constrainedMemory = memoryReported && memory <= 4;

  // Device class is the primary signal. CPU or memory alone must never send a
  // desktop into the full mobile path (blob shadows, thin fog and no post FX).
  if (mobileUa || compactTouchDevice && (constrainedCpu || constrainedMemory)) return "低";
  if (!cpuReported && !memoryReported) return "中";
  if (
    signals.coarsePointer
    || compactTouchDevice
    || memoryReported && memory <= 6
    || cpuReported && cores <= 6
  ) return "中";
  return "高";
}
