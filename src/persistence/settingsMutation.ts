import type { AppSettings } from '../types';

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function diffSettings(base: AppSettings, candidate: AppSettings): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(candidate)
  ] as Array<keyof AppSettings>);

  for (const key of keys) {
    if (!valuesEqual(base[key], candidate[key])) {
      (patch as Record<string, unknown>)[key as string] = candidate[key];
    }
  }

  return patch;
}

export function applySettingsPatch(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...patch
  };
}
