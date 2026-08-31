import type { GameEvent } from './events';

/**
 * Keys that must never be emitted as telemetry properties.
 * This is a defense-in-depth guard, not a substitute for data-minimisation.
 */
const FORBIDDEN_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'chatText',
  'messageText',
  'privateKey',
  'serviceAccount',
  'ip',
  'ipAddress',
]);

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      output[key] = sanitizeValue(child, depth + 1);
    }
    return output;
  }
  return undefined;
}

export function sanitizeTelemetryEvent<T extends Record<string, unknown>>(
  event: GameEvent<T>,
): GameEvent<Record<string, unknown>> {
  return {
    ...event,
    properties: sanitizeValue(event.properties) as Record<string, unknown>,
  };
}

/** Keep high-volume events cheap while retaining all critical diagnostics. */
export function shouldSampleEvent(name: GameEvent['name'], rate = 1): boolean {
  if (name === 'error' || name === 'game_completed' || name === 'host_takeover_started' || name === 'host_takeover_completed') {
    return true;
  }
  return Math.random() < Math.max(0, Math.min(1, rate));
}
