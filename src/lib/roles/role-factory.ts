
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
  [PlayerRoleEnum.VILLAGER]: Aldeano,
  [PlayerRoleEnum.SEER]: Vidente,
  [PlayerRoleEnum.DOCTOR]: Medico,
  [PlayerRoleEnum.WEREWOLF]: Lobo,
  [PlayerRoleEnum.HUNTER]: Cazador,
  [PlayerRoleEnum.PRINCE]: Principe,
  [PlayerRoleEnum.PRIEST]: Sacerdote,
  [PlayerRoleEnum.GUARDIAN]: Guardian,
  [PlayerRoleEnum.LYCANTHROPE]: Licantropo,
  [PlayerRoleEnum.TWIN]: Gemela,
  [PlayerRoleEnum.HECHICERA]: Hechicera,
  [PlayerRoleEnum.GHOST]: Fantasma,
  [PlayerRoleEnum.VIRGINIA_WOOLF]: VirginiaWoolf,
  [PlayerRoleEnum.LEPROSA]: Leprosa,
  [PlayerRoleEnum.RIVER_SIREN]: SirenaRio,
  [PlayerRoleEnum.LOOKOUT]: Vigia,
  [PlayerRoleEnum.TROUBLEMAKER]: Alborotadora,
  [PlayerRoleEnum.SILENCER]: Silenciador,
  [PlayerRoleEnum.SEER_APPRENTICE]: AprendizVidente,
  [PlayerRoleEnum.ELDER_LEADER]: AncianaLider,
  [PlayerRoleEnum.RESURRECTOR_ANGEL]: AngelResucitador,
  [PlayerRoleEnum.WOLF_CUB]: CriaLobo,
  [PlayerRoleEnum.CURSED]: Maldito,
  [PlayerRoleEnum.WITCH]: Bruja,
  [PlayerRoleEnum.SEEKER_FAIRY]: HadaBuscadora,
  [PlayerRoleEnum.SLEEPING_FAIRY]: HadaDurmiente,
  [PlayerRoleEnum.SHAPESHIFTER]: Cambiaformas,
  [PlayerRoleEnum.DRUNK_MAN]: HombreEbrio,
  [PlayerRoleEnum.CULT_LEADER]: LiderCulto,
  [PlayerRoleEnum.FISHERMAN]: Pescador,
  [PlayerRoleEnum.VAMPIRE]: Vampiro,
  [PlayerRoleEnum.BANSHEE]: Banshee,
  [PlayerRoleEnum.CUPID]: Cupido,
  [PlayerRoleEnum.EXECUTIONER]: Verdugo,
};

export function createRoleInstance(roleName?: PlayerRole | null): IRole {
  if (!roleName || !roleMap[roleName]) {
    // Return a default role if the roleName is not found or is null/undefined
    return new Aldeano();
  }
  const RoleClass = roleMap[roleName];
  return new RoleClass();
}
