
import { IRole, RoleName } from "@/types";
import { Aldeano } from "./Aldeano";
import { Medico } from "./Medico";
import { Vidente } from "./Vidente";
import { Lobo } from "./Lobo";
import { Cazador } from "./Cazador";
import { Principe } from "./Principe";
import { Sacerdote } from "./Sacerdote";
import { Guardian } from "./Guardian";
import { Licantropo } from "./Licantropo";
import { Gemela } from "./Gemela";
import { Hechicera } from "./Hechicera";
import { Fantasma } from "./Fantasma";
import { VirginiaWoolf } from "./VirginiaWoolf";
import { Leprosa } from "./Leprosa";
import { SirenaRio } from "./SirenaRio";
import { Vigia } from "./Vigia";
import { Alborotadora } from "./Alborotadora";
import { Silenciador } from "./Silenciador";
import { AprendizVidente } from "./AprendizVidente";
import { AncianaLider } from "./AncianaLider";
import { AngelResucitador } from "./AngelResucitador";
import { CriaLobo } from "./CriaLobo";
import { Maldito } from "./Maldito";
import { Bruja } from "./Bruja";
import { HadaBuscadora } from "./HadaBuscadora";
import { HadaDurmiente } from "./HadaDurmiente";
import { Cambiaformas } from "./Cambiaformas";
import { HombreEbrio } from "./HombreEbrio";
import { LiderCulto } from "./LiderCulto";
import { Pescador } from "./Pescador";
import { Vampiro } from "./Vampiro";
import { Banshee } from "./Banshee";
import { Cupido } from "./Cupido";
import { Verdugo } from "./Verdugo";

const roleMap: Record<RoleName, new () => IRole> = {
  villager: Aldeano,
  seer: Vidente,
  doctor: Medico,
  werewolf: Lobo,
  hunter: Cazador,
  prince: Principe,
  priest: Sacerdote,
  guardian: Guardian,
  lycanthrope: Licantropo,
  twin: Gemela,
  hechicera: Hechicera,
  ghost: Fantasma,
  virginia_woolf: VirginiaWoolf,
  leprosa: Leprosa,
  river_siren: SirenaRio,
  lookout: Vigia,
  troublemaker: Alborotadora,
  silencer: Silenciador,
  seer_apprentice: AprendizVidente,
  elder_leader: AncianaLider,
  resurrector_angel: AngelResucitador,
  wolf_cub: CriaLobo,
  cursed: Maldito,
  witch: Bruja,
  seeker_fairy: HadaBuscadora,
  sleeping_fairy: HadaDurmiente,
  shapeshifter: Cambiaformas,
  drunk_man: HombreEbrio,
  cult_leader: LiderCulto,
  fisherman: Pescador,
  vampire: Vampiro,
  banshee: Banshee,
  cupid: Cupido,
  executioner: Verdugo,
};

export function createRoleInstance(roleName?: RoleName | null): IRole {
  if (!roleName || !roleMap[roleName]) {
    return new Aldeano();
  }
  const RoleClass = roleMap[roleName];
  return new RoleClass();
}
