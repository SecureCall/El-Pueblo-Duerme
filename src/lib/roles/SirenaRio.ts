
import type { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class SirenaRio implements IRole {
  readonly name = 'river_siren';
  readonly description = "En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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
  
  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
