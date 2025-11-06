
import type { GameContext, GameStateChange, IRole, NightAction, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class AngelResucitador implements IRole {
  readonly name = PlayerRoleEnum.resurrector_angel;
  readonly description = "Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida. El jugador resucitado volverá al juego con su rol original.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'resurrect' || !action.targetId) {
      return null;
    }

    const targetPlayerIndex = context.players.findIndex((p: Player) => p.userId === action.targetId);
    if (targetPlayerIndex === -1 || context.players[targetPlayerIndex].isAlive) {
      return null; // Target not found or is alive
    }
    
    const playerUpdates: Partial<Player>[] = [];

    const currentPlayerIndex = context.players.findIndex((p: Player) => p.userId === context.player.userId);
    if(currentPlayerIndex !== -1) {
        playerUpdates.push({ userId: context.player.userId, resurrectorAngelUsed: true });
    }
    playerUpdates.push({ userId: action.targetId, isAlive: true });
    
    return {
      playerUpdates,
      events: [{
        id: `evt_resurrect_${Date.now()}`,
        gameId: context.game.id,
        round: context.game.currentRound,
        type: 'special',
        message: `¡Un milagro! ${context.players[targetPlayerIndex].displayName} ha sido devuelto a la vida por un poder celestial.`,
        data: { targetId: action.targetId },
        createdAt: new Date(),
      }]
    };
  }

  onDeath(context: GameContext): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    return false;
  }

  getWinMessage(player: Player): string {
      return "El pueblo ha ganado.";
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
