
import type { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class SirenaRio implements IRole {
  readonly name = PlayerRoleEnum.RIVER_SIREN;
  readonly description = "En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.currentRound !== 1 || action.actionType !== 'river_siren_charm' || !action.targetId) {
      return null;
    }

    return {
      playerUpdates: [{
        userId: context.player.userId,
        riverSirenTargetId: action.targetId,
      }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
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
