export type GamePhase = 'lobby' | 'roleReveal' | 'night' | 'day' | 'voting' | 'ended';

const ALLOWED: Record<GamePhase, readonly GamePhase[]> = {
  lobby: ['roleReveal'],
  roleReveal: ['night'],
  night: ['day', 'ended'],
  day: ['voting', 'night', 'ended'],
  voting: ['day', 'night', 'ended'],
  ended: [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: string): asserts to is GamePhase {
  if (!(from in ALLOWED) || !(to in ALLOWED) || !canTransition(from as GamePhase, to as GamePhase)) {
    throw new Error(`Invalid game phase transition: ${from} -> ${to}`);
  }
}

export function nextPhaseForTimer(phase: GamePhase): GamePhase | null {
  switch (phase) {
    case 'roleReveal': return 'night';
    case 'night': return 'day';
    case 'day': return 'voting';
    case 'voting': return 'night';
    default: return null;
  }
}
