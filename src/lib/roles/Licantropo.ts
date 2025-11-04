
import { IRole, RoleData, RoleName, Team } from "@/types";

export class Licantropo implements IRole {
  readonly name = 'lycanthrope';
  readonly description = "Perteneces al equipo del pueblo, pero tienes sangre de lobo. Si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  onNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition() {
    return false;
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
