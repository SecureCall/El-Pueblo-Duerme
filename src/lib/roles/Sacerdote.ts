

import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Sacerdote implements IRole {
  readonly name = PlayerRoleEnum.priest;
  readonly description = "Cada noche, otorgas una bendición a un jugador, protegiéndolo de cualquier ataque nocturno (lobos, venenos, etc.). Puedes bendecirte a ti mismo una sola vez por partida.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'priest_bless' || !action.targetId) {
      return null;
    }
    
    const { player } = context;
    const targetId = action.targetId;

    if (targetId === player.userId) {
      if (player.priestSelfHealUsed) {
        return null; // Should be caught client-side too
      }
      return {
        playerUpdates: [{ userId: player.userId, priestSelfHealUsed: true, usedNightAbility: true }],
      };
    }

    return {
       playerUpdates: [{ userId: player.userId, usedNightAbility: true }],
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
