
import type { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Silenciador implements IRole {
  readonly name = PlayerRoleEnum.silencer;
  readonly description = "Cada noche, eliges a un jugador. Esa persona no podrá hablar (enviar mensajes en el chat) durante todo el día siguiente.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'silencer_silence' || !action.targetId) {
      return null;
    }
    
    return {
      game: {
        silencedPlayerId: action.targetId as string,
      },
      playerUpdates: [
        { userId: context.player.userId, usedNightAbility: true }
      ]
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
