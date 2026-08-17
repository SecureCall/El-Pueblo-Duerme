export type SoundCategory = 'cinematic' | 'ambience' | 'ui' | 'death' | 'victory' | 'voice';

export type SoundPolicy = {
  category: SoundCategory;
  priority: number;
  loop: boolean;
  interruptible: boolean;
  duckVoice: boolean;
  duckMusic: boolean;
  cooldownMs: number;
};

export const SOUND_REGISTRY = {
  intro_epica: { category: 'cinematic', priority: 90, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  que_comience_el_juego: { category: 'cinematic', priority: 95, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 60000 },
  noche_pueblo_duerme: { category: 'ambience', priority: 20, loop: true, interruptible: true, duckVoice: false, duckMusic: false, cooldownMs: 0 },
  dia_pueblo_despierta: { category: 'ambience', priority: 20, loop: true, interruptible: true, duckVoice: false, duckMusic: false, cooldownMs: 0 },
  inicio_debate: { category: 'cinematic', priority: 75, loop: false, interruptible: true, duckVoice: true, duckMusic: true, cooldownMs: 5000 },
  debates_empiecen: { category: 'cinematic', priority: 80, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 5000 },
  inicio_votacion: { category: 'cinematic', priority: 85, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 5000 },
  descanse_en_paz: { category: 'death', priority: 98, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 3000 },
  muerto: { category: 'death', priority: 97, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 3000 },
  muerte_vampiro: { category: 'death', priority: 98, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 3000 },
  la_ultima_bala: { category: 'death', priority: 99, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 3000 },
  victoria_lobos: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  victoria_aldeanos: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  victoria_culto: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  victoria_verdugo: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  vampiro_ha_ganado: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  ganador_ebrío: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  pescador_ganador: { category: 'victory', priority: 100, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 30000 },
  milagro: { category: 'cinematic', priority: 92, loop: false, interruptible: false, duckVoice: true, duckMusic: true, cooldownMs: 5000 },
} satisfies Record<string, SoundPolicy>;

export type SoundId = keyof typeof SOUND_REGISTRY;

export const getSoundPolicy = (id: SoundId): SoundPolicy => SOUND_REGISTRY[id];
