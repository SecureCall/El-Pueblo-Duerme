
import { IRole, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Licantropo implements IRole {
  readonly name = PlayerRoleEnum.enum.lycanthrope;
  readonly description = "Perteneces al equipo del pueblo, pero tienes sangre de lobo. Si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition() {
    return false;
  }
  
  getWinMessage(player: Player): string {
    return "El pueblo ha ganado.";
  }
  
  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
