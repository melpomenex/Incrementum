/**
 * Battery awareness context for adaptive behavior.
 *
 * Polls the Tauri `get_battery_state` command every 30 seconds.
 * Components can consume this to reduce animation density,
 * cap pixel ratios, or throttle expensive work when on battery.
 *
 * Design decision D3: Uses Tauri command (cross-platform) instead of
 * the deprecated navigator.getBattery() API.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { invokeCommand, isTauri } from "../lib/tauri";

export interface BatteryInfo {
  isPresent: boolean;
  level: number;       // 0.0 – 1.0
  isCharging: boolean;
}

interface BatteryContextValue {
  battery: BatteryInfo;
  /** True when running on battery (not charging) with a battery detected */
  onBattery: boolean;
}

const BATTERY_POLL_MS = 30_000; // 30 seconds

const defaultBattery: BatteryInfo = {
  isPresent: false,
  level: 1,
  isCharging: true,
};

const BatteryContext = createContext<BatteryContextValue>({
  battery: defaultBattery,
  onBattery: false,
});

export function BatteryProvider({ children }: { children: ReactNode }) {
  const [battery, setBattery] = useState<BatteryInfo>(defaultBattery);

  const fetchBattery = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const state = await invokeCommand<BatteryInfo>("get_battery_state");
      setBattery(state);
    } catch {
      // Battery command not available — stay with defaults
    }
  }, []);

  useEffect(() => {
    fetchBattery();

    // Only poll in Tauri environment
    if (!isTauri()) return;

    const timer = window.setInterval(fetchBattery, BATTERY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchBattery]);

  const onBattery = battery.isPresent && !battery.isCharging;

  return (
    <BatteryContext.Provider value={{ battery, onBattery }}>
      {children}
    </BatteryContext.Provider>
  );
}

export function useBattery(): BatteryContextValue {
  return useContext(BatteryContext);
}
