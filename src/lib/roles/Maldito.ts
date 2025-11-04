
import { IRole, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Maldito implements IRole {
  readonly name = PlayerRoleEnum.CURSED;
  readonly description = "Empiezas como un aldeano, pero si los lobos te atacan, no mueres. En su lugar, te conviertes en uno de ellos.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos'; // Starts as villager

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }

  performNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition() {
    // Check win condition based on current alliance
    return false;
  }

  getWinMessage() {
      return "El pueblo ha ganado.";
  }
}
