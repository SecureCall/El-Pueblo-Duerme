export interface WinCheckOpts {
  enchanted?: string[];
  round?: number;
  dayEliminatedUid?: string | null;
  secondEliminatedUid?: string | null;
  eliminatedByVote?: boolean;
  perroLoboChoices?: Record<string, 'wolves' | 'village'>;
  cultMembers?: string[];
  vampiroKills?: number;
  pescadorBoat?: string[];
  hadaLinked?: boolean;
  nightKilledUids?: string[];
  lovers?: string[];
}

export interface WinResult {
  winner: string | null;
  message: string | null;
}

export function checkWinCondition(
  players: { uid: string; isAlive: boolean }[],
  roles: Record<string, string>,
  opts: WinCheckOpts = {}
): WinResult {
  const {
    enchanted = [], round = 1, dayEliminatedUid, secondEliminatedUid, eliminatedByVote,
    perroLoboChoices = {}, cultMembers = [], vampiroKills = 0,
    pescadorBoat = [], hadaLinked = false, nightKilledUids = [], lovers = [],
  } = opts;

  const effectiveRoles: Record<string, string> = { ...roles };
  for (const [uid, choice] of Object.entries(perroLoboChoices)) {
    if (choice === 'wolves') effectiveRoles[uid] = 'Lobo';
  }

  const alive = players.filter(p => p.isAlive);
  const lynched = [dayEliminatedUid, secondEliminatedUid].filter(Boolean) as string[];

  if (eliminatedByVote && round === 1 && lynched.some(uid => effectiveRoles[uid] === 'Ángel')) {
    return { winner: 'angel', message: '¡El Ángel fue ejecutado en la primera ronda y gana solo!' };
  }

  if (
    (eliminatedByVote && lynched.some(uid => effectiveRoles[uid] === 'Hombre Ebrio')) ||
    nightKilledUids.some(uid => effectiveRoles[uid] === 'Hombre Ebrio')
  ) {
    return { winner: 'ebrio', message: '¡El Hombre Ebrio lo logró! Consiguió morir como quería y gana en solitario. ¡Era su plan desde el principio!' };
  }

  const aliveWolves = alive.filter(p =>
    effectiveRoles[p.uid] === 'Lobo' || effectiveRoles[p.uid] === 'Lobo Blanco' ||
    effectiveRoles[p.uid] === 'Cría de Lobo'
  );
  const aliveVillagers = alive.filter(p =>
    effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
    effectiveRoles[p.uid] !== 'Cría de Lobo'
  );

  if (alive.length > 0 && alive.every(p => enchanted.includes(p.uid))) {
    const flautista = alive.find(p => effectiveRoles[p.uid] === 'Flautista');
    if (flautista) {
      return { winner: 'flautista', message: '¡El Flautista ha hechizado a todo el pueblo y gana solo!' };
    }
  }

  if (aliveWolves.length > 0) {
    const alivePicaros = alive.filter(p => effectiveRoles[p.uid] === 'Pícaro');
    const aliveOthers = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
      effectiveRoles[p.uid] !== 'Cría de Lobo' && effectiveRoles[p.uid] !== 'Pícaro'
    );
    if (alivePicaros.length > 0 && aliveOthers.length === 0) {
      return { winner: 'picaro', message: '¡El Pícaro ha sobrevivido hasta el final y gana solo!' };
    }
  }

  if (vampiroKills >= 3) {
    return { winner: 'vampiro', message: '¡El Vampiro ha conseguido 3 muertes por mordisco y gana solo!' };
  }

  if (alive.length > 0 && cultMembers.length > 0 && alive.every(p => cultMembers.includes(p.uid))) {
    return { winner: 'lider_culto', message: '¡El Líder del Culto ha convertido a todo el pueblo y gana solo!' };
  }

  if (pescadorBoat.length > 0) {
    const aliveVillage = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
      effectiveRoles[p.uid] !== 'Cría de Lobo' && effectiveRoles[p.uid] !== 'Pescador'
    );
    if (aliveVillage.length > 0 && aliveVillage.every(p => pescadorBoat.includes(p.uid))) {
      return { winner: 'pescador', message: '¡El Pescador ha subido a todos los aldeanos a su barco y gana solo!' };
    }
  }

  if (hadaLinked) {
    const nonHadas = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Hada Buscadora' && effectiveRoles[p.uid] !== 'Hada Durmiente'
    );
    if (nonHadas.length === 0 && alive.some(p => effectiveRoles[p.uid] === 'Hada Buscadora') &&
        alive.some(p => effectiveRoles[p.uid] === 'Hada Durmiente')) {
      return { winner: 'hadas', message: '¡Las Hadas son las últimas en pie y ganan juntas!' };
    }
  }

  if (aliveWolves.length >= aliveVillagers.length && aliveWolves.length > 0) {
    const soloLoboBlanco =
      aliveWolves.length === 1 && effectiveRoles[aliveWolves[0].uid] === 'Lobo Blanco';
    if (soloLoboBlanco) {
      return { winner: 'lobo_blanco', message: '¡El Lobo Blanco eliminó a sus propios aliados y gana en solitario!' };
    }
  }

  if (lovers.length === 2) {
    const [l1, l2] = lovers;
    const loverOneAlive = alive.some(p => p.uid === l1);
    const loverTwoAlive = alive.some(p => p.uid === l2);
    if (loverOneAlive && loverTwoAlive && alive.length === 2) {
      const r1 = effectiveRoles[l1] ?? '';
      const r2 = effectiveRoles[l2] ?? '';
      const l1IsWolf = ['Lobo', 'Lobo Blanco', 'Cría de Lobo'].includes(r1);
      const l2IsWolf = ['Lobo', 'Lobo Blanco', 'Cría de Lobo'].includes(r2);
      if (l1IsWolf !== l2IsWolf) {
        return { winner: 'lovers', message: '¡Los enamorados sobrevivieron juntos hasta el final y ganan en solitario!' };
      }
    }
  }

  if (aliveWolves.length === 0) {
    return { winner: 'village', message: '¡El pueblo ha eliminado a todos los lobos!' };
  }
  if (aliveWolves.length >= aliveVillagers.length) {
    return { winner: 'wolves', message: '¡Los lobos han devorado al pueblo!' };
  }

  return { winner: null, message: null };
}
