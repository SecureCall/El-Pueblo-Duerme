

import { GameContext, GameStateChange, IRole, NightAction, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Bruja implements IRole {
  readonly name = PlayerRoleEnum.witch;
  readonly description = "Eres aliada de los lobos. Cada noche, eliges a un jugador. Si eliges a la Vidente, la descubrirás y los lobos serán informados. Desde ese momento, los lobos no podrán matarte.";
  readonly team = 'Lobos';
  readonly alliance = 'Lobos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'witch_hunt' || !action.targetId) {
      return null;
    }

    const targetPlayer = context.players.find((p: Player) => p.userId === action.targetId);
    if (targetPlayer?.role === 'seer') {
      return {
        game: {
          witchFoundSeer: true,
        },
        events: [{
          id: `evt_witch_found_${Date.now()}`,
          gameId: context.game.id,
          round: context.game.currentRound,
          type: 'special',
          message: `¡Has encontrado a la Vidente! Ahora los lobos saben que eres su aliada.`,
          data: { targetId: context.player.userId },
          createdAt: new Date(),
        }]
      };
    }

    return {
      events: [{
        id: `evt_witch_failed_${Date.now()}`,
        gameId: context.game.id,
        round: context.game.currentRound,
        type: 'special',
        message: `Tu búsqueda fue en vano. ${targetPlayer?.displayName || 'El objetivo'} no es la Vidente.`,
        data: { targetId: context.player.userId },
        createdAt: new Date(),
      }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    // Gana con los lobos
    return false;
  }
  
  getWinMessage(player: Player): string {
    return "Los lobos han ganado.";
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
