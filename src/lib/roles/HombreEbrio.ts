
import { GameContext, IRole, RoleData, Player, PlayerRoleEnum } from "@/types";

export class HombreEbrio implements IRole {
  readonly name = PlayerRoleEnum.DRUNK_MAN;
  readonly description = "Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction() {
    return null;
  }

  onDeath() {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    // La victoria se concede en el momento del linchamiento en `checkGameOver`
    return false;
  }
  
  getWinMessage(player: Player): string {
      return "¡El Hombre Ebrio ha ganado!";
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
