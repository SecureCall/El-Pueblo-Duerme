const ADJECTIVES = [
  'Maldita', 'Oscura', 'Olvidada', 'Silenciosa', 'Traicionera', 'Sangrienta',
  'Sombría', 'Perdida', 'Maldita', 'Misteriosa', 'Fatídica', 'Condenada',
  'Salvaje', 'Brutal', 'Siniestra', 'Cruel', 'Implacable', 'Desesperada',
  'Infame', 'Terrible', 'Lúgubre', 'Macabra', 'Abominable', 'Funesta',
];

const NOUNS = [
  'Noche', 'Traición', 'Masacre', 'Venganza', 'Secreto', 'Conspiración',
  'Batalla', 'Cacería', 'Condena', 'Caída', 'Mentira', 'Emboscada',
  'Ejecución', 'Sentencia', 'Maldición', 'Perdición', 'Agonía', 'Sombra',
  'Trampa', 'Destino', 'Pesadilla', 'Ritual', 'Purga', 'Sacrificio',
];

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRoomName(): string {
  const style = Math.random();
  const month = MONTHS[new Date().getMonth()];

  if (style < 0.35) {
    return `La ${pick(ADJECTIVES)} ${pick(NOUNS)} de ${month}`;
  } else if (style < 0.65) {
    return `${pick(NOUNS)} en el Pueblo`;
  } else if (style < 0.85) {
    return `El Pueblo ${pick(ADJECTIVES).replace('a', 'o').replace('da', 'do')}`;
  } else {
    return `La ${pick(NOUNS)} de ${month}`;
  }
}

export const PRESET_NAMES = [
  'La Gran Cacería',
  'El Pueblo Maldito',
  'Noche sin Retorno',
  'El Último Aldeano',
  'Lobos en la Sombra',
  'La Traición Final',
  'El Juicio del Pueblo',
  'Sangre en la Plaza',
];
