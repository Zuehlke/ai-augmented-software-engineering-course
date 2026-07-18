export type AccessControl = {
  labsEnabled: boolean;
  slidesEnabled: boolean;
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
    labsEnabled: parseBooleanEnv(env.VITE_LABS_ENABLED, true),
    slidesEnabled: parseBooleanEnv(env.VITE_SLIDES_ENABLED, true),
  };
}
