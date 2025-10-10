
import type { PlayerRole } from "@/types";

export type RoleDetail = {
    name: string;
    description: string;
    atmosphere: string;
    image: string;
    color: string;
    bgImageId: string;
}

export const roleDetails: Partial<Record<NonNullable<PlayerRole>, RoleDetail>> = {
    // Aldeanos
    villager: {
        name: "Aldeano",
        description: "Eres un miembro del pueblo. Tu único poder es tu voz y tu voto. Presta atención durante el día y vota para eliminar a quienes creas que son hombres lobo.",
        atmosphere: "Tu ingenio y tu voz son tus únicas armas. Sobrevive.",
        image: "/roles/villager.png",
        color: "text-primary-foreground/80",
        bgImageId: "role-bg-villager"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche, puedes elegir a un jugador para descubrir su verdadera identidad (si es lobo o no). Usa esta información sabiamente para guiar a los aldeanos.",
        atmosphere: "Ves más allá de las apariencias. La verdad te será revelada.",
        image: "/roles/seer.png",
        color: "text-blue-400",
        bgImageId: "role-bg-seer"
    },
    doctor: {
        name: "Doctor",
        description: "Cada noche, puedes elegir a un jugador para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.",
        atmosphere: "En tus manos está el poder de dar una noche más de vida.",
        image: "/roles/doctor.png",
        color: "text-green-400",
        bgImageId: "role-bg-doctor"
    },
    hunter: {
        name: "Cazador",
        description: "Si eres eliminado (ya sea de noche o por votación), puedes disparar tu última bala y llevarte a otro jugador contigo a la tumba.",
        atmosphere: "Tu pulso es firme. Incluso en la muerte, tu puntería será certera.",
        image: "/roles/hunter.png",
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter"
    },
    guardian: {
        name: "Guardián",
        description: "Cada noche, eliges a un jugador para protegerlo. Ese jugador no podrá ser asesinado por los lobos. No puedes protegerte a ti mismo.",
        atmosphere: "Tu escudo es la última esperanza para los inocentes.",
        image: "/roles/guardian.png",
        color: "text-gray-300",
        bgImageId: "role-bg-doctor"
    },
    priest: {
        name: "Sacerdote",
        description: "Cada noche, bendices a un jugador, protegiéndolo de todo mal (ataques y veneno). Solo puedes bendecirte a ti mismo una vez por partida.",
        atmosphere: "Tu fe es un escudo impenetrable contra la oscuridad.",
        image: "/roles/priest.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    prince: {
        name: "Príncipe",
        description: "Si eres el más votado para ser linchado, revelas tu identidad y sobrevives. No puedes ser eliminado por votación diurna.",
        atmosphere: "Tu sangre real te protege del juicio de la plebe.",
        image: "/roles/Prince.png",
        color: "text-yellow-300",
        bgImageId: "role-bg-hunter" 
    },
    lycanthrope: {
        name: "Licántropo",
        description: "Eres un aldeano, pero la Vidente te ve como un lobo. Tu inocencia es tu mayor desafío.",
        atmosphere: "Marcado por la luna, pero fiel al pueblo. ¿Podrás convencerlos?",
        image: "/roles/lycanthrope.png",
        color: "text-orange-400",
        bgImageId: "role-bg-werewolf" 
    },
    twin: {
        name: "Gemelo/a",
        description: "No estás solo/a. Hay otro jugador que es tu gemelo/a. Os conocéis desde el principio y sois aliados del pueblo.",
        atmosphere: "Un vínculo inquebrantable en medio del caos.",
        image: "/roles/twin.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager" 
    },
    hechicera: {
        name: "Hechicera",
        description: "Tienes una poción para salvar a la víctima de los lobos y otra para envenenar a un jugador. Puedes usar cada una una vez por partida.",
        atmosphere: "El poder de la vida y la muerte está en tus manos.",
        image: "/roles/Witch.png", 
        color: "text-purple-400",
        bgImageId: "role-bg-werewolf" 
    },
    ancient: {
        name: "Anciano",
        description: "Sobrevives al primer ataque de los lobos. Si los lobos te matan, todos los aldeanos pierden sus poderes.",
        atmosphere: "Tu vida está ligada al destino del pueblo.",
        image: "/roles/ancient.png",
        color: "text-gray-400",
        bgImageId: "role-bg-villager"
    },
    fool: {
        name: "Tonto del Pueblo",
        description: "Tu único objetivo es ser linchado por el pueblo. Si lo consigues, ganas la partida instantáneamente.",
        atmosphere: "Tu locura es tu mayor astucia.",
        image: "/roles/fool.png",
        color: "text-lime-400",
        bgImageId: "role-bg-villager"
    },
    scapegoat: {
        name: "Chivo Expiatorio",
        description: "Si hay un empate en la votación, tú eres el linchado. Puedes decidir quién votará en la siguiente ronda.",
        atmosphere: "Siempre cargas con la culpa de los demás.",
        image: "/roles/scapegoat.png",
        color: "text-amber-600",
        bgImageId: "role-bg-villager"
    },
    savior: {
        name: "Salvador",
        description: "Cada noche, eliges a un jugador para protegerlo. No puedes proteger a la misma persona dos noches seguidas. Es similar al Doctor.",
        atmosphere: "Eres la barrera entre la vida y la muerte.",
        image: "/roles/savior.png",
        color: "text-teal-300",
        bgImageId: "role-bg-doctor"
    },
    two_sisters: {
        name: "Dos Hermanas",
        description: "Se conocen entre sí y forman parte del bando de los aldeanos. Deben trabajar juntas para sobrevivir.",
        atmosphere: "Unidas por la sangre, inseparables en la lucha.",
        image: "/roles/two_sisters.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager"
    },
    three_brothers: {
        name: "Tres Hermanos",
        description: "Se conocen entre sí y forman parte del bando de los aldeanos. Su fuerza reside en su unidad.",
        atmosphere: "La hermandad es su mayor arma.",
        image: "/roles/three_brothers.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager"
    },
    knight: {
        name: "Caballero",
        description: "Si un lobo te ataca, el lobo con menos antigüedad muere contigo. Eres una defensa letal para el pueblo.",
        atmosphere: "Tu espada está siempre lista para el último sacrificio.",
        image: "/roles/knight.png",
        color: "text-gray-200",
        bgImageId: "role-bg-hunter"
    },
    judge: {
        name: "Juez",
        description: "Una vez por partida, puedes anular una votación y forzar una segunda votación sin debate.",
        atmosphere: "Tu martillo impone el orden en el caos.",
        image: "/roles/judge.png",
        color: "text-amber-400",
        bgImageId: "role-bg-villager"
    },
    raven: {
        name: "Cuervo",
        description: "Cada noche, puedes poner una marca en un jugador. Si ese jugador es linchado, tendrá dos votos en su contra automáticamente.",
        atmosphere: "Tus susurros en la noche condenan a los culpables.",
        image: "/roles/raven.png",
        color: "text-indigo-400",
        bgImageId: "role-bg-werewolf"
    },
    fox: {
        name: "Zorro",
        description: "Cada noche, eliges a un jugador. Si ese jugador o uno de sus vecinos es un lobo, pierdes tus poderes. Si no, obtienes una pista.",
        atmosphere: "Tu astucia te permite husmear el peligro, pero a un gran riesgo.",
        image: "/roles/fox.png",
        color: "text-orange-400",
        bgImageId: "role-bg-villager"
    },
    bear_trainer: {
        name: "Domador de Osos",
        description: "Si el jugador a tu lado es un lobo, el oso gruñe al amanecer, alertando al pueblo de la proximidad del peligro.",
        atmosphere: "Tu fiel compañero percibe la maldad que se esconde a tu lado.",
        image: "/roles/bear_trainer.png",
        color: "text-yellow-700",
        bgImageId: "role-bg-villager"
    },
    actor: {
        name: "Actor",
        description: "Al inicio de la partida, recibes tres roles. Cada noche, puedes elegir uno de esos roles para actuar como tal durante el siguiente día y noche.",
        atmosphere: "El mundo es un escenario, y tú eres todos los personajes.",
        image: "/roles/actor.png",
        color: "text-cyan-400",
        bgImageId: "role-bg-seer"
    },
    // Lobos
    werewolf: {
        name: "Hombre Lobo",
        description: "Cada noche, tú y tus compañeros lobos elegís a un aldeano para eliminar. Durante el día, debéis haceros pasar por aldeanos inocentes.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        image: "/roles/werewolf.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    wolf_cub: {
        name: "Cría de Lobo",
        description: "Si mueres, la noche siguiente los lobos podrán matar a dos jugadores.",
        atmosphere: "Tu pérdida desatará la furia de la manada.",
        image: "/roles/wolf_cub.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    cursed: {
        name: "Maldito",
        description: "Empiezas como un aldeano. Si los lobos te atacan, no mueres, sino que te conviertes en un Hombre Lobo y te unes a su equipo.",
        atmosphere: "Una maldición corre por tus venas. Tu destino es incierto.",
        image: "/roles/cursed.png",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf"
    },
    great_werewolf: {
        name: "Gran Lobo Feroz",
        description: "Cada noche, además del asesinato normal, puedes matar a un jugador adicional. Eres el terror del pueblo.",
        atmosphere: "Tu hambre es insaciable, tu poder, absoluto.",
        image: "/roles/great_werewolf.png",
        color: "text-red-700",
        bgImageId: "role-bg-werewolf"
    },
    white_werewolf: {
        name: "Lobo Blanco",
        description: "Formas parte de la manada de lobos, pero tu objetivo es ser el último superviviente. Cada dos noches, puedes matar a un lobo.",
        atmosphere: "Traicionarás a los tuyos para reinar solo.",
        image: "/roles/white_werewolf.png",
        color: "text-gray-200",
        bgImageId: "role-bg-werewolf"
    },
    // Especiales
    cupid: {
        name: "Cupido",
        description: "En la primera noche, elige a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá de desamor. Tu objetivo es que sobrevivan por encima de todo.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        image: "/roles/cupid.png",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    },
    angel: {
        name: "Ángel",
        description: "Ganas si eres linchado en la primera votación. Si no, te conviertes en un simple aldeano.",
        atmosphere: "Tu objetivo es ascender a los cielos, incluso si el pueblo te condena.",
        image: "/roles/angel.png",
        color: "text-sky-300",
        bgImageId: "role-bg-seer"
    },
    thief: {
        name: "Ladrón",
        description: "Al inicio de la partida, si hay roles sin asignar, puedes ver dos de ellos y elegir uno para ti, descartando tu rol de Ladrón.",
        atmosphere: "La noche te ofrece una segunda oportunidad, una nueva identidad.",
        image: "/roles/thief.png",
        color: "text-gray-500",
        bgImageId: "role-bg-werewolf"
    },
    wild_child: {
        name: "Niño Salvaje",
        description: "Al inicio de la partida, eliges a un jugador como tu modelo a seguir. Si ese jugador muere, te conviertes en un hombre lobo.",
        atmosphere: "Tu lealtad es feroz, tu transformación, inevitable.",
        image: "/roles/wild_child.png",
        color: "text-green-600",
        bgImageId: "role-bg-villager"
    },
    piper: {
        name: "Flautista",
        description: "Cada noche, puedes encantar a dos jugadores. Ganas si todos los jugadores vivos están encantados.",
        atmosphere: "Tu melodía es irresistible, tu control, absoluto.",
        image: "/roles/piper.png",
        color: "text-violet-500",
        bgImageId: "role-bg-seer"
    },
    pyromaniac: {
        name: "Pirómano",
        description: "Cada noche, puedes rociar la casa de un jugador con gasolina. Una vez que hayas rociado al menos una casa, puedes elegir prender fuego, eliminando a todos los jugadores rociados.",
        atmosphere: "Las cenizas serán tu trono.",
        image: "/roles/pyromaniac.png",
        color: "text-red-500",
        bgImageId: "role-bg-werewolf"
    },
};

export const defaultRoleDetail: RoleDetail = {
    name: "Rol Desconocido",
    description: "Tu rol no se ha podido determinar. Por favor, contacta al administrador.",
    atmosphere: "El misterio te envuelve...",
    image: "/roles/villager.png",
    color: "text-gray-400",
    bgImageId: "role-bg-villager"
};
