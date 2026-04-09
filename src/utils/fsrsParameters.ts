import { default_w, migrateParameters } from "ts-fsrs";

export const FSRS_PARAMETER_LENGTHS = [17, 19, 21] as const;
export const CANONICAL_FSRS_PARAMETER_LENGTH = 21;

export function isSupportedFsrsParameterLength(length: number): boolean {
  return FSRS_PARAMETER_LENGTHS.includes(length as (typeof FSRS_PARAMETER_LENGTHS)[number]);
}

export function normalizeFsrsParameters(weights?: number[]): number[] | undefined {
  if (!Array.isArray(weights) || !isSupportedFsrsParameterLength(weights.length)) {
    return undefined;
  }

  try {
    return [...migrateParameters(weights)];
  } catch {
    return undefined;
  }
}

export function getDefaultFsrsParameters(): number[] {
  return [...default_w];
}
