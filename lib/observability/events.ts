/**
 * Canonical telemetry contract for El Pueblo Duerme.
 *
 * This module intentionally contains no Firebase/client dependencies so the same
 * event vocabulary can be consumed by web, future native clients, server logic,
 * QA bots and the private /test control center.
 *
 * Privacy rule: never put passwords, auth tokens, full IP addresses, chat text,
 * role secrets or other unnecessary personal data in event properties.
 */

export const OBSERVABILITY_VERSION = 1 as const;

export type TelemetryPlatform = 'web' | 'android' | 'ios' | 'unknown';
export type TelemetryEnvironment = 'development' | 'preview' | 'production' | 'test';

export type GameEventName =
  | 'app_opened'
  | 'session_started'
  | 'session_ended'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'game_created'
  | 'game_joined'
  | 'game_started'
  | 'game_completed'
  | 'game_abandoned'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'host_takeover_started'
  | 'host_takeover_completed'
  | 'phase_started'
  | 'phase_completed'
  | 'vote_cast'
  | 'role_action'
  | 'player_eliminated'
  | 'tie_detected'
  | 'rematch_requested'
  | 'rematch_started'
  | 'error'
  | 'performance_sample'
  | 'ad_impression'
  | 'ad_interaction'
  | 'premium_viewed'
  | 'premium_conversion';

export interface TelemetryContext {
  schemaVersion: typeof OBSERVABILITY_VERSION;
  environment: TelemetryEnvironment;
  platform: TelemetryPlatform;
  appVersion: string;
  locale?: string;
  countryCode?: string;
  sessionId: string;
  anonymousId: string;
  gameId?: string;
  playerId?: string;
}

export interface GameEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  name: GameEventName;
  occurredAt: string;
  context: TelemetryContext;
  properties: T;
}

export type GameCreatedProperties = {
  mode?: 'casual' | 'normal' | 'chaos';
  maxPlayers?: number;
  fillWithAI?: boolean;
};

export type GameCompletedProperties = {
  durationMs?: number;
  playerCount?: number;
  winner?: 'wolves' | 'village' | 'other' | 'unknown';
  rematchAvailable?: boolean;
};

export type PhaseProperties = {
  phase: string;
  round?: number;
  durationMs?: number;
};

export type ErrorProperties = {
  code?: string;
  area?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  recoverable?: boolean;
  fingerprint?: string;
};

export type PerformanceProperties = {
  metric: 'navigation' | 'interaction' | 'network' | 'firestore' | 'render' | 'memory';
  name: string;
  valueMs?: number;
  value?: number;
};

export function createTelemetryEvent<T extends Record<string, unknown>>(
  name: GameEventName,
  context: TelemetryContext,
  properties: T = {} as T,
  occurredAt = new Date().toISOString(),
): GameEvent<T> {
  return { name, occurredAt, context, properties };
}
