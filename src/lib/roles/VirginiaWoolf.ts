

import type { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class VirginiaWoolf implements IRole {
  readonly name = PlayerRoleEnum.virginia_woolf;
  readonly description = "En la primera noche, eliges a un jugador para vincular tu destino. Si tú mueres en cualquier momento de la partida, la persona que elegiste también morirá automáticamente contigo.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.currentRound !== 1 || action.actionType !== 'virginia_woolf_link' || !action.targetId) {
      return null;
    }
    return {
      playerUpdates: [{
        userId: context.player.userId,
        virginiaWoolfTargetId: action.targetId as string,
      }]
    };
  }

  onDeath(context: GameContext): GameStateChange | null {
    const targetId = context.player.virginiaWoolfTargetId;
    if (targetId) {
      return {
        pendingDeaths: [{ playerId: targetId, cause: 'special' }]
      };
    }
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
