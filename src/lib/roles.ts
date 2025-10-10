
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
    // ==== Equipo del Pueblo ====
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
    scapegoat: {
        name: "Chivo Expiatorio",
        description: "Si la votación del día termina en empate, eres tú quien muere. Cuando mueres, puedes elegir quiénes podrán votar al día siguiente.",
        atmosphere: "Cargas con las culpas del pueblo, incluso las que no te corresponden.",
        image: "/roles/scapegoat.png",
        color: "text-amber-700",
        bgImageId: "role-bg-villager"
    },
    savior: {
        name: "Salvador",
        description: "Similar al Doctor, cada noche eliges a alguien para protegerlo del ataque de los lobos.",
        atmosphere: "Tu instinto protector es la única salvación para muchos.",
        image: "/roles/savior.png",
        color: "text-cyan-300",
        bgImageId: "role-bg-doctor"
    },
    ancient: {
        name: "Anciano",
        description: "Sobrevives al primer ataque de los lobos. Si los lobos te matan, todos los aldeanos pierden sus poderes.",
        atmosphere: "La sabiduría de tus años te hace más resistente, pero tu caída sería devastadora.",
        image: "/roles/ancient.png",
        color: "text-gray-400",
        bgImageId: "role-bg-villager"
    },
    fool: {
        name: "Tonto del Pueblo",
        description: "Tu único objetivo es ser linchado por el pueblo. Si lo consigues, ganas la partida instantáneamente.",
        atmosphere: "Tu locura es tu mayor astucia. ¿Lograrás que te condenen?",
        image: "/roles/fool.png",
        color: "text-green-500",
        bgImageId: "role-bg-villager"
    },
    angel: {
        name: "Ángel",
        description: "Tu objetivo es ser eliminado (linchado o asesinado) durante la primera ronda (primer día o primera noche). Si lo logras, ganas.",
        atmosphere: "Tu sacrificio es tu victoria. Debes caer al principio para ascender.",
        image: "/roles/angel.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    judge: {
        name: "Juez",
        description: "Una vez por partida, puedes anular una votación y ordenar que se repita.",
        atmosphere: "Tu palabra es ley. El martillo de la justicia está en tu mano.",
        image: "/roles/judge.png",
        color: "text-orange-300",
        bgImageId: "role-bg-villager"
    },
    raven: {
        name: "Cuervo",
        description: "Cada noche, puedes poner en secreto dos votos extra sobre un jugador para la votación del día siguiente.",
        atmosphere: "Tus susurros en la oscuridad siembran la discordia.",
        image: "/roles/raven.png",
        color: "text-indigo-400",
        bgImageId: "role-bg-werewolf"
    },
    knight: {
        name: "Caballero de la Espada Oxidada",
        description: "Si atacas a un lobo, mueres, pero el lobo más cercano a tu izquierda también muere.",
        atmosphere: "Tu espada está vieja, pero aún es letal para la oscuridad.",
        image: "/roles/knight.png",
        color: "text-slate-400",
        bgImageId: "role-bg-hunter"
    },
    bear_trainer: {
        name: "Domador de Osos",
        description: "Si un lobo está sentado a tu lado (izquierda o derecha), el oso ruge al principio del día, alertando al pueblo.",
        atmosphere: "Tu fiel compañero animal puede sentir la maldad cercana.",
        image: "/roles/bear_trainer.png",
        color: "text-amber-600",
        bgImageId: "role-bg-villager"
    },
     fox: {
        name: "Zorro",
        description: "Cada noche, eliges un grupo de tres jugadores (uno de ellos tú). Si hay al menos un lobo en ese grupo, pierdes tu poder. Si no, al día siguiente sabrás que son inocentes.",
        atmosphere: "Astuto y cauteloso, buscas la verdad sin caer en la trampa.",
        image: "/roles/fox.png",
        color: "text-orange-500",
        bgImageId: "role-bg-villager"
    },

    // ==== Equipo de los Lobos ====
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
        color: "text-red-400",
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
        name: "Lobo Feroz",
        description: "Mientras estés vivo, los lobos pueden matar a un jugador adicional cada noche.",
        atmosphere: "Tu presencia inspira a la manada a ser más sanguinaria.",
        image: "/roles/great_werewolf.png",
        color: "text-red-600",
        bgImageId: "role-bg-werewolf"
    },
    white_werewolf: {
        name: "Lobo Blanco",
        description: "Eres un lobo, pero tu objetivo es ser el último jugador vivo, eliminando tanto a aldeanos como a otros lobos. Puedes matar a un lobo una de cada dos noches.",
        atmosphere: "Solitario y letal, no tienes lealtad a ninguna manada.",
        image: "/roles/white_werewolf.png",
        color: "text-gray-200",
        bgImageId: "role-bg-werewolf"
    },
    
    // ==== Roles Solitarios y Otros ====
    cupid: {
        name: "Cupido",
        description: "En la primera noche, elige a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá de desamor. Tu objetivo es que sobrevivan por encima de todo.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        image: "/roles/cupid.png",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    },
    thief: {
        name: "Ladrón",
        description: "En la primera noche, si hay roles extra, puedes verlos y cambiar tu rol por uno de ellos.",
        atmosphere: "La noche te ofrece una oportunidad para cambiar tu destino.",
        image: "/roles/thief.png",
        color: "text-gray-500",
        bgImageId: "role-bg-villager"
    },
    wild_child: {
        name: "Niño Salvaje",
        description: "En la primera noche, eliges a un jugador como tu 'modelo a seguir'. Si ese jugador muere, te conviertes en un hombre lobo.",
        atmosphere: "Tu lealtad es frágil y depende de la supervivencia de tu ídolo.",
        image: "/roles/wild_child.png",
        color: "text-lime-500",
        bgImageId: "role-bg-villager"
    },
    piper: {
        name: "Flautista",
        description: "Cada noche, puedes hechizar a dos jugadores. Ganas si todos los jugadores vivos están hechizados.",
        atmosphere: "Tu melodía es irresistible. Pronto, todos bailarán a tu son.",
        image: "/roles/piper.png",
        color: "text-teal-400",
        bgImageId: "role-bg-villager"
    },
    pyromaniac: {
        name: "Pirómano",
        description: "Cada noche, puedes rociar la casa de un jugador con gasolina. Puedes elegir prender fuego a todas las casas rociadas en lugar de rociar una nueva.",
        atmosphere: "El mundo arde mejor con un poco de ayuda.",
        image: "/roles/pyromaniac.png",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf"
    },
    two_sisters: {
        name: "Dos Hermanas",
        description: "Dos jugadoras que se conocen y son aliadas. Pertenecen al bando del pueblo.",
        atmosphere: "Unidas por la sangre, lucharéis juntas por el pueblo.",
        image: "/roles/two_sisters.png",
        color: "text-sky-400",
        bgImageId: "role-bg-villager"
    },
    three_brothers: {
        name: "Tres Hermanos",
        description: "Tres jugadores que se conocen y son aliados. Pertenecen al bando del pueblo.",
        atmosphere: "La hermandad es vuestra fuerza. Protegeréis al pueblo como uno solo.",
        image: "/roles/three_brothers.png",
        color: "text-sky-500",
        bgImageId: "role-bg-villager"
    },
    actor: {
        name: "Actor",
        description: "Al principio del juego, recibes tres cartas de rol. Cada día, puedes elegir una para imitar sus poderes durante la siguiente noche.",
        atmosphere: "El escenario es tuyo, y cada noche interpretas un nuevo papel.",
        image: "/roles/actor.png",
        color: "text-purple-300",
        bgImageId: "role-bg-villager"
    }
};

export const defaultRoleDetail: RoleDetail = {
    name: "Rol Desconocido",
    description: "Tu rol no se ha podido determinar. Por favor, contacta al administrador.",
    atmosphere: "El misterio te envuelve...",
    image: "/roles/villager.png",
    color: "text-gray-400",
    bgImageId: "role-bg-villager"
};
