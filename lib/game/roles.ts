import { RoleId, Team } from './types';

export interface RoleConfig {
  id: RoleId;
  name: string;
  team: Team;
  image: string;
  description: string;
  hasNightAction: boolean;
  nightActionLabel?: string;
  firstNightOnly?: boolean;
  nightOrder: number;
  wakesWith?: RoleId[];
}

export const ROLES: Record<RoleId, RoleConfig> = {
  aldeano: { id: 'aldeano', name: 'Aldeano', team: 'aldeanos', image: '/roles/villager.png', description: 'No tienes poderes. Observa, debate y vota.', hasNightAction: false, nightOrder: 99 },
  lobo: { id: 'lobo', name: 'Hombre Lobo', team: 'lobos', image: '/roles/werewolf.png', description: 'Despierta cada noche con los otros lobos. Elige una víctima.', hasNightAction: true, nightActionLabel: 'Elegir víctima', nightOrder: 6, wakesWith: ['cria_lobo'] },
  cria_lobo: { id: 'cria_lobo', name: 'Cría de Lobo', team: 'lobos', image: '/roles/wolf_cub.png', description: 'Te despiertas con los lobos. Si mueres, la siguiente noche matan dos.', hasNightAction: true, nightActionLabel: 'Elegir víctima', nightOrder: 6, wakesWith: ['lobo'] },
  vidente: { id: 'vidente', name: 'Vidente', team: 'aldeanos', image: '/roles/seer.png', description: 'Cada noche investiga a un jugador. El narrador te dirá si es lobo, aldeano u otro.', hasNightAction: true, nightActionLabel: 'Investigar jugador', nightOrder: 8 },
  aprendiz_vidente: { id: 'aprendiz_vidente', name: 'Aprendiz de Vidente', team: 'aldeanos', image: '/roles/Apprentice Seer.png', description: 'Mientras la Vidente viva, no actúas. Si ella muere, tomas su lugar.', hasNightAction: false, nightOrder: 8 },
  guardian: { id: 'guardian', name: 'Guardián', team: 'aldeanos', image: '/roles/Guardian.png', description: 'Cada noche protege a un jugador de los lobos. Una vez por partida puedes protegerte a ti mismo.', hasNightAction: true, nightActionLabel: 'Proteger jugador', nightOrder: 3 },
  sacerdote: { id: 'sacerdote', name: 'Sacerdote', team: 'aldeanos', image: '/roles/priest.png', description: 'Cada noche bendice a un jugador. Bendecido = protección total. Una vez puedes bendecirte a ti mismo.', hasNightAction: true, nightActionLabel: 'Bendecir jugador', nightOrder: 9 },
  cazador: { id: 'cazador', name: 'Cazador', team: 'aldeanos', image: '/roles/hunter.png', description: 'Sin poderes nocturnos. Al morir, puedes llevarte a alguien contigo (última bala).', hasNightAction: false, nightOrder: 99 },
  hechicera: { id: 'hechicera', name: 'Hechicera', team: 'aldeanos', image: '/roles/Enchantress.png', description: 'Tienes 2 pociones: veneno (matar) y protección (salvar). Cada una se usa una vez.', hasNightAction: true, nightActionLabel: 'Usar poción', nightOrder: 7 },
  cupido: { id: 'cupido', name: 'Cupido', team: 'neutral', image: '/roles/cupid.png', description: 'La primera noche une a dos jugadores. Si uno muere, el otro también.', hasNightAction: true, nightActionLabel: 'Unir enamorados', nightOrder: 1, firstNightOnly: true },
  principe: { id: 'principe', name: 'Príncipe', team: 'aldeanos', image: '/roles/Prince.png', description: 'No puedes ser eliminado por votación. Si eres votado, revelas tu carta y sobrevives.', hasNightAction: false, nightOrder: 99 },
  licantropo: { id: 'licantropo', name: 'Licántropo', team: 'aldeanos', image: '/roles/lycanthrope.png', description: 'Eres aldeano, pero la Vidente te verá como lobo. Defiéndete con cuidado.', hasNightAction: false, nightOrder: 99 },
  gemela: { id: 'gemela', name: 'Gemela', team: 'aldeanos', image: '/roles/twin.png', description: 'La primera noche os despertáis para reconoceros. Tendréis vuestro propio chat.', hasNightAction: true, nightActionLabel: 'Reconocer gemela', nightOrder: 0, firstNightOnly: true, wakesWith: ['gemela'] },
  fantasma: { id: 'fantasma', name: 'Fantasma', team: 'aldeanos', image: '/roles/Ghost.png', description: 'Si mueres, puedes enviar una carta anónima a cualquier jugador vivo.', hasNightAction: false, nightOrder: 99 },
  virginia_woolf: { id: 'virginia_woolf', name: 'Virginia Woolf', team: 'aldeanos', image: '/roles/Virginia Woolf.png', description: 'La primera noche elige a un jugador. Si mueres, ese jugador muere contigo.', hasNightAction: true, nightActionLabel: 'Elegir destino compartido', nightOrder: 2, firstNightOnly: true },
  leprosa: { id: 'leprosa', name: 'Leprosa', team: 'aldeanos', image: '/roles/Leper.png', description: 'Sin poderes. Si los lobos te matan, la siguiente noche no pueden atacar a nadie.', hasNightAction: false, nightOrder: 99 },
  sirena_rio: { id: 'sirena_rio', name: 'Sirena del Río', team: 'aldeanos', image: '/roles/River Siren.png', description: 'La primera noche encanta a un jugador que deberá votar siempre como tú. La segunda noche, ese jugador te reconoce.', hasNightAction: true, nightActionLabel: 'Encantar jugador', nightOrder: 2, firstNightOnly: true },
  vigia: { id: 'vigia', name: 'Vigía', team: 'aldeanos', image: '/roles/Watcher.png', description: 'Puedes espiar cuando los lobos se despiertan. Si te descubren, mueres inmediatamente.', hasNightAction: false, nightOrder: 99 },
  alborotadora: { id: 'alborotadora', name: 'Alborotadora', team: 'aldeanos', image: '/roles/Troublemaker.png', description: 'Una vez por partida, puedes eliminar a dos jugadores a la vez, sin juicio.', hasNightAction: true, nightActionLabel: 'Provocar pelea (2 muertos)', nightOrder: 5 },
  silenciadora: { id: 'silenciadora', name: 'Silenciadora', team: 'aldeanos', image: '/roles/Silencer.png', description: 'Cada noche silencias a un jugador que no podrá hablar al día siguiente.', hasNightAction: true, nightActionLabel: 'Silenciar jugador', nightOrder: 4 },
  anciana_lider: { id: 'anciana_lider', name: 'Anciana Líder', team: 'aldeanos', image: '/roles/Leader Crone.png', description: 'Cada noche expulsa temporalmente a un jugador. Esa noche no podrá usar sus habilidades.', hasNightAction: true, nightActionLabel: 'Exiliar temporalmente', nightOrder: 4 },
  angel_resucitador: { id: 'angel_resucitador', name: 'Ángel Resucitador', team: 'aldeanos', image: '/roles/angel resucitador.png', description: 'Una vez por partida puede resucitar a un jugador recién muerto.', hasNightAction: true, nightActionLabel: 'Resucitar jugador', nightOrder: 10 },
  maldito: { id: 'maldito', name: 'Maldito', team: 'aldeanos', image: '/roles/cursed.png', description: 'Eres aldeano, pero si los lobos te atacan, te transformas en lobo.', hasNightAction: false, nightOrder: 99 },
  hada_buscadora: { id: 'hada_buscadora', name: 'Hada Buscadora', team: 'lobos', image: '/roles/Seeker Faerie.png', description: 'Cada noche buscas al Hada Durmiente. Si la encuentras, juntas podéis maldecir a alguien.', hasNightAction: true, nightActionLabel: 'Buscar hada', nightOrder: 5 },
  cambiaformas: { id: 'cambiaformas', name: 'Cambiaformas', team: 'neutral', image: '/roles/Shapeshifter.png', description: 'La primera noche elige a un jugador. Si ese jugador muere, adoptas su rol y equipo.', hasNightAction: true, nightActionLabel: 'Elegir objetivo', nightOrder: 2, firstNightOnly: true },
  hombre_ebrio: { id: 'hombre_ebrio', name: 'Hombre Ebrio', team: 'neutral', image: '/roles/Drunken Man.png', description: 'Tu objetivo es morir. Si logras ser eliminado, ganas la partida.', hasNightAction: false, nightOrder: 99 },
  hada_durmiente: { id: 'hada_durmiente', name: 'Hada Durmiente', team: 'aldeanos', image: '/roles/Sleeping Faerie.png', description: 'Si el Hada Buscadora te encuentra, cambias de bando y juntas podéis maldecir a alguien.', hasNightAction: false, nightOrder: 99 },
  vampiro: { id: 'vampiro', name: 'Vampiro', team: 'neutral', image: '/roles/Vampire.png', description: 'Cada noche convierte a un jugador en vampiro. Gana cuando todos sean vampiros.', hasNightAction: true, nightActionLabel: 'Vampirizar jugador', nightOrder: 6 },
  lider_culto: { id: 'lider_culto', name: 'Líder del Culto', team: 'neutral', image: '/roles/Cult Leader.png', description: 'Cada noche recluta a un jugador para su culto. Gana cuando todos sean del culto.', hasNightAction: true, nightActionLabel: 'Reclutar miembro', nightOrder: 6 },
  pescador: { id: 'pescador', name: 'Pescador', team: 'neutral', image: '/roles/Fisherman.png', description: 'Su objetivo es ser el último en pie. Gana si sobrevive a todos.', hasNightAction: false, nightOrder: 99 },
  banshee: { id: 'banshee', name: 'Banshee', team: 'neutral', image: '/roles/Banshee.png', description: 'Predice quién morirá. Si acierta, gana un turno extra de poder.', hasNightAction: true, nightActionLabel: 'Predecir muerte', nightOrder: 8 },
  verdugo: { id: 'verdugo', name: 'Verdugo', team: 'neutral', image: '/roles/verdugo.png', description: 'Cada día, si el jugador que él votó es eliminado, gana un punto. Gana al acumular 3.', hasNightAction: false, nightOrder: 99 },
};

