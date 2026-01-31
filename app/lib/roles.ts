
import type { PlayerRole } from "@/types";

export type RoleDetail = {
    name: string;
    description: string;
    atmosphere: string;
    image: string;
    color: string;
    bgImageId: string;
    team: 'Aldeanos' | 'Lobos' | 'Neutral';
}

const toSlug = (name: string) => {
    return name
        .toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
};

const createRoleDetail = (details: Omit<RoleDetail, 'image'> & { name: string }): RoleDetail => ({
    ...details,
    image: `/roles/${toSlug(details.name)}.png`
});


export const roleDetails: Partial<Record<NonNullable<PlayerRole>, RoleDetail>> = {
    // ==== Equipo del Pueblo ====
    villager: createRoleDetail({
        name: "Aldeano",
        description: "No tienes poderes especiales. Tu única misión es observar, debatir y votar para linchar a los Hombres Lobo y salvar al pueblo.",
        atmosphere: "Tu ingenio y tu voz son tus únicas armas. Sobrevive.",
        color: "text-white",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    seer: createRoleDetail({
        name: "Vidente",
        description: "Cada noche, eliges a un jugador para investigar. Se te revelará si es un Hombre Lobo o no. (Los Licántropos también son vistos como lobos).",
        atmosphere: "Ves más allá de las apariencias. La verdad te será revelada.",
        color: "text-blue-400",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    doctor: createRoleDetail({
        name: "Doctor",
        description: "Cada noche, eliges a un jugador (o a ti mismo) para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.",
        atmosphere: "En tus manos está el poder de dar una noche más de vida.",
        color: "text-green-400",
        bgImageId: "role-bg-doctor",
        team: "Aldeanos",
    }),
    hunter: createRoleDetail({
        name: "Cazador",
        description: "Si mueres, ya sea de noche o linchado de día, tendrás un último disparo. Deberás elegir a otro jugador para que muera contigo. Tu disparo es ineludible.",
        atmosphere: "Incluso en la muerte, tu puntería será certera.",
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter",
        team: "Aldeanos",
    }),
    guardian: createRoleDetail({
        name: "Guardián",
        description: "Cada noche, eliges a un jugador para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas, y solo puedes protegerte a ti mismo una vez por partida.",
        atmosphere: "Tu escudo es la última esperanza para los inocentes.",
        color: "text-gray-300",
        bgImageId: "role-bg-doctor",
        team: "Aldeanos",
    }),
    priest: createRoleDetail({
        name: "Sacerdote",
        description: "Cada noche, otorgas una bendición a un jugador, protegiéndolo de cualquier ataque nocturno (lobos, venenos, etc.). Puedes bendecirte a ti mismo una sola vez por partida.",
        atmosphere: "Tu fe es un escudo impenetrable contra la oscuridad.",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    prince: createRoleDetail({
        name: "Príncipe",
        description: "Si el pueblo vota para lincharte, revelarás tu identidad y sobrevivirás, anulando la votación. Esta habilidad solo se puede usar una vez por partida.",
        atmosphere: "Tu sangre real te protege del juicio de la plebe.",
        color: "text-yellow-300",
        bgImageId: "role-bg-hunter",
        team: "Aldeanos",
    }),
    lycanthrope: createRoleDetail({
        name: "Licántropo",
        description: "Perteneces al equipo del pueblo, pero tienes sangre de lobo. Si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.",
        atmosphere: "Marcado por la luna, pero fiel al pueblo. ¿Podrás convencerlos?",
        color: "text-orange-400",
        bgImageId: "role-bg-werewolf",
        team: "Aldeanos",
    }),
    twin: createRoleDetail({
        name: "Gemela",
        description: "En la primera noche, tú y tu gemelo/a os reconoceréis. A partir de entonces, podréis hablar en un chat privado. Si uno muere, el otro morirá de pena al instante.",
        atmosphere: "Un vínculo inquebrantable en medio del caos.",
        color: "text-blue-300",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    hechicera: createRoleDetail({
        name: "Hechicera",
        description: "Posees dos pociones de un solo uso: una de veneno para eliminar a un jugador durante la noche, y una de vida para salvar al objetivo de los lobos. No puedes salvarte a ti misma.",
        atmosphere: "El poder de la vida y la muerte está en tus manos.",
        color: "text-purple-400",
        bgImageId: "role-bg-werewolf",
        team: "Aldeanos",
    }),
    ghost: createRoleDetail({
        name: "Fantasma",
        description: "Si mueres, podrás enviar un único mensaje anónimo de 280 caracteres a un jugador vivo de tu elección para intentar guiar al pueblo desde el más allá.",
        atmosphere: "La muerte no es el final de tu influencia.",
        color: "text-slate-400",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    virginia_woolf: createRoleDetail({
        name: "Virginia Woolf",
        description: "En la primera noche, eliges a un jugador para vincular tu destino. Si tú mueres en cualquier momento de la partida, la persona que elegiste también morirá automáticamente contigo.",
        atmosphere: "Un destino trágico te une a otra alma.",
        color: "text-rose-300",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    leprosa: createRoleDetail({
        name: "Leprosa",
        description: "Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.",
        atmosphere: "Incluso en la muerte, tu maldición es un arma.",
        color: "text-lime-700",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    river_siren: createRoleDetail({
        name: "Sirena del Río",
        description: "En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.",
        atmosphere: "Tu canto doblega voluntades.",
        color: "text-cyan-400",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    lookout: createRoleDetail({
        name: "Vigía",
        description: "Una vez por partida, en la noche, puedes elegir espiar a un jugador para ver quién lo visita. Si los lobos te eligen como víctima esa noche, morirás antes de ver nada.",
        atmosphere: "El conocimiento exige un gran riesgo.",
        color: "text-gray-400",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    troublemaker: createRoleDetail({
        name: "Alborotadora",
        description: "Una vez por partida, durante el día, puedes elegir a dos jugadores para que luchen entre sí. Ambos morirán instantáneamente al final de la fase de votación.",
        atmosphere: "Siembras el caos y la discordia.",
        color: "text-amber-500",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    silencer: createRoleDetail({
        name: "Silenciador",
        description: "Cada noche, eliges a un jugador. Esa persona no podrá hablar (enviar mensajes en el chat) durante todo el día siguiente.",
        atmosphere: "El silencio es tu arma más poderosa.",
        color: "text-indigo-300",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    seer_apprentice: createRoleDetail({
        name: "Aprendiz de Vidente",
        description: "Eres un aldeano normal, pero si la Vidente muere, heredas su poder y te conviertes en la nueva Vidente a partir de la noche siguiente.",
        atmosphere: "El legado de la luz recae sobre ti.",
        color: "text-blue-300",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    elder_leader: createRoleDetail({
        name: "Anciana Líder",
        description: "Cada noche, eliges a un jugador para exiliarlo. Ese jugador no podrá usar ninguna habilidad nocturna durante esa noche.",
        atmosphere: "Tu sabiduría ancestral interrumpe los planes de la oscuridad.",
        color: "text-gray-500",
        bgImageId: "role-bg-villager",
        team: "Aldeanos",
    }),
    resurrector_angel: createRoleDetail({
        name: "Ángel Resucitador",
        description: "Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida. El jugador resucitado volverá al juego con su rol original.",
        atmosphere: "Un destello de esperanza en la oscuridad. La muerte no siempre es el final.",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer",
        team: "Aldeanos",
    }),
    // ==== Equipo de los Lobos ====
    werewolf: createRoleDetail({
        name: "Hombre Lobo",
        description: "Cada noche, te despiertas con tu manada para elegir a una víctima. Tu objetivo es eliminar a los aldeanos hasta que vuestro número sea igual o superior.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf",
        team: "Lobos",
    }),
    wolf_cub: createRoleDetail({
        name: "Cría de Lobo",
        description: "Eres un lobo joven. Si mueres, la manada se enfurecerá y podrá realizar dos asesinatos en la noche siguiente a tu muerte.",
        atmosphere: "Tu muerte desata la furia de la manada.",
        color: "text-red-400",
        bgImageId: "role-bg-werewolf",
        team: "Lobos",
    }),
    cursed: createRoleDetail({
        name: "Maldito",
        description: "Empiezas como un aldeano. Sin embargo, si eres atacado por los lobos, no mueres; en su lugar, te transformas en un Hombre Lobo y te unes a ellos.",
        atmosphere: "Llevas una oscuridad latente que espera el momento de despertar.",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf",
        team: "Lobos",
    }),
    witch: createRoleDetail({
        name: "Bruja",
        description: "Eres aliada de los lobos. Cada noche, eliges a un jugador. Si eliges a la Vidente, la descubrirás y los lobos serán informados. Desde ese momento, los lobos no podrán matarte.",
        atmosphere: "Tu magia oscura busca apagar la única luz del pueblo.",
        color: "text-purple-500",
        bgImageId: "role-bg-werewolf",
        team: "Lobos",
    }),
    seeker_fairy: createRoleDetail({
        name: "Hada Buscadora",
        description: "Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.",
        atmosphere: "Una magia oscura que busca a su otra mitad.",
        color: "text-fuchsia-400",
        bgImageId: "role-bg-werewolf",
        team: "Lobos",
    }),
    // ==== Roles Especiales / Neutrales ====
    cupid: createRoleDetail({
        name: "Cupido",
        description: "Solo en la primera noche, eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. Su objetivo es sobrevivir juntos, por encima de todo.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid",
        team: "Neutral",
    }),
    shapeshifter: createRoleDetail({
        name: "Cambiaformas",
        description: "En la primera noche, eliges a un jugador. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente. Tu lealtad es incierta.",
        atmosphere: "Tu identidad es fluida, tu destino está ligado a otro.",
        color: "text-teal-300",
        bgImageId: "role-bg-villager",
        team: "Neutral",
    }),
    drunk_man: createRoleDetail({
        name: "Hombre Ebrio",
        description: "Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.",
        atmosphere: "Buscas la gloria en el rechazo del pueblo.",
        color: "text-amber-800",
        bgImageId: "role-bg-villager",
        team: "Neutral",
    }),
    cult_leader: createRoleDetail({
        name: "Líder del Culto",
        description: "Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.",
        atmosphere: "Tus susurros son más peligrosos que los colmillos de un lobo.",
        color: "text-violet-500",
        bgImageId: "role-bg-werewolf",
        team: "Neutral",
    }),
    fisherman: createRoleDetail({
        name: "Pescador",
        description: "Cada noche, subes a un jugador a tu barco. Ganas si logras tener a todos los aldeanos vivos en tu barco. Pero si pescas a un lobo, mueres.",
        atmosphere: "Un arca en medio de la tormenta, o una tumba acuática.",
        color: "text-sky-600",
        bgImageId: "role-bg-villager",
        team: "Neutral",
    }),
    vampire: createRoleDetail({
        name: "Vampiro",
        description: "Juegas solo. Cada noche, muerdes a un jugador. Un jugador mordido 3 veces, muere. Si consigues 3 muertes por mordisco, ganas la partida.",
        atmosphere: "La sed de sangre es tu única guía.",
        color: "text-red-700",
        bgImageId: "role-bg-werewolf",
        team: "Neutral",
    }),
    banshee: createRoleDetail({
        name: "Banshee",
        description: "Cada noche, predices la muerte de un jugador. Si ese jugador muere esa misma noche (por cualquier causa), ganas un punto. Ganas la partida si acumulas 2 puntos.",
        atmosphere: "Tu lamento no es de tristeza, es de victoria.",
        color: "text-indigo-400",
        bgImageId: "role-bg-seer",
        team: "Neutral",
    }),
    executioner: createRoleDetail({
        name: "Verdugo",
        description: "Al inicio se te asigna un objetivo secreto. Tu única misión es convencer al pueblo para que lo linchen. Si lo consigues, ganas la partida en solitario.",
        atmosphere: "La justicia, por tus manos, es ciega y caprichosa.",
        color: "text-gray-400",
        bgImageId: "role-bg-hunter",
        team: "Neutral",
    }),
    sleeping_fairy: createRoleDetail({
        name: "Hada Durmiente",
        description: "Empiezas como Neutral. Si el Hada Buscadora (del equipo de los lobos) te encuentra, os unís. Vuestro objetivo es ser las últimas en pie.",
        atmosphere: "Duermes, esperando una conexión mágica que decidirá tu bando.",
        color: "text-emerald-400",
        bgImageId: "role-bg-villager",
        team: "Neutral",
    }),
};

export const defaultRoleDetail: RoleDetail = {
    name: "Rol Desconocido",
    description: "Tu rol no se ha podido determinar. Por favor, contacta al administrador.",
    atmosphere: "El misterio te envuelve...",
    image: "/roles/aldeano.png",
    color: "text-gray-400",
    bgImageId: "role-bg-villager",
    team: "Aldeanos",
};
