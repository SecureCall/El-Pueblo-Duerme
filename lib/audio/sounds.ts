export type MusicTrack = 'menu' | 'lobby' | 'night' | 'day' | 'rooster';
export type VoiceLine =
  | 'el-pueblo-duerme'
  | 'que-comience-el-juego'
  | 'pueblo-despierta'
  | 'dia-pueblo-despierta'
  | 'noche-pueblo-duerme'
  | 'aldea-perecera'
  | 'anuncio-exilio'
  | 'debate'
  | 'debates-empiecen'
  | 'descanse-en-paz'
  | 'desterrado-por-el-pueblo'
  | 'el-peligro-esta-aqui'
  | 'el-vampiro-ha-ganado'
  | 'ganador-el-ebrio'
  | 'inicio-debate'
  | 'inicio-votacion'
  | 'intro-epica'
  | 'la-ultima-bala'
  | 'muerte-vampiro'
  | 'muerto'
  | 'pescador-ganador'
  | 'salas'
  | 'victoria-culto'
  | 'victoria-el-berdugo'
  | 'victoria-aldeanos'
  | 'victoria-lobos'
  | 'milagro';

export const MUSIC_FILES: Record<MusicTrack, string> = {
  menu: '/audio/menu-theme.mp3',
  lobby: '/audio/lobby-theme.mp3',
  night: '/audio/night-theme.mp3',
  day: '/audio/day-theme.mp3',
  rooster: '/audio/rooster-crowing-364473.mp3',
};

export const VOICE_FILES: Record<VoiceLine, string> = {
  'el-pueblo-duerme': '/audio/voz/El pueblo... duerme.mp3',
  'que-comience-el-juego': '/audio/voz/Que comience el juego..mp3',
  'pueblo-despierta': '/audio/voz/¡Pueblo... despierta!.mp3',
  'dia-pueblo-despierta': '/audio/voz/dia_pueblo_despierta.mp3',
  'noche-pueblo-duerme': '/audio/voz/noche_pueblo_duerme.mp3',
  'aldea-perecera': '/audio/voz/aldea perecerá.mp3',
  'anuncio-exilio': '/audio/voz/anuncio_exilio.mp3',
  'debate': '/audio/voz/debate.mp3',
  'debates-empiecen': '/audio/voz/debates empiecen.mp3',
  'descanse-en-paz': '/audio/voz/Descanse en paz.mp3',
  'desterrado-por-el-pueblo': '/audio/voz/destarrado por el pueblo.mp3',
  'el-peligro-esta-aqui': '/audio/voz/el peligro está aquí.mp3',
  'el-vampiro-ha-ganado': '/audio/voz/el vampiro ha ganado .mp3',
  'ganador-el-ebrio': '/audio/voz/ganador el ebrio.mp3',
  'inicio-debate': '/audio/voz/inicio_debate.mp3',
  'inicio-votacion': '/audio/voz/inicio_votacion.mp3',
  'intro-epica': '/audio/voz/intro_epica.mp3',
  'la-ultima-bala': '/audio/voz/la ultima bala.mp3',
  'muerte-vampiro': '/audio/voz/muerte vampiro.mp3',
  'muerto': '/audio/voz/muerto.mp3',
  'pescador-ganador': '/audio/voz/pescador ganador.mp3',
  'salas': '/audio/voz/salas.mp3',
  'victoria-culto': '/audio/voz/victoria culto.mp3',
  'victoria-el-berdugo': '/audio/voz/victoria el berdugo.mp3',
  'victoria-aldeanos': '/audio/voz/victoria_aldeanos.mp3',
  'victoria-lobos': '/audio/voz/victoria_lobos.mp3',
  'milagro': '/audio/voz/¡Milagro!.mp3',
};
