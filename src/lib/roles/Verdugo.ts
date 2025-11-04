
import { GameContext, IRole, RoleData, RoleName, Team } from "@/types";

export class Verdugo implements IRole {
  readonly name = 'executioner';
  readonly description = "Al inicio se te asigna un objetivo secreto. Tu única misión es convencer al pueblo para que lo linchen. Si lo consigues, ganas la partida en solitario.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    // La victoria del Verdugo se concede en `checkGameOver`
    // cuando se procesa el linchamiento de su objetivo.
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
