
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
        description: "No tienes poderes ni habilidades especiales. Tu única misión es observar, razonar y participar en los juicios del día para intentar descubrir quiénes son los hombres lobo y proteger al pueblo.",
        atmosphere: "Tu ingenio y tu voz son tus únicas armas. Sobrevive.",
        image: "/roles/villager.png",
        color: "text-white",
        bgImageId: "role-bg-villager"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche te despiertas y eliges a un jugador para investigar. El máster te revelará si esa persona es un aldeano o un lobo.",
        atmosphere: "Ves más allá de las apariencias. La verdad te será revelada.",
        image: "/roles/seer.png",
        color: "text-blue-400",
        bgImageId: "role-bg-seer"
    },
    doctor: {
        name: "Doctor",
        description: "Cada noche, puedes elegir a un jugador para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.",
        atmosphere: "En tus manos está el poder de dar una noche más de vida.",
        image: "/roles/Doctor.png",
        color: "text-green-400",
        bgImageId: "role-bg-doctor"
    },
    hunter: {
        name: "Cazador",
        description: "Si mueres, podrás llevarte a alguien contigo a la tumba. Elige con cuidado en ese último instante: puede ser tu última venganza… o un gran error.",
        atmosphere: "Tu pulso es firme. Incluso en la muerte, tu puntería será certera.",
        image: "/roles/hunter.png",
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter"
    },
    guardian: {
        name: "Guardián",
        description: "Cada noche, eliges a un jugador para proteger. Ese jugador no podrá ser asesinado por los lobos. Solo una vez por partida, puedes elegir protegerte a ti mismo.",
        atmosphere: "Tu escudo es la última esperanza para los inocentes.",
        image: "/roles/Guardian.png",
        color: "text-gray-300",
        bgImageId: "role-bg-doctor"
    },
    priest: {
        name: "Sacerdote",
        description: "Cada noche, otorgas una bendición a un jugador, protegiéndolo de cualquier tipo de ataque nocturno (lobos, venenos, etc.). Puedes rezar por ti mismo una sola vez en toda la partida.",
        atmosphere: "Tu fe es un escudo impenetrable contra la oscuridad.",
        image: "/roles/priest.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    prince: {
        name: "Príncipe",
        description: "Si el pueblo vota para lincharte, revelarás tu identidad y sobrevivirás. No puedes ser eliminado por votación, pero solo puedes usar esta habilidad una vez.",
        atmosphere: "Tu sangre real te protege del juicio de la plebe.",
        image: "/roles/Prince.png",
        color: "text-yellow-300",
        bgImageId: "role-bg-hunter" 
    },
    lycanthrope: {
        name: "Licántropo",
        description: "Eres del equipo del pueblo, pero si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.",
        atmosphere: "Marcado por la luna, pero fiel al pueblo. ¿Podrás convencerlos?",
        image: "/roles/lycanthrope.png",
        color: "text-orange-400",
        bgImageId: "role-bg-werewolf" 
    },
    twin: {
        name: "Gemela",
        description: "Al inicio de la partida, conocerás la identidad de tu gemelo/a. Si uno de los dos muere, el otro morirá de pena al instante.",
        atmosphere: "Un vínculo inquebrantable en medio del caos.",
        image: "/roles/twin.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager" 
    },
    hechicera: {
        name: "Hechicera",
        description: "Posees dos pociones de un solo uso: una de veneno para eliminar a un jugador y una de vida para salvar al objetivo de los lobos. Actúas después de los lobos.",
        atmosphere: "El poder de la vida y la muerte está en tus manos.",
        image: "/roles/Enchantress.png",
        color: "text-purple-400",
        bgImageId: "role-bg-werewolf" 
    },
    ghost: {
        name: "Fantasma",
        description: "Si mueres, podrás enviar un único mensaje anónimo de 280 caracteres a un jugador vivo de tu elección para intentar guiar al pueblo desde el más allá.",
        atmosphere: "La muerte no es el final de tu influencia.",
        image: "/roles/Ghost.png",
        color: "text-slate-400",
        bgImageId: "role-bg-villager"
    },
    virginia_woolf: {
        name: "Virginia Woolf",
        description: "En la primera noche, eliges a un jugador. Si tú mueres en cualquier momento, el jugador que elegiste morirá contigo por un vínculo misterioso.",
        atmosphere: "Un destino trágico te une a otra alma.",
        image: "/roles/Virginia Woolf.png",
        color: "text-rose-300",
        bgImageId: "role-bg-villager"
    },
    leprosa: {
        name: "Leprosa",
        description: "Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.",
        atmosphere: "Incluso en la muerte, tu maldición es un arma.",
        image: "/roles/Leper.png",
        color: "text-lime-700",
        bgImageId: "role-bg-villager"
    },
    river_siren: {
        name: "Sirena del Río",
        description: "En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.",
        atmosphere: "Tu canto doblega voluntades.",
        image: "/roles/River Siren.png",
        color: "text-cyan-400",
        bgImageId: "role-bg-seer"
    },
    lookout: {
        name: "Vigía",
        description: "Una vez por partida, puedes arriesgarte a espiar a los lobos. Tienes un 60% de éxito para descubrir sus identidades. Si fallas (40%), mueres en el intento.",
        atmosphere: "El conocimiento exige un gran riesgo.",
        image: "/roles/Watcher.png",
        color: "text-gray-400",
        bgImageId: "role-bg-seer"
    },
    troublemaker: {
        name: "Alborotador",
        description: "Una vez por partida, durante el día, puedes elegir a dos jugadores para que luchen entre sí. Ambos morirán instantáneamente.",
        atmosphere: "Siembras el caos y la discordia.",
        image: "/roles/Troublemaker.png",
        color: "text-amber-500",
        bgImageId: "role-bg-villager"
    },
    silencer: {
        name: "Silenciador",
        description: "Cada noche, eliges a un jugador para que no pueda hablar durante el debate y la votación del día siguiente.",
        atmosphere: "El silencio es tu arma más poderosa.",
        image: "/roles/Silencer.png",
        color: "text-indigo-300",
        bgImageId: "role-bg-seer"
    },
    seer_apprentice: {
        name: "Aprendiz de Vidente",
        description: "Eres un aldeano normal, pero si la Vidente muere, heredas su poder y te conviertes en la nueva Vidente a partir de la noche siguiente.",
        atmosphere: "El legado de la luz recae sobre ti.",
        image: "/roles/Apprentice Seer.png",
        color: "text-blue-300",
        bgImageId: "role-bg-seer"
    },
    elder_leader: {
        name: "Anciana Líder",
        description: "Cada noche, eliges a un jugador para exiliarlo. Ese jugador no podrá usar ninguna habilidad nocturna durante esa noche.",
        atmosphere: "Tu sabiduría ancestral interrumpe los planes de la oscuridad.",
        image: "/roles/Leader Crone.png",
        color: "text-gray-500",
        bgImageId: "role-bg-villager"
    },
    resurrector_angel: {
        name: "Ángel Resucitador",
        description: "Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida. El jugador resucitado volverá al juego con su rol original.",
        atmosphere: "Un destello de esperanza en la oscuridad. La muerte no es el final.",
        image: "/roles/angel resucitador.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    // ==== Equipo de los Lobos ====
    werewolf: {
        name: "Hombre Lobo",
        description: "Cada noche, te despiertas con tu manada para elegir a una víctima. Tu objetivo es eliminar a los aldeanos hasta que vuestro número sea igual o superior.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        image: "/roles/werewolf.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    wolf_cub: {
        name: "Cría de Lobo",
        description: "Eres un lobo joven. Si mueres, la manada se enfurecerá y podrá realizar dos asesinatos en la misma noche de tu muerte.",
        atmosphere: "Tu muerte desata la furia de la manada.",
        image: "/roles/wolf_cub.png",
        color: "text-red-400",
        bgImageId: "role-bg-werewolf"
    },
    cursed: {
        name: "Maldito",
        description: "Empiezas como un aldeano. Sin embargo, si eres atacado por los lobos, no mueres; en su lugar, te transformas en un Hombre Lobo y te unes a ellos.",
        atmosphere: "Llevas una oscuridad latente que espera el momento de despertar.",
        image: "/roles/cursed.png",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf"
    },
    witch: {
        name: "Bruja",
        description: "Eres aliada de los lobos. Cada noche, eliges a un jugador. Si eliges a la Vidente, la descubrirás, y los lobos serán informados de quién es. Desde ese momento, los lobos no podrán matarte.",
        atmosphere: "Tu magia oscura busca apagar la única luz del pueblo.",
        image: "/roles/Witch.png",
        color: "text-purple-500",
        bgImageId: "role-bg-werewolf"
    },
    seeker_fairy: {
        name: "Hada Buscadora",
        description: "Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.",
        atmosphere: "Una magia oscura que busca a su otra mitad.",
        image: "/roles/Seeker Faerie.png",
        color: "text-fuchsia-400",
        bgImageId: "role-bg-werewolf"
    },
    // ==== Roles Especiales / Neutrales ====
    cupid: {
        name: "Cupido",
        description: "Solo en la primera noche, eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. Tu trabajo termina ahí.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        image: "/roles/cupid.png",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    },
    shapeshifter: {
        name: "Cambiaformas",
        description: "En la primera noche, eliges a un jugador. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente en ella.",
        atmosphere: "Tu identidad es fluida, tu lealtad es incierta.",
        image: "/roles/Shapeshifter.png",
        color: "text-teal-300",
        bgImageId: "role-bg-villager"
    },
    drunk_man: {
        name: "Hombre Ebrio",
        description: "Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.",
        atmosphere: "Buscas la gloria en el rechazo del pueblo.",
        image: "/roles/Drunken Man.png",
        color: "text-amber-800",
        bgImageId: "role-bg-villager"
    },
    cult_leader: {
        name: "Líder del Culto",
        description: "Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo.",
        atmosphere: "Tus susurros son más peligrosos que los colmillos de un lobo.",
        image: "/roles/Cult Leader.png",
        color: "text-violet-500",
        bgImageId: "role-bg-werewolf"
    },
    fisherman: {
        name: "Pescador",
        description: "Cada noche, subes a un jugador a tu barco. Si logras tener a todos los aldeanos vivos en tu barco, ganas. Pero si pescas a un lobo, mueres.",
        atmosphere: "Un arca en medio de la tormenta, o una tumba acuática.",
        image: "/roles/Fisherman.png",
        color: "text-sky-600",
        bgImageId: "role-bg-villager"
    },
    vampire: {
        name: "Vampiro",
        description: "Juegas solo. Cada noche, muerdes a un jugador. Un jugador mordido 3 veces, muere. Si consigues 3 muertes por mordisco, ganas la partida.",
        atmosphere: "La sed de sangre es tu única guía.",
        image: "/roles/Vampire.png",
        color: "text-red-700",
        bgImageId: "role-bg-werewolf"
    },
    banshee: {
        name: "Banshee",
        description: "Cada noche, predices la muerte de un jugador. Si ese jugador muere esa misma noche (por cualquier causa), ganas un punto. Si acumulas 2 puntos, ganas la partida.",
        atmosphere: "Tu lamento no es de tristeza, es de victoria.",
        image: "/roles/Banshee.png",
        color: "text-indigo-400",
        bgImageId: "role-bg-seer"
    },
    executioner: {
        name: "Verdugo",
        description: "Al inicio de la partida se te asigna un objetivo. Tu única misión es convencer al pueblo para que lo linchen. Si lo consigues, ganas la partida en solitario.",
        atmosphere: "La justicia, por tus manos, es ciega y caprichosa.",
        image: "/roles/verdugo.png",
        color: "text-gray-400",
        bgImageId: "role-bg-hunter"
    },
    sleeping_fairy: {
        name: "Hada Durmiente",
        description: "Empiezas como Neutral. Si el Hada Buscadora te encuentra, os unís y formáis un equipo con un poder de asesinato de un solo uso. Vuestro objetivo es ser las últimas en pie.",
        atmosphere: "Duermes, esperando una conexión mágica que decidirá tu bando.",
        image: "/roles/Sleeping Faerie.png",
        color: "text-emerald-400",
        bgImageId: "role-bg-villager"
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
