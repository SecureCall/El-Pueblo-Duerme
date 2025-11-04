
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
  [PlayerRoleEnum.enum.villager]: Aldeano,
  [PlayerRoleEnum.enum.seer]: Vidente,
  [PlayerRoleEnum.enum.doctor]: Medico,
  [PlayerRoleEnum.enum.werewolf]: Lobo,
  [PlayerRoleEnum.enum.hunter]: Cazador,
  [PlayerRoleEnum.enum.prince]: Principe,
  [PlayerRoleEnum.enum.priest]: Sacerdote,
  [PlayerRoleEnum.enum.guardian]: Guardian,
  [PlayerRoleEnum.enum.lycanthrope]: Licantropo,
  [PlayerRoleEnum.enum.twin]: Gemela,
  [PlayerRoleEnum.enum.hechicera]: Hechicera,
  [PlayerRoleEnum.enum.ghost]: Fantasma,
  [PlayerRoleEnum.enum.virginia_woolf]: VirginiaWoolf,
  [PlayerRoleEnum.enum.leprosa]: Leprosa,
  [PlayerRoleEnum.enum.river_siren]: SirenaRio,
  [PlayerRoleEnum.enum.lookout]: Vigia,
  [PlayerRoleEnum.enum.troublemaker]: Alborotadora,
  [PlayerRoleEnum.enum.silencer]: Silenciador,
  [PlayerRoleEnum.enum.seer_apprentice]: AprendizVidente,
  [PlayerRoleEnum.enum.elder_leader]: AncianaLider,
  [PlayerRoleEnum.enum.resurrector_angel]: AngelResucitador,
  [PlayerRoleEnum.enum.wolf_cub]: CriaLobo,
  [PlayerRoleEnum.enum.cursed]: Maldito,
  [PlayerRoleEnum.enum.witch]: Bruja,
  [PlayerRoleEnum.enum.seeker_fairy]: HadaBuscadora,
  [PlayerRoleEnum.enum.sleeping_fairy]: HadaDurmiente,
  [PlayerRoleEnum.enum.shapeshifter]: Cambiaformas,
  [PlayerRoleEnum.enum.drunk_man]: HombreEbrio,
  [PlayerRoleEnum.enum.cult_leader]: LiderCulto,
  [PlayerRoleEnum.enum.fisherman]: Pescador,
  [PlayerRoleEnum.enum.vampire]: Vampiro,
  [PlayerRoleEnum.enum.banshee]: Banshee,
  [PlayerRoleEnum.enum.cupid]: Cupido,
  [PlayerRoleEnum.enum.executioner]: Verdugo,
};

export function createRoleInstance(roleName: PlayerRole | null): IRole {
  if (!roleName || !roleMap[roleName as PlayerRoleEnum]) {
    // Return a default role if the roleName is not found or is null/undefined
    return new Aldeano();
  }
  const RoleClass = roleMap[roleName as PlayerRoleEnum];
  return new RoleClass();
}
