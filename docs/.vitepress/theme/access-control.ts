export type AccessControl = {
  day1LabsEnabled: boolean;
  day2LabsEnabled: boolean;
  // null = no password required.
  day1Password: string | null;
  day2Password: string | null;
};

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalizedValue = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalizedValue)) return true;
  if (["false", "0", "no", "off"].includes(normalizedValue)) return false;
  return defaultValue;
}

export function resolveAccessControlFromEnv(env: Record<string, string | undefined>): AccessControl {
  return {
    day1LabsEnabled: parseBooleanEnv(env.VITE_DAY1_LABS_ENABLED, true),
    day2LabsEnabled: parseBooleanEnv(env.VITE_DAY2_LABS_ENABLED, true),
    day1Password: env.VITE_DAY1_PASSWORD || null,
    day2Password: env.VITE_DAY2_PASSWORD || null,
  };
}
