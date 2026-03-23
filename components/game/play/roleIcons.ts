export const ROLE_ICONS: Record<string, string> = {
  'Aldeano':          '/roles/villager.png',
  'Lobo':             '/roles/werewolf.png',
  'Vidente':          '/roles/seer.png',
  'Bruja':            '/roles/Witch.png',
  'Cazador':          '/roles/hunter.png',
  'Cupido':           '/roles/cupid.png',
  'Alcalde':          '/roles/Prince.png',
  'Guardián':         '/roles/Guardian.png',
  'Sacerdote':        '/roles/priest.png',
  'Niña':             '/roles/Sleeping Faerie.png',
  'Antiguo':          '/roles/Leper.png',
  'Profeta':          '/roles/Apprentice Seer.png',
  'Gemelas':          '/roles/twin.png',
  'Hermanos':         '/roles/Watcher.png',
  'Médium':           '/roles/Ghost.png',
  'Juez':             '/roles/verdugo.png',
  'Oso':              '/roles/Shapeshifter.png',
  'Ladrón':           '/roles/Troublemaker.png',
  'Alquimista':       '/roles/Doctor.png',
  'Espía':            '/roles/Silencer.png',
  'Chivo Expiatorio': '/roles/cursed.png',
  'Niño Salvaje':     '/roles/Drunken Man.png',
  'Ángel':            '/roles/angel resucitador.png',
  'Pícaro':           '/roles/River Siren.png',
  'Flautista':        '/roles/Enchantress.png',
  'Perro Lobo':       '/roles/lycanthrope.png',
  'Lobo Blanco':      '/roles/Virginia Woolf.png',
};

export function getRoleIcon(roleName: string): string {
  return ROLE_ICONS[roleName] ?? '/roles/villager.png';
}
