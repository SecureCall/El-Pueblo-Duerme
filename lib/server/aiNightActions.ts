export interface AiNightPlayer {
  uid: string;
  isAlive: boolean;
  isAI?: boolean;
}

export interface AiNightAction {
  action: string;
  targetUid?: string;
  targetUids?: string[];
  value?: string | boolean | number | null;
}

export interface AiNightContext {
  gameId: string;
  roundNumber: number;
  players: AiNightPlayer[];
  roles: Record<string, string>;
  criaLoboRage?: boolean;
  lobosBlocked?: boolean;
}

/**
 * Generates safe, deterministic AI night submissions from authoritative state.
 * No Firestore writes happen here, so retries cannot create divergent decisions.
 */
export function generateAiNightActions(context: AiNightContext): Record<string, AiNightAction[]> {
  const alive = context.players.filter((player) => player.isAlive);
  const wolves = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
  const result: Record<string, AiNightAction[]> = {};

  const pick = (candidates: AiNightPlayer[], seed: string): AiNightPlayer | null => {
    if (candidates.length === 0) return null;
    let hash = 2166136261;
    for (const char of seed) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const index = (hash >>> 0) % candidates.length;
    return [...candidates].sort((a, b) => a.uid.localeCompare(b.uid))[index] ?? null;
  };

  for (const actor of alive) {
    if (!actor.isAI) continue;
    const role = context.roles[actor.uid] ?? '';
    const nonWolves = alive.filter((player) => player.uid !== actor.uid && !wolves.has(context.roles[player.uid] ?? ''));
    const otherAlive = alive.filter((player) => player.uid !== actor.uid);
    const seed = `${context.gameId}:${context.roundNumber}:${actor.uid}:${role}`;
    const target = pick(otherAlive, seed);
    const wolfTarget = pick(nonWolves, `${seed}:wolf`);

    let actions: AiNightAction[] = [];

    switch (role) {
      case 'Lobo':
      case 'Lobo Blanco':
      case 'Cría de Lobo':
        if (context.lobosBlocked) break;
        if (wolfTarget) actions.push({ action: 'wolfTarget', targetUid: wolfTarget.uid });
        if (role === 'Lobo Blanco' && context.roundNumber % 2 === 0 && wolfTarget) {
          const second = pick(nonWolves.filter((player) => player.uid !== wolfTarget.uid), `${seed}:white`);
          if (second) actions.push({ action: 'loboBlancoCide', targetUid: second.uid });
        }
        if (role === 'Cría de Lobo' && context.criaLoboRage) {
          const second = pick(nonWolves.filter((player) => player.uid !== wolfTarget?.uid), `${seed}:rage`);
          if (second) actions.push({ action: 'wolfTarget2', targetUid: second.uid });
        }
        break;
      case 'Vidente':
        if (target) actions.push({ action: 'seerTarget', targetUid: target.uid });
        break;
      case 'Profeta':
        if (target) actions.push({ action: 'profetaTarget', targetUid: target.uid });
        break;
      case 'Guardián':
        if (target) actions.push({ action: 'guardianTarget', targetUid: target.uid });
        break;
      case 'Doctor':
        if (target) actions.push({ action: 'doctorTarget', targetUid: target.uid });
        break;
      case 'Bruja':
        if (target) actions.push({ action: 'brujaTarget', targetUid: target.uid });
        break;
      case 'Cupido': {
        const candidates = otherAlive.sort((a, b) => a.uid.localeCompare(b.uid));
        if (candidates.length >= 2) {
          const first = pick(candidates, `${seed}:cupid1`);
          const second = pick(candidates.filter((player) => player.uid !== first?.uid), `${seed}:cupid2`);
          if (first && second) actions.push({ action: 'cupidTargets', targetUids: [first.uid, second.uid] });
        }
        break;
      }
      case 'Flautista': {
        const candidates = otherAlive.sort((a, b) => a.uid.localeCompare(b.uid));
        if (candidates.length >= 2) {
          const first = pick(candidates, `${seed}:flute1`);
          const second = pick(candidates.filter((player) => player.uid !== first?.uid), `${seed}:flute2`);
          if (first && second) actions.push({ action: 'flautistaTargets', targetUids: [first.uid, second.uid] });
        }
        break;
      }
      case 'Perro Lobo':
        actions.push({ action: 'perroLoboSide', value: (pick([actor, ...otherAlive], `${seed}:side`)?.uid === actor.uid) ? 'wolves' : 'village' });
        break;
      case 'Niño Salvaje':
      case 'Cambiaformas':
      case 'Virginia Woolf':
      case 'Sirena del Río':
      case 'Líder del Culto':
      case 'Pescador':
      case 'Vampiro':
      case 'Hada Buscadora':
      case 'Médico Forense':
      case 'Saboteador':
      case 'Silenciadora':
      case 'Sacerdote':
      case 'Ladrón':
      case 'Anciana Líder':
      case 'Ángel Resucitador':
        if (target) {
          const actionByRole: Record<string, string> = {
            'Niño Salvaje': 'salvajeMentor',
            Cambiaformas: 'cambiaformasTarget',
            'Virginia Woolf': 'virginiawoolTarget',
            'Sirena del Río': 'sirenaTarget',
            'Líder del Culto': 'liderCultoTarget',
            Pescador: 'pescadorTarget',
            Vampiro: 'vampiroTarget',
            'Hada Buscadora': 'hadaBuscadoraTarget',
            'Médico Forense': 'forenseTarget',
            Saboteador: 'saboteadorTarget',
            Silenciadora: 'silenciadoraTarget',
            Sacerdote: 'sacerdoteTarget',
            Ladrón: 'ladronTarget',
            'Anciana Líder': 'ancianaTarget',
            'Ángel Resucitador': 'angelResucitarTarget',
          };
          const action = actionByRole[role];
          if (action) actions.push({ action, targetUid: target.uid });
        }
        break;
      case 'Vigía':
        actions.push({ action: 'vigiaActivate', value: true });
        break;
      case 'Espía':
        actions.push({ action: 'espiaActivate', value: true });
        break;
      case 'Banshee':
        if (target) actions.push({ action: 'bansheePrediction', targetUid: target.uid });
        break;
      default:
        break;
    }

    result[actor.uid] = actions.length > 0 ? actions : [{ action: '_skip' }];
  }

  return result;
}
