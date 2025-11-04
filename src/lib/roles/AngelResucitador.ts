
import type { GameContext, GameStateChange, IRole, NightAction, RoleData } from "@/types";

export class AngelResucitador implements IRole {
  readonly name = 'resurrector_angel';
  readonly description = "Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida. El jugador resucitado volverá al juego con su rol original.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'resurrect' || !action.targetId) {
      return null;
    }

    const targetPlayerIndex = context.players.findIndex(p => p.userId === action.targetId);
    if (targetPlayerIndex === -1 || context.players[targetPlayerIndex].isAlive) {
      return null; // Target not found or is alive
    }

    const playerUpdates = [...context.game.players];
    playerUpdates[context.game.players.findIndex(p => p.userId === context.player.userId)].resurrectorAngelUsed = true;
    playerUpdates[targetPlayerIndex].isAlive = true;


    return {
      playerUpdates: [
        { userId: context.player.userId, resurrectorAngelUsed: true },
        { userId: action.targetId, isAlive: true },
      ],
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
