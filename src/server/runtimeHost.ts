export function resolveServerBindHost(
  env: Record<string, string | undefined>,
): string {
  const configured = env.TRAMA_BIND_HOST?.trim();
  return configured || '0.0.0.0';
}
