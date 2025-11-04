
import { GameContext, GameStateChange, IRole, RoleData, RoleName, Team } from "@/types";

export class Maldito implements IRole {
  readonly name = 'cursed';
  readonly description = "Empiezas como un aldeano, pero si los lobos te atacan, no mueres. En su lugar, te conviertes en uno de ellos.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos'; // Starts as villager

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }

  onNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    // Check win condition based on current alliance
    return false;
  }
}

    