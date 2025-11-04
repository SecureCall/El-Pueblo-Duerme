
import { GameContext, IRole, RoleData, RoleName, Team } from "@/types";

export class HombreEbrio implements IRole {
  readonly name = 'drunk_man';
  readonly description = "Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { player, game } = context;
    // La victoria se concede en el momento del linchamiento en `checkGameOver`
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
