
import type { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Silenciador implements IRole {
  readonly name = PlayerRoleEnum.SILENCER;
  readonly description = "Cada noche, eliges a un jugador. Esa persona no podrá hablar (enviar mensajes en el chat) durante todo el día siguiente.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'silencer_silence' || !action.targetId) {
      return null;
    }
    
    return {
      game: {
        silencedPlayerId: action.targetId,
      },
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
