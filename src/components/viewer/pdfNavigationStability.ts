export type NavigationMode = "idle" | "user-scroll" | "programmatic-nav";

export interface ProgrammaticScrollGuardInput {
  enabled: boolean;
  now: number;
  lockoutUntil: number;
  activeToken: number | null;
  source: "toc" | "restore" | "resize" | "page-sync";
  token?: number;
}

export function deriveCurrentPageFromOffsets(
  offsets: number[],
  numPages: number,
  fallbackPage: number,
  scrollTop: number,
  viewportTopPadding = 24,
): number {
  if (offsets.length !== numPages || numPages <= 0) return fallbackPage;
  const target = scrollTop + viewportTopPadding;
  let lo = 0;
  let hi = offsets.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= target) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

export function shouldSuppressProgrammaticScroll(input: ProgrammaticScrollGuardInput): boolean {
  if (!input.enabled) return false;

  if (input.source === "toc") {
    return input.token === undefined || input.activeToken !== input.token;
  }

  if (input.activeToken !== null) {
    return true;
  }

  return input.now < input.lockoutUntil;
}

export function isStaleNavigationToken(activeToken: number | null, token: number): boolean {
  return activeToken !== token;
}

export function isNavigationSettled(deltaPx: number, onTargetPage: boolean, thresholdPx: number): boolean {
  return onTargetPage && deltaPx <= thresholdPx;
}
