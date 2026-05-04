import { ScheduleView } from "./ScheduleView";

/**
 * Mobile wrapper for the Schedule View.
 * Currently delegates to the main ScheduleView with isMobile=true.
 * Future: could add mobile-specific gesture handling, swipe actions, etc.
 */
export function MobileScheduleView() {
  return <ScheduleView isMobile />;
}
