
import { IRole, PlayerRole, PlayerRoleEnum } from "@/types";
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

const roleMap: Record<PlayerRoleEnum, new () => IRole> = {
  [PlayerRoleEnum.villager]: Aldeano,
  [PlayerRoleEnum.seer]: Vidente,
  [PlayerRoleEnum.doctor]: Medico,
  [PlayerRoleEnum.werewolf]: Lobo,
  [PlayerRoleEnum.hunter]: Cazador,
  [PlayerRoleEnum.prince]: Principe,
  [PlayerRoleEnum.priest]: Sacerdote,
  [PlayerRoleEnum.guardian]: Guardian,
  [PlayerRoleEnum.lycanthrope]: Licantropo,
  [PlayerRoleEnum.twin]: Gemela,
  [PlayerRoleEnum.hechicera]: Hechicera,
  [PlayerRoleEnum.ghost]: Fantasma,
  [PlayerRoleEnum.virginia_woolf]: VirginiaWoolf,
  [PlayerRoleEnum.leprosa]: Leprosa,
  [PlayerRoleEnum.river_siren]: SirenaRio,
  [PlayerRoleEnum.lookout]: Vigia,
  [PlayerRoleEnum.troublemaker]: Alborotadora,
  [PlayerRoleEnum.silencer]: Silenciador,
  [PlayerRoleEnum.seer_apprentice]: AprendizVidente,
  [PlayerRoleEnum.elder_leader]: AncianaLider,
  [PlayerRoleEnum.resurrector_angel]: AngelResucitador,
  [PlayerRoleEnum.wolf_cub]: CriaLobo,
  [PlayerRoleEnum.cursed]: Maldito,
  [PlayerRoleEnum.witch]: Bruja,
  [PlayerRoleEnum.seeker_fairy]: HadaBuscadora,
  [PlayerRoleEnum.sleeping_fairy]: HadaDurmiente,
  [PlayerRoleEnum.shapeshifter]: Cambiaformas,
  [PlayerRoleEnum.drunk_man]: HombreEbrio,
  [PlayerRoleEnum.cult_leader]: LiderCulto,
  [PlayerRoleEnum.fisherman]: Pescador,
  [PlayerRoleEnum.vampire]: Vampiro,
  [PlayerRoleEnum.banshee]: Banshee,
  [PlayerRoleEnum.cupid]: Cupido,
  [PlayerRoleEnum.executioner]: Verdugo,
};

export function createRoleInstance(roleName: PlayerRole | null): IRole {
  if (!roleName || !roleMap[roleName as PlayerRoleEnum]) {
    // Return a default role if the roleName is not found or is null/undefined
    return new Aldeano();
  }
  const RoleClass = roleMap[roleName as PlayerRoleEnum];
  return new RoleClass();
}