export function getNightOrder(roles: RoleId[], round: number): RoleId[] {
  const present = new Set(roles);
  const unique: RoleId[] = [];
  const seen = new Set<number>();

  const ordered = Object.values(ROLES)
    .filter(r => present.has(r.id) && r.hasNightAction)
    .filter(r => round === 1 || !r.firstNightOnly)
    .sort((a, b) => a.nightOrder - b.nightOrder);

  for (const r of ordered) {
    if (!seen.has(r.nightOrder) || r.wakesWith) {
      unique.push(r.id);
      seen.add(r.nightOrder);
    }
  }

  if (present.has('lobo') || present.has('cria_lobo')) {
    if (!unique.includes('lobo')) unique.push('lobo');
  }

  return unique;
}

export function getRoleTeamForVidente(roleId: RoleId): 'lobo' | 'aldeano' | 'otro' {
  const wolfRoles: RoleId[] = ['lobo', 'cria_lobo', 'hada_buscadora'];
  const aldeanoRoles: RoleId[] = ['aldeano', 'guardian', 'sacerdote', 'cazador', 'hechicera', 'principe', 'gemela', 'fantasma', 'leprosa', 'sirena_rio', 'vigia', 'alborotadora', 'silenciadora', 'aprendiz_vidente', 'anciana_lider', 'angel_resucitador', 'virginia_woolf', 'hada_durmiente'];
  const lycanthropeRoles: RoleId[] = ['licantropo'];

  if (wolfRoles.includes(roleId) || lycanthropeRoles.includes(roleId)) return 'lobo';
  if (aldeanoRoles.includes(roleId)) return 'aldeano';
  return 'otro';
}

export function assignRoles(players: string[], wolves: number, specialRoles: RoleId[]): Record<string, RoleId> {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const assignments: Record<string, RoleId> = {};
  const rolesToAssign: RoleId[] = [];

  for (let i = 0; i < wolves; i++) rolesToAssign.push('lobo');
  for (const r of specialRoles) {
    if (ROLES[r]) rolesToAssign.push(r);
  }
  while (rolesToAssign.length < shuffled.length) rolesToAssign.push('aldeano');

  const finalRoles = rolesToAssign.sort(() => Math.random() - 0.5).slice(0, shuffled.length);
  shuffled.forEach((uid, i) => { assignments[uid] = finalRoles[i]; });
  return assignments;
}
