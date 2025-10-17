
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
        color: "text-primary-foreground/80",
        bgImageId: "role-bg-villager"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche te despiertas y eliges a un jugador para investigar. El máster te revelará si esa persona es un aldeano, un lobo, o ninguno de los dos (es decir, una carta verde o morada, perteneciente a roles especiales o neutrales).",
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
        description: "Si un lobo, criatura o incluso el propio pueblo te elimina, podrás llevarte a alguien contigo a la tumba. Elige con cuidado en ese último instante: puede ser tu última venganza… o un gran error.",
        atmosphere: "Tu pulso es firme. Incluso en la muerte, tu puntería será certera.",
        image: "/roles/hunter.png",
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter"
    },
    guardian: {
        name: "Guardián",
        description: "Cada noche, te despiertas cuando el máster te lo indique y eliges a un jugador para proteger. Ese jugador no podrá ser asesinado por los lobos ni afectado por habilidades de otras criaturas del equipo rojo durante esa noche. Solo una vez por partida, puedes elegir protegerte a ti mismo.",
        atmosphere: "Tu escudo es la última esperanza para los inocentes.",
        image: "/roles/Guardian.png",
        color: "text-gray-300",
        bgImageId: "role-bg-doctor"
    },
    priest: {
        name: "Sacerdote",
        description: "Cada noche, te despiertas para otorgar una bendición a un jugador. La persona bendecida estará protegida contra cualquier tipo de ataque, incluyendo hechizos, venenos, habilidades especiales o ataques de los lobos. Puedes rezar por ti mismo una sola vez en toda la partida.",
        atmosphere: "Tu fe es un escudo impenetrable contra la oscuridad.",
        image: "/roles/priest.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    prince: {
        name: "Príncipe",
        description: "Si eres juzgado por el pueblo y sentenciado a la horca, revelarás tu carta al resto de los jugadores y permanecerás vivo. No puedes ser eliminado por votación.",
        atmosphere: "Tu sangre real te protege del juicio de la plebe.",
        image: "/roles/Prince.png",
        color: "text-yellow-300",
        bgImageId: "role-bg-hunter" 
    },
    lycanthrope: {
        name: "Licántropo",
        description: "Eres parte del pueblo, pero si la Vidente te observa durante la noche, te verá como si fueras un lobo, aunque en realidad eres un aldeano.",
        atmosphere: "Marcado por la luna, pero fiel al pueblo. ¿Podrás convencerlos?",
        image: "/roles/lycanthrope.png",
        color: "text-orange-400",
        bgImageId: "role-bg-werewolf" 
    },
    twin: {
        name: "Gemelas",
        description: "No tienes acciones especiales ni te despiertas durante la noche, excepto la primera noche, cuando te despiertas junto a tu otra gemela para reconoceros.",
        atmosphere: "Un vínculo inquebrantable en medio del caos.",
        image: "/roles/twin.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager" 
    },
    hechicera: {
        name: "Hechicera",
        description: "Te despiertas todas las noches hasta que hayas utilizado tus dos pociones: una de veneno para eliminar a un jugador, y una de protección para evitar que alguien muera. No puedes usar la poción de protección en ti misma.",
        atmosphere: "El poder de la vida y la muerte está en tus manos.",
        image: "/roles/Enchantress.png",
        color: "text-purple-400",
        bgImageId: "role-bg-werewolf" 
    },
    ghost: {
        name: "Fantasma",
        description: "Si mueres, podrás enviar una carta escrita a un jugador de tu elección. No puedes revelar roles directamente, pero puedes insinuar, sugerir o sembrar dudas. Tu objetivo sigue siendo ayudar al pueblo… incluso desde el más allá.",
        atmosphere: "Tu objetivo sigue siendo ayudar al pueblo… incluso desde el más allá.",
        image: "/roles/Ghost.png",
        color: "text-slate-400",
        bgImageId: "role-bg-villager"
    },
    virginia_woolf: {
        name: "Virginia Woolf",
        description: "Solo te despiertas la primera noche para elegir a un jugador. Si mueres en cualquier momento de la partida, la persona que elegiste también morirá automáticamente contigo.",
        atmosphere: "Un vínculo de vida o muerte te une a otro destino.",
        image: "/roles/Virginia Woolf.png",
        color: "text-rose-300",
        bgImageId: "role-bg-villager"
    },
    leprosa: {
        name: "Leprosa",
        description: "Si eres asesinada por los lobos durante la noche, tu enfermedad se extenderá, y como consecuencia, los lobos no podrán atacar a nadie en la noche siguiente.",
        atmosphere: "Tu carta actúa como una trampa silenciosa: si te eligen, pagarán el precio.",
        image: "/roles/Leper.png",
        color: "text-lime-700",
        bgImageId: "role-bg-villager"
    },
    river_siren: {
        name: "Sirena del Río",
        description: "La primera noche, eliges a un jugador para hechizarlo. Desde ese momento, será fiel a ti y deberá votar lo mismo que tú durante cada juicio del día. Si hechizas a un lobo, intentará asesinarte.",
        atmosphere: "Usa tu canto con inteligencia… el poder de la sirena puede cambiarlo todo.",
        image: "/roles/River Siren.png",
        color: "text-cyan-400",
        bgImageId: "role-bg-seer"
    },
    lookout: {
        name: "Vigía",
        description: "Puedes arriesgarte una vez por partida a espiar a los lobos durante la noche. Si tienes éxito, conocerás sus identidades. Si fallas, te descubrirán y morirás.",
        atmosphere: "Una carta silenciosa pero muy poderosa... si sabes usarla bien.",
        image: "/roles/Watcher.png",
        color: "text-gray-400",
        bgImageId: "role-bg-seer"
    },
    troublemaker: {
        name: "Alborotadora",
        description: "Solo una vez por partida, puedes provocar una pelea entre dos jugadores, lo que causará que ambos sean eliminados inmediatamente, sin posibilidad de defensa ni juicio.",
        atmosphere: "Eres quien siembra el caos en el pueblo. Elige bien cuándo actuar.",
        image: "/roles/Troublemaker.png",
        color: "text-amber-500",
        bgImageId: "role-bg-villager"
    },
    silencer: {
        name: "Silenciadora",
        description: "Cada noche te despiertas y eliges a una persona para silenciar. Esa persona no podrá hablar durante el juicio del día siguiente.",
        atmosphere: "Silenciar al jugador correcto puede protegerte o exponer a un enemigo.",
        image: "/roles/Silencer.png",
        color: "text-indigo-300",
        bgImageId: "role-bg-seer"
    },
    seer_apprentice: {
        name: "Aprendiz de Vidente",
        description: "Mientras la vidente siga con vida, no tienes acciones especiales. Pero si la vidente muere, tomarás su lugar y comenzarás a investigar cada noche.",
        atmosphere: "Eres una carta paciente, pero clave cuando todo parece perdido.",
        image: "/roles/Apprentice Seer.png",
        color: "text-blue-300",
        bgImageId: "role-bg-seer"
    },
    elder_leader: {
        name: "Anciana Líder",
        description: "Cada noche eliges a un jugador. Esa persona será expulsada temporalmente de la aldea durante la siguiente noche: no podrá usar sus habilidades nocturnas.",
        atmosphere: "Eres una figura de autoridad que puede alterar el curso de la partida sin matar a nadie.",
        image: "/roles/Leader Crone.png",
        color: "text-gray-500",
        bgImageId: "role-bg-villager"
    },
    sleeping_fairy: {
        name: "Hada Durmiente",
        description: "Eres del equipo de los aldeanos. Si durante la partida eres descubierta por el Hada del equipo de los lobos, cambiarás de bando y te unirás a los lobos para maldecir y matar.",
        atmosphere: "Una transformación que puede dar un giro total a la partida.",
        image: "/roles/Sleeping Faerie.png",
        color: "text-emerald-400",
        bgImageId: "role-bg-villager"
    },
    // ==== Equipo de los Lobos ====
    werewolf: {
        name: "Hombre Lobo",
        description: "Te despiertas todas las noches para elegir a una víctima. Tu objetivo es devorar a alguien cada noche y acabar con el pueblo poco a poco, sin ser descubierto.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        image: "/roles/werewolf.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    wolf_cub: {
        name: "Cría de Lobo",
        description: "Te despiertas cada noche junto al Hombre Lobo. Si eres eliminado, la noche siguiente a tu muerte, el Hombre Lobo devorará a dos personas en lugar de una.",
        atmosphere: "Una carta de venganza silenciosa que castiga duramente al pueblo si no te descubren a tiempo.",
        image: "/roles/wolf_cub.png",
        color: "text-red-400",
        bgImageId: "role-bg-werewolf"
    },
    cursed: {
        name: "Maldito",
        description: "Eres un aldeano, pero si un lobo te ataca, te transformarás en un Hombre Lobo y te unirás a su equipo, despertándote cada noche para devorar junto a ellos.",
        atmosphere: "Una carta traicionera, perfecta para sembrar la duda incluso entre los aliados.",
        image: "/roles/cursed.png",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf"
    },
    seeker_fairy: {
        name: "Hada Buscadora",
        description: "Te despiertas todas las noches para intentar encontrar a la otra hada. Si os encontráis, podréis lanzar una maldición para matar a un jugador (una sola vez). Puedes ser atacada.",
        atmosphere: "Un rol mágico y sigiloso que puede cambiar el destino con un solo hechizo.",
        image: "/roles/Seeker Faerie.png",
        color: "text-fuchsia-400",
        bgImageId: "role-bg-werewolf"
    },
    witch: {
        name: "Bruja",
        description: "Cada noche te despiertas para cazar a la Vidente. Si la encuentras, el máster te revelará su identidad y podrás entregarla a los lobos. Desde ese momento, los lobos sabrán quién eres y no te atacarán.",
        atmosphere: "Una aliada oscura, silenciosa y letal. Tu misión: borrar la luz del pueblo antes de que te descubran.",
        image: "/roles/Witch.png",
        color: "text-purple-500",
        bgImageId: "role-bg-werewolf"
    },
    // ==== Roles Especiales ====
    cupid: {
        name: "Cupido",
        description: "Solo te despiertas la primera noche. Eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. El amor no entiende de bandos.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        image: "/roles/cupid.png",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    },
    shapeshifter: {
        name: "Cambiaformas",
        description: "Te despiertas solo la primera noche para elegir a una persona. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente en ella.",
        atmosphere: "Una carta extremadamente versátil que puede alterar por completo el rumbo de la partida.",
        image: "/roles/Shapeshifter.png",
        color: "text-teal-300",
        bgImageId: "role-bg-villager"
    },
    drunk_man: {
        name: "Hombre Ebrio",
        description: "No tienes acciones nocturnas. Tu objetivo secreto es simple: morir. Debes lograr que te voten o que los lobos te asesinen. Ganas la partida si logras ser eliminado.",
        atmosphere: "Un rol solitario, caótico y muy divertido que pone a prueba tu astucia.",
        image: "/roles/Drunken Man.png",
        color: "text-amber-800",
        bgImageId: "role-bg-villager"
    },
    cult_leader: {
        name: "Líder del culto",
        description: "Te despiertas todas las noches para elegir a un jugador y unirlo a tu culto. Tu objetivo es convertir a todos los jugadores de la partida en miembros de tu culto. Si lo logras, ganas automáticamente.",
        atmosphere: "Un rol estratégico y persuasivo que puede cambiar el destino de todo el pueblo.",
        image: "/roles/Cult Leader.png",
        color: "text-violet-500",
        bgImageId: "role-bg-werewolf"
    },
    fisherman: {
        name: "Pescador",
        description: "Te despiertas todas las noches para elegir a un jugador, que irá contigo a tu barco. Tu objetivo es subir a todos los aldeanos a tu barco. Si lo consigues, ganas. Si eliges a un lobo, este te mata.",
        atmosphere: "Un rol arriesgado que exige buena intuición y mucha cautela.",
        image: "/roles/Fisherman.png",
        color: "text-sky-600",
        bgImageId: "role-bg-villager"
    },
    vampire: {
        name: "Vampiro",
        description: "Cada noche te despiertas para chupar la sangre de un jugador. Si chupas la sangre de la misma persona tres veces, esa persona muere. Si consigues asesinar a 3 jugadores, ganas la partida.",
        atmosphere: "Un rol sigiloso y letal, capaz de cambiar el rumbo del juego sin que nadie lo note.",
        image: "/roles/Vampire.png",
        color: "text-red-700",
        bgImageId: "role-bg-werewolf"
    },
    banshee: {
        name: "Banshee",
        description: "Te despiertas una vez por partida para lanzar tu grito y señalar a un jugador. Si muere esa noche o al día siguiente, podrás lanzar un último grito en otra noche. Si aciertas ambas veces, ganas.",
        atmosphere: "Tu grito no mata. Tu grito sentencia. Una presencia maldita que anticipa la muerte.",
        image: "/roles/Banshee.png",
        color: "text-indigo-400",
        bgImageId: "role-bg-seer"
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
