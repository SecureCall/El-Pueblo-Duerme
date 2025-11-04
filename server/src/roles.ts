import { Room, Role, RoleId } from "@/types";

export const ROLES: Record<RoleId, Role> = {
    villager: { id: 'villager', name: 'Aldeano', description: 'Tu objetivo es linchar a los lobos.', hasNightAction: false, actionPrompt: '' },
    werewolf: { id: 'werewolf', name: 'Hombre Lobo', description: 'Tu objetivo es devorar a los aldeanos.', hasNightAction: true, actionPrompt: 'Elige a quién devorar esta noche.' },
    seer: { id: 'seer', name: 'Vidente', description: 'Puedes ver el rol de un jugador cada noche.', hasNightAction: true, actionPrompt: 'Elige a un jugador para revelar su verdadera identidad.' },
    // Add all other roles here...
    doctor: { id: 'doctor', name: 'Doctor', description: 'Puedes proteger a un jugador de ser atacado cada noche.', hasNightAction: true, actionPrompt: 'Elige a quién proteger esta noche.' },
    hunter: { id: 'hunter', name: 'Cazador', description: 'Si mueres, puedes llevarte a alguien contigo.', hasNightAction: false, actionPrompt: '' },
    guardian: { id: 'guardian', name: 'Guardián', description: 'Protege a un jugador cada noche. No puedes elegir al mismo dos veces seguidas.', hasNightAction: true, actionPrompt: 'Elige a un jugador para proteger con tu vida.' },
    priest: { id: 'priest', name: 'Sacerdote', description: 'Bendice a un jugador cada noche, haciéndolo inmune a todo mal.', hasNightAction: true, actionPrompt: 'Elige a quién otorgar tu bendición.' },
    prince: { id: 'prince', name: 'Príncipe', description: 'Si el pueblo te lincha, revelas tu identidad y sobrevives.', hasNightAction: false, actionPrompt: '' },
    lycanthrope: { id: 'lycanthrope', name: 'Licántropo', description: 'Eres un aldeano, pero la vidente te ve como un lobo.', hasNightAction: false, actionPrompt: '' },
    twin: { id: 'twin', name: 'Gemelo/a', description: 'Conoces a tu gemelo/a y ganáis o perdéis juntos.', hasNightAction: false, actionPrompt: '' },
    hechicera: { id: 'hechicera', name: 'Hechicera', description: 'Tienes una poción para matar y otra para salvar.', hasNightAction: true, actionPrompt: 'Elige usar una de tus pociones.' },
    ghost: { id: 'ghost', name: 'Fantasma', description: 'Al morir, puedes escribir un último mensaje a un jugador.', hasNightAction: false, actionPrompt: '' },
    virginia_woolf: { id: 'virginia_woolf', name: 'Virginia Woolf', description: 'Si mueres, la persona que elijas muere contigo.', hasNightAction: true, actionPrompt: 'Elige a quién vincular tu destino.' },
    leprosa: { id: 'leprosa', name: 'Leprosa', description: 'Si los lobos te matan, no podrán atacar la noche siguiente.', hasNightAction: false, actionPrompt: '' },
    river_siren: { id: 'river_siren', name: 'Sirena del Río', description: 'Hechizas a un jugador la primera noche para que vote contigo.', hasNightAction: true, actionPrompt: 'Elige a un jugador para hechizar con tu canto.' },
    lookout: { id: 'lookout', name: 'Vigía', description: 'Puedes ver quién visita a un jugador por la noche.', hasNightAction: true, actionPrompt: 'Elige a un jugador para vigilar esta noche.' },
    troublemaker: { id: 'troublemaker', name: 'Alborotadora', description: 'Una vez por partida, puedes hacer que dos personas se peleen a muerte.', hasNightAction: false, actionPrompt: '' },
    silencer: { id: 'silencer', name: 'Silenciador/a', description: 'Cada noche, silencias a un jugador para el día siguiente.', hasNightAction: true, actionPrompt: 'Elige a quién silenciar mañana.' },
    seer_apprentice: { id: 'seer_apprentice', name: 'Aprendiz de Vidente', description: 'Si la vidente muere, tú te conviertes en la nueva vidente.', hasNightAction: false, actionPrompt: '' },
    elder_leader: { id: 'elder_leader', name: 'Anciana Líder', description: 'Cada noche, exilias a un jugador, impidiendo que use su habilidad.', hasNightAction: true, actionPrompt: 'Elige a quién exiliar esta noche.' },
    resurrector_angel: { id: 'resurrector_angel', name: 'Ángel Resucitador', description: 'Una vez por partida, puedes resucitar a un jugador.', hasNightAction: true, actionPrompt: 'Elige a un jugador muerto para devolverle la vida.' },
    wolf_cub: { id: 'wolf_cub', name: 'Cría de Lobo', description: 'Si mueres, los lobos matan a dos personas la noche siguiente.', hasNightAction: true, actionPrompt: 'Elige a quién devorar junto a la manada.' },
    cursed: { id: 'cursed', name: 'Maldito', description: 'Si los lobos te atacan, te conviertes en uno de ellos.', hasNightAction: false, actionPrompt: '' },
    witch: { id: 'witch', name: 'Bruja', description: 'Buscas a la vidente para los lobos. Una vez la encuentras, eres inmune a ellos.', hasNightAction: true, actionPrompt: 'Busca a la vidente entre los jugadores.' },
    seeker_fairy: { id: 'seeker_fairy', name: 'Hada Buscadora', description: 'Buscas al Hada Durmiente. Si os encontráis, ganáis un poder.', hasNightAction: true, actionPrompt: 'Busca al Hada Durmiente.' },
    shapeshifter: { id: 'shapeshifter', name: 'Cambiaformas', description: 'Eliges a un jugador. Si muere, te conviertes en su rol.', hasNightAction: true, actionPrompt: 'Elige a un jugador para ligar tu destino.' },
    drunk_man: { id: 'drunk_man', name: 'Hombre Ebrio', description: 'Ganas si consigues que el pueblo te linche.', hasNightAction: false, actionPrompt: '' },
    cult_leader: { id: 'cult_leader', name: 'Líder de Culto', description: 'Conviertes a un jugador a tu culto cada noche. Ganas si todos son de tu culto.', hasNightAction: true, actionPrompt: 'Elige a un nuevo converso para tu culto.' },
    fisherman: { id: 'fisherman', name: 'Pescador', description: 'Cada noche, subes a alguien a tu barco. Ganas si salvas a todos los aldeanos.', hasNightAction: true, actionPrompt: 'Elige a quién subir a tu barco.' },
    vampire: { id: 'vampire', name: 'Vampiro', description: 'Muerdes a un jugador cada noche. Si muerdes a alguien 3 veces, muere. Ganas con 3 muertes.', hasNightAction: true, actionPrompt: 'Elige a quién morder.' },
    banshee: { id: 'banshee', name: 'Banshee', description: 'Predices la muerte de un jugador. Si aciertas 2 veces, ganas.', hasNightAction: true, actionPrompt: 'Elige a un jugador que crees que morirá esta noche.' },
    cupid: { id: 'cupid', name: 'Cupido', description: 'La primera noche, enamoras a dos jugadores. Su destino queda unido para siempre.', hasNightAction: true, actionPrompt: 'Elige a dos jugadores para enamorar.' },
    executioner: { id: 'executioner', name: 'Verdugo', description: 'Se te asigna un objetivo. Ganas si consigues que el pueblo lo linche.', hasNightAction: false, actionPrompt: '' },
    sleeping_fairy: { id: 'sleeping_fairy', name: 'Hada Durmiente', description: 'Eres neutral. Si el Hada Buscadora te encuentra, os unís.', hasNightAction: false, actionPrompt: '' },
};


// Function to assign roles to players
export function assignRoles(room: Room) {
  const players = room.players;
  const playerCount = players.length;
  
  // Basic role distribution: 1 werewolf for every 4 players, 1 seer, 1 doctor, rest villagers
  const numWerewolves = Math.max(1, Math.floor(playerCount / 4));
  const numSeers = playerCount >= 5 ? 1 : 0;
  const numDoctors = playerCount >= 6 ? 1 : 0;

  const rolePool: RoleId[] = [];
  
  for (let i = 0; i < numWerewolves; i++) rolePool.push('werewolf');
  if (numSeers) rolePool.push('seer');
  if (numDoctors) rolePool.push('doctor');
  
  while (rolePool.length < playerCount) {
    rolePool.push('villager');
  }

  // Shuffle the role pool
  for (let i = rolePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }

  // Assign roles to players
  players.forEach((player, index) => {
    const roleId = rolePool[index];
    player.role = ROLES[roleId];
  });
}
