
import { IRole, RoleData, GameStateChange } from "@/types";

export class Principe implements IRole {
  readonly name = 'prince';
  readonly description = "Si el pueblo vota para lincharte, revelarás tu identidad y sobrevivirás, anulando la votación. Esta habilidad solo se puede usar una vez por partida.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    // Logic is handled during the vote processing, not on death itself.
    return null;
  }

  checkWinCondition(): boolean {
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
