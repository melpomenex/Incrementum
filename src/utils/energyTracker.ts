export interface EnergyLog {
  id: string;
  timestamp: string;
  energyLevel: 1 | 2 | 3 | 4 | 5;
  retention: number;
  reviewCount: number;
}

const STORAGE_KEY = "incrementum.energy-logs";

export function addEnergyLog(entry: Omit<EnergyLog, "id" | "timestamp">): EnergyLog {
  const log: EnergyLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const current = getEnergyLogs();
  const next = [log, ...current].slice(0, 500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return log;
}

export function getEnergyLogs(): EnergyLog[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function calculateEnergyCorrelation(logs: EnergyLog[]): number {
  if (logs.length < 2) return 0;
  const x = logs.map((l) => l.energyLevel);
  const y = logs.map((l) => l.retention);
  const n = logs.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, value, idx) => sum + value * y[idx], 0);
  const sumX2 = x.reduce((sum, value) => sum + value * value, 0);
  const sumY2 = y.reduce((sum, value) => sum + value * value, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (!denominator) return 0;
  return numerator / denominator;
}
