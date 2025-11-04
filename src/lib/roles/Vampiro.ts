

import { GameContext, GameStateChange, IRole, NightAction, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Vampiro implements IRole {
  readonly name = PlayerRoleEnum.enum.vampire;
  readonly description = "Juegas solo. Cada noche, muerdes a un jugador. Un jugador mordido 3 veces, muere. Si consigues 3 muertes por mordisco, ganas la partida.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'vampire_bite' || !action.targetId) {
      return null;
    }

    const targetPlayer = context.players.find(p => p.userId === action.targetId);
    if (!targetPlayer) return null;

    const newBiteCount = (targetPlayer.biteCount || 0) + 1;
    let pendingDeaths: GameStateChange['pendingDeaths'] = [];
    let vampireKills = context.game.vampireKills || 0;

    if (newBiteCount >= 3) {
      pendingDeaths.push({ playerId: targetPlayer.userId, cause: 'vampire_kill' });
      vampireKills += 1;
    }

    return {
      game: { vampireKills },
      playerUpdates: [{
        userId: targetPlayer.userId,
        biteCount: newBiteCount,
      }],
      pendingDeaths,
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    return (context.game.vampireKills || 0) >= 3;
  }
  
  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }

  getWinMessage() {
      return "¡El Vampiro ha ganado! Ha reclamado sus tres víctimas y ahora reina en la oscuridad.";
  }
}
