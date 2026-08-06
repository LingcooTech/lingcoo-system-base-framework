export interface SafeError {
  name: string;
  message: string;
}

function redactPatterns(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:password|secret|token|authorization|cookie|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgres://[REDACTED]@');
}

export function sanitizeText(value: string, secrets: readonly (string | undefined)[] = []): string {
  let result = value;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) result = result.split(secret).join('[REDACTED]');
  }
  return redactPatterns(result).slice(0, 1000);
}

export function serializeSafeError(
  error: unknown,
  secrets: readonly (string | undefined)[] = [],
): SafeError {
  return error instanceof Error
    ? { name: error.name || 'Error', message: sanitizeText(error.message, secrets) }
    : { name: 'UnknownError', message: sanitizeText(String(error), secrets) };
}

export function writeServiceLog(
  level: 'info' | 'warn' | 'error',
  service: string,
  event: string,
  context: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    ...context,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
